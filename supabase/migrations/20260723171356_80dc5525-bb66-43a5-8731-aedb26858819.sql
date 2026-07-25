DO $$ BEGIN CREATE TYPE public.item_rarity AS ENUM ('common','rare','epic','legendary','mythic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.item_kind AS ENUM ('badge','artifact','boost','cosmetic','title','medal','book'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.focus_mode AS ENUM ('pomodoro','deep_work','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.boss_status AS ENUM ('active','completed','failed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_title text,
  ADD COLUMN IF NOT EXISTS current_rank text DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS life_score numeric DEFAULT 0;

CREATE TABLE public.user_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_key text NOT NULL,
  title_name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '🎖️',
  rarity public.item_rarity NOT NULL DEFAULT 'common',
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_titles TO authenticated;
GRANT ALL ON public.user_titles TO service_role;
ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user_titles" ON public.user_titles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_titles_user_idx ON public.user_titles(user_id);

CREATE TABLE public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  icon text DEFAULT '⭐',
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_events TO authenticated;
GRANT ALL ON public.timeline_events TO service_role;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own timeline_events" ON public.timeline_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX timeline_events_user_date_idx ON public.timeline_events(user_id, occurred_at DESC);

CREATE TABLE public.life_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  score numeric NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_score_snapshots TO authenticated;
GRANT ALL ON public.life_score_snapshots TO service_role;
ALTER TABLE public.life_score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own life_score_snapshots" ON public.life_score_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX life_score_snapshots_idx ON public.life_score_snapshots(user_id, snapshot_date DESC);

CREATE TABLE public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode public.focus_mode NOT NULL DEFAULT 'pomodoro',
  planned_seconds integer NOT NULL,
  actual_seconds integer NOT NULL DEFAULT 0,
  label text,
  skill_category public.skill_category,
  ambient_sound text,
  completed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  xp_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own focus_sessions" ON public.focus_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX focus_sessions_user_date_idx ON public.focus_sessions(user_id, started_at DESC);

CREATE TABLE public.weekly_bosses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  name text NOT NULL,
  description text,
  icon text DEFAULT '👹',
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  xp_reward integer NOT NULL DEFAULT 500,
  status public.boss_status NOT NULL DEFAULT 'active',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_bosses TO authenticated;
GRANT ALL ON public.weekly_bosses TO service_role;
ALTER TABLE public.weekly_bosses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weekly_bosses" ON public.weekly_bosses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX weekly_bosses_user_idx ON public.weekly_bosses(user_id, week_start DESC);

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  kind public.item_kind NOT NULL,
  name text NOT NULL,
  description text,
  icon text DEFAULT '🎁',
  rarity public.item_rarity NOT NULL DEFAULT 'common',
  metadata jsonb DEFAULT '{}'::jsonb,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inventory_items" ON public.inventory_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX inventory_items_user_idx ON public.inventory_items(user_id, earned_at DESC);

CREATE OR REPLACE FUNCTION public.record_timeline(p_user_id uuid, p_key text, p_category text, p_title text, p_description text DEFAULT NULL, p_icon text DEFAULT '⭐', p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.timeline_events(user_id, event_key, category, title, description, icon, metadata)
  VALUES (p_user_id, p_key, p_category, p_title, p_description, p_icon, p_metadata)
  ON CONFLICT (user_id, event_key) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.award_title(p_user_id uuid, p_key text, p_name text, p_desc text, p_icon text, p_rarity public.item_rarity)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inserted boolean := false;
BEGIN
  INSERT INTO public.user_titles(user_id, title_key, title_name, description, icon, rarity)
  VALUES (p_user_id, p_key, p_name, p_desc, p_icon, p_rarity)
  ON CONFLICT (user_id, title_key) DO NOTHING RETURNING true INTO v_inserted;
  IF v_inserted THEN
    INSERT INTO public.inventory_items(user_id, item_key, kind, name, description, icon, rarity)
    VALUES (p_user_id, 'title:'||p_key, 'title', p_name, p_desc, p_icon, p_rarity)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN COALESCE(v_inserted, false);
END $$;

CREATE OR REPLACE FUNCTION public.equip_title(p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_key IS NULL OR p_key = '' THEN UPDATE public.profiles SET equipped_title = NULL WHERE id = v_uid; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_titles WHERE user_id = v_uid AND title_key = p_key) THEN RAISE EXCEPTION 'title not owned'; END IF;
  UPDATE public.profiles SET equipped_title = p_key, updated_at = now() WHERE id = v_uid;
END $$;
GRANT EXECUTE ON FUNCTION public.equip_title(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.calc_life_score(p_user_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := COALESCE(p_user_id, auth.uid()); v_profile public.profiles; v_xp_7d int := 0; v_workouts_7d int := 0; v_habits_done_7d int := 0; v_focus_min_7d int := 0; v_recovery_days int := 0; v_relapse_7d int := 0; v_missions_7d int := 0; v_sleep_avg numeric := 0; v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid; IF NOT FOUND THEN RETURN 0; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_xp_7d FROM public.xp_history WHERE user_id = v_uid AND created_at >= now() - interval '7 days' AND amount > 0;
  SELECT COUNT(*) INTO v_workouts_7d FROM public.workouts WHERE user_id = v_uid AND performed_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO v_habits_done_7d FROM public.habits WHERE user_id = v_uid AND last_completed_date >= CURRENT_DATE - 7;
  SELECT COALESCE(SUM(actual_seconds)/60,0) INTO v_focus_min_7d FROM public.focus_sessions WHERE user_id = v_uid AND started_at >= now() - interval '7 days' AND completed = true;
  SELECT COALESCE(SUM(GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - started_at))/86400)::int)),0) INTO v_recovery_days FROM public.bad_habits WHERE user_id = v_uid AND archived_at IS NULL;
  SELECT COUNT(*) INTO v_relapse_7d FROM public.bad_habit_relapses WHERE user_id = v_uid AND relapsed_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO v_missions_7d FROM public.tasks WHERE user_id = v_uid AND completed = true AND completed_at >= now() - interval '7 days';
  SELECT COALESCE(AVG(sleep_hours),0) INTO v_sleep_avg FROM public.health_logs WHERE user_id = v_uid AND log_date >= CURRENT_DATE - 7 AND sleep_hours IS NOT NULL;
  v_total := ROUND(LEAST(10, COALESCE(v_profile.level,1)::numeric/5*10) + LEAST(10, v_xp_7d::numeric/500*10) + LEAST(10, COALESCE(v_profile.streak_days,0)::numeric/30*10) + LEAST(10, v_missions_7d::numeric/14*10) + LEAST(10, v_habits_done_7d::numeric/5*10) + LEAST(10, v_workouts_7d::numeric/4*10) + GREATEST(0, LEAST(10, v_recovery_days::numeric/30*10)-v_relapse_7d*2) + LEAST(10, v_focus_min_7d::numeric/300*10) + CASE WHEN v_sleep_avg=0 THEN 5 WHEN v_sleep_avg BETWEEN 7 AND 9 THEN 10 WHEN v_sleep_avg BETWEEN 6 AND 10 THEN 7 ELSE 4 END, 1);
  UPDATE public.profiles SET life_score = v_total, updated_at = now() WHERE id = v_uid;
  INSERT INTO public.life_score_snapshots(user_id, snapshot_date, score, breakdown) VALUES (v_uid, CURRENT_DATE, v_total, '{}'::jsonb) ON CONFLICT (user_id, snapshot_date) DO UPDATE SET score = EXCLUDED.score;
  RETURN v_total;
END $$;
GRANT EXECUTE ON FUNCTION public.calc_life_score(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_all_titles(p_user_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := COALESCE(p_user_id, auth.uid()); v_profile public.profiles; v_awarded int := 0; v_missions int; v_books int; v_workouts int;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF; SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid; IF NOT FOUND THEN RETURN 0; END IF;
  SELECT COUNT(*) INTO v_missions FROM public.tasks WHERE user_id=v_uid AND completed=true; SELECT COUNT(*) INTO v_books FROM public.library_items WHERE user_id=v_uid AND completed=true; SELECT COUNT(*) INTO v_workouts FROM public.workouts WHERE user_id=v_uid;
  IF v_profile.streak_days >= 7 AND public.award_title(v_uid,'disciplined','O Disciplinado','7 dias de streak','🧭','common') THEN v_awarded := v_awarded+1; END IF;
  IF v_books >= 5 AND public.award_title(v_uid,'reader','O Leitor','5 livros terminados','📖','common') THEN v_awarded := v_awarded+1; END IF;
  IF v_workouts >= 30 AND public.award_title(v_uid,'athlete','O Atleta','30 treinos','💪','rare') THEN v_awarded := v_awarded+1; END IF;
  IF v_missions >= 100 AND public.award_title(v_uid,'achiever','O Realizador','100 missões concluídas','⚡','rare') THEN v_awarded := v_awarded+1; END IF;
  RETURN v_awarded;
END $$;
GRANT EXECUTE ON FUNCTION public.check_all_titles(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_rank(p_user_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := COALESCE(p_user_id, auth.uid()); v_p public.profiles; v_new_rank text := 'beginner';
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF; SELECT * INTO v_p FROM public.profiles WHERE id=v_uid; IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_p.level >= 5 AND v_p.total_xp >= 500 THEN v_new_rank := 'explorer'; END IF; IF v_p.level >= 10 AND v_p.total_xp >= 2000 THEN v_new_rank := 'warrior'; END IF; IF v_p.level >= 20 AND v_p.total_xp >= 6000 THEN v_new_rank := 'elite'; END IF; IF v_p.level >= 35 AND v_p.total_xp >= 15000 THEN v_new_rank := 'master'; END IF; IF v_p.level >= 50 AND v_p.total_xp >= 35000 THEN v_new_rank := 'legend'; END IF; IF v_p.level >= 75 AND v_p.total_xp >= 75000 THEN v_new_rank := 'ascended'; END IF;
  UPDATE public.profiles SET current_rank=v_new_rank, updated_at=now() WHERE id=v_uid; RETURN v_new_rank;
END $$;
GRANT EXECUTE ON FUNCTION public.check_rank(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_life_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_score numeric; v_rank text; v_titles int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.recalculate_xp(v_uid); v_titles := public.check_all_titles(v_uid); v_rank := public.check_rank(v_uid); v_score := public.calc_life_score(v_uid);
  RETURN jsonb_build_object('life_score', v_score, 'rank', v_rank, 'new_titles', v_titles);
END $$;
GRANT EXECUTE ON FUNCTION public.sync_life_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('profile',(SELECT to_jsonb(p) FROM public.profiles p WHERE p.id=v_uid),'skills',(SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM public.skills s WHERE s.user_id=v_uid),'xp_30d',(SELECT COALESCE(jsonb_agg(jsonb_build_object('date',date(created_at),'amount',amount,'source',source,'hour',EXTRACT(HOUR FROM created_at))),'[]'::jsonb) FROM public.xp_history WHERE user_id=v_uid AND created_at>=now()-interval '30 days'),'missions_30d',(SELECT COUNT(*) FROM public.tasks WHERE user_id=v_uid AND completed=true AND completed_at>=now()-interval '30 days'),'workouts_30d',(SELECT COUNT(*) FROM public.workouts WHERE user_id=v_uid AND performed_at>=now()-interval '30 days'),'sleep_avg_30d',(SELECT COALESCE(AVG(sleep_hours),0) FROM public.health_logs WHERE user_id=v_uid AND log_date>=CURRENT_DATE-30),'focus_min_30d',(SELECT COALESCE(SUM(actual_seconds)/60,0) FROM public.focus_sessions WHERE user_id=v_uid AND completed=true AND started_at>=now()-interval '30 days'),'habits',(SELECT COALESCE(jsonb_agg(to_jsonb(h)),'[]'::jsonb) FROM public.habits h WHERE h.user_id=v_uid),'bad_habits',(SELECT COALESCE(jsonb_agg(to_jsonb(b)),'[]'::jsonb) FROM public.bad_habits b WHERE b.user_id=v_uid AND b.archived_at IS NULL),'finance_balance',(SELECT COALESCE(SUM(CASE WHEN kind='receita' THEN amount ELSE -amount END),0) FROM public.finance_transactions WHERE user_id=v_uid),'life_score',COALESCE((SELECT life_score FROM public.profiles WHERE id=v_uid),0),'rank',COALESCE((SELECT current_rank FROM public.profiles WHERE id=v_uid),'beginner'),'titles',(SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM public.user_titles t WHERE t.user_id=v_uid)) INTO v_result;
  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.get_user_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_activity_heatmap(p_year integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_year int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int); v_start date := make_date(v_year,1,1); v_end date := make_date(v_year,12,31); v_data jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date',d,'xp',COALESCE(x,0))),'[]'::jsonb) INTO v_data FROM (SELECT date(created_at) d, SUM(amount) x FROM public.xp_history WHERE user_id=v_uid AND date(created_at) BETWEEN v_start AND v_end AND amount>0 GROUP BY date(created_at)) q;
  RETURN v_data;
END $$;
GRANT EXECUTE ON FUNCTION public.get_activity_heatmap(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_future(p_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_p public.profiles; v_xp_daily numeric; v_proj_xp numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF; SELECT * INTO v_p FROM public.profiles WHERE id=v_uid;
  SELECT COALESCE(SUM(amount),0)::numeric/60 INTO v_xp_daily FROM public.xp_history WHERE user_id=v_uid AND created_at>=now()-interval '60 days' AND amount>0;
  v_proj_xp := v_xp_daily * p_days;
  RETURN jsonb_build_object('days',p_days,'xp_gained',round(v_proj_xp),'level',GREATEST(1,floor(sqrt((COALESCE(v_p.total_xp,0)+v_proj_xp)/50.0))::int+1),'books',0,'workouts',0,'savings',0,'missions',0,'daily_xp_avg',round(v_xp_daily,1));
END $$;
GRANT EXECUTE ON FUNCTION public.project_future(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_weekly_boss(p_user_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := COALESCE(p_user_id, auth.uid()); v_week_start date := date_trunc('week', CURRENT_DATE)::date; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_id FROM public.weekly_bosses WHERE user_id=v_uid AND week_start=v_week_start; IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.weekly_bosses(user_id, week_start, name, description, icon, objectives, xp_reward) VALUES (v_uid, v_week_start, 'Boss da Semana', 'Complete todos os objetivos até domingo para derrotá-lo.', '👹', jsonb_build_array(jsonb_build_object('key','missions','label','Concluir missões','target',5,'current',0), jsonb_build_object('key','workouts','label','Treinar','target',3,'current',0), jsonb_build_object('key','xp','label','Ganhar XP','target',200,'current',0)), 300) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.generate_weekly_boss(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_weekly_boss_progress()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_week_start date := date_trunc('week', CURRENT_DATE)::date; v_boss public.weekly_bosses;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF; PERFORM public.generate_weekly_boss(v_uid); SELECT * INTO v_boss FROM public.weekly_bosses WHERE user_id=v_uid AND week_start=v_week_start;
  RETURN jsonb_build_object('id',v_boss.id,'name',v_boss.name,'description',v_boss.description,'icon',v_boss.icon,'status',v_boss.status,'xp_reward',v_boss.xp_reward,'week_start',v_boss.week_start,'objectives',v_boss.objectives);
END $$;
GRANT EXECUTE ON FUNCTION public.get_weekly_boss_progress() TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_focus_session(p_id uuid, p_actual_seconds integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_session public.focus_sessions; v_xp int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF; SELECT * INTO v_session FROM public.focus_sessions WHERE id=p_id AND user_id=v_uid; IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF; IF v_session.completed THEN RETURN v_session.xp_awarded; END IF;
  v_xp := GREATEST(5, floor(COALESCE(p_actual_seconds,0)/60.0)::int); UPDATE public.focus_sessions SET actual_seconds=p_actual_seconds, completed=true, ended_at=now(), xp_awarded=v_xp WHERE id=p_id; PERFORM public.recalculate_xp(v_uid); RETURN v_xp;
END $$;
GRANT EXECUTE ON FUNCTION public.complete_focus_session(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.bad_habit_relapse(p_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_habit public.bad_habits; v_streak bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF; SELECT * INTO v_habit FROM public.bad_habits WHERE id=p_id AND user_id=v_uid; IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  v_streak := GREATEST(0, EXTRACT(EPOCH FROM (now()-v_habit.started_at))::bigint); INSERT INTO public.bad_habit_relapses(user_id,bad_habit_id,relapsed_at,streak_seconds,note) VALUES (v_uid,p_id,now(),v_streak,NULLIF(p_note,'')); UPDATE public.bad_habits SET started_at=now(), best_streak_seconds=GREATEST(best_streak_seconds,v_streak), total_clean_seconds=total_clean_seconds+v_streak, relapse_count=relapse_count+1, last_awarded_day=0 WHERE id=p_id; PERFORM public.recalculate_xp(v_uid);
END $$;
GRANT EXECUTE ON FUNCTION public.bad_habit_relapse(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bad_habit_sync_awards()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF; PERFORM public.recalculate_xp(v_uid); PERFORM public.check_all_titles(v_uid); PERFORM public.calc_life_score(v_uid);
END $$;
GRANT EXECUTE ON FUNCTION public.bad_habit_sync_awards() TO authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_xp_after_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN PERFORM public.recalculate_xp(COALESCE(NEW.user_id, OLD.user_id)); RETURN COALESCE(NEW, OLD); END $$;
CREATE TRIGGER trg_recalculate_xp_focus AFTER INSERT OR UPDATE OR DELETE ON public.focus_sessions FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_weekly_bosses AFTER INSERT OR UPDATE OR DELETE ON public.weekly_bosses FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

REVOKE ALL ON FUNCTION public.record_timeline(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_title(uuid, text, text, text, text, public.item_rarity) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_xp_after_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;