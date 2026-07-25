
DO $$ BEGIN CREATE TYPE public.bad_habit_difficulty AS ENUM ('easy','medium','hard'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.bad_habit_priority AS ENUM ('low','medium','high'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.item_rarity AS ENUM ('common','rare','epic','legendary','mythic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.item_kind AS ENUM ('badge','artifact','boost','cosmetic','title','medal','book'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.focus_mode AS ENUM ('pomodoro','deep_work','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.boss_status AS ENUM ('active','completed','failed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.xp_history ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_title text,
  ADD COLUMN IF NOT EXISTS current_rank text DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS life_score numeric DEFAULT 0;

CREATE TABLE public.bad_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🚫',
  color text NOT NULL DEFAULT '#ef4444',
  difficulty public.bad_habit_difficulty NOT NULL DEFAULT 'medium',
  priority public.bad_habit_priority NOT NULL DEFAULT 'medium',
  motivation text,
  goal_date date,
  started_at timestamptz NOT NULL DEFAULT now(),
  best_streak_seconds bigint NOT NULL DEFAULT 0,
  total_clean_seconds bigint NOT NULL DEFAULT 0,
  relapse_count integer NOT NULL DEFAULT 0,
  last_awarded_day integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bad_habits TO authenticated;
GRANT ALL ON public.bad_habits TO service_role;
ALTER TABLE public.bad_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bad_habits" ON public.bad_habits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX bad_habits_user_idx ON public.bad_habits(user_id, archived_at);

CREATE TABLE public.bad_habit_relapses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bad_habit_id uuid NOT NULL REFERENCES public.bad_habits(id) ON DELETE CASCADE,
  relapsed_at timestamptz NOT NULL DEFAULT now(),
  streak_seconds bigint NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bad_habit_relapses TO authenticated;
GRANT ALL ON public.bad_habit_relapses TO service_role;
ALTER TABLE public.bad_habit_relapses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bad_habit_relapses" ON public.bad_habit_relapses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX bad_habit_relapses_habit_idx ON public.bad_habit_relapses(bad_habit_id, relapsed_at DESC);

CREATE TABLE public.recovery_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bad_habit_id uuid REFERENCES public.bad_habits(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  xp_reward integer NOT NULL DEFAULT 5,
  mission_date date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_missions TO authenticated;
GRANT ALL ON public.recovery_missions TO service_role;
ALTER TABLE public.recovery_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recovery_missions" ON public.recovery_missions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX recovery_missions_user_date_idx ON public.recovery_missions(user_id, mission_date);

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
  defeated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_bosses TO authenticated;
GRANT ALL ON public.weekly_bosses TO service_role;
ALTER TABLE public.weekly_bosses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weekly_bosses" ON public.weekly_bosses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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

CREATE OR REPLACE FUNCTION public.bad_habits_touch_updated() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER bad_habits_touch BEFORE UPDATE ON public.bad_habits
  FOR EACH ROW EXECUTE FUNCTION public.bad_habits_touch_updated();

CREATE OR REPLACE FUNCTION public.bad_habit_relapse(p_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_habit public.bad_habits; v_streak bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_habit FROM public.bad_habits WHERE id = p_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  v_streak := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_habit.started_at))::bigint);
  INSERT INTO public.bad_habit_relapses(user_id, bad_habit_id, relapsed_at, streak_seconds, note)
  VALUES (v_uid, p_id, now(), v_streak, NULLIF(p_note, ''));
  UPDATE public.bad_habits SET
    started_at = now(),
    best_streak_seconds = GREATEST(best_streak_seconds, v_streak),
    total_clean_seconds = total_clean_seconds + v_streak,
    relapse_count = relapse_count + 1,
    last_awarded_day = 0
  WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.bad_habit_sync_awards()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); h RECORD;
  v_current_day int; v_day int; v_amount int; v_base int; v_weekly int; v_monthly int; v_total_days int;
  v_thresholds int[] := ARRAY[1,3,7,14,21,30,60,90,180,365,500,1000];
  v_names text[] := ARRAY['1 dia limpo','3 dias limpo','1 semana limpo','2 semanas limpo','3 semanas limpo','1 mês limpo','2 meses limpo','3 meses limpo','6 meses limpo','1 ano limpo','500 dias limpo','1000 dias limpo'];
  v_th int; v_key text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  FOR h IN SELECT id, name, difficulty, started_at, last_awarded_day FROM public.bad_habits
           WHERE user_id = v_uid AND archived_at IS NULL LOOP
    v_current_day := GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - h.started_at))/86400)::int);
    IF v_current_day <= h.last_awarded_day THEN CONTINUE; END IF;
    v_base := CASE h.difficulty WHEN 'easy' THEN 5 WHEN 'medium' THEN 8 ELSE 12 END;
    v_weekly := CASE h.difficulty WHEN 'easy' THEN 20 WHEN 'medium' THEN 35 ELSE 50 END;
    v_monthly := CASE h.difficulty WHEN 'easy' THEN 100 WHEN 'medium' THEN 200 ELSE 300 END;
    FOR v_day IN (h.last_awarded_day + 1)..LEAST(v_current_day, h.last_awarded_day + 400) LOOP
      v_amount := v_base + floor(v_day/7)::int * (CASE h.difficulty WHEN 'easy' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END);
      IF v_day % 30 = 0 THEN v_amount := v_amount + v_monthly;
      ELSIF v_day % 7 = 0 THEN v_amount := v_amount + v_weekly; END IF;
      PERFORM public._award_xp_for_user(v_uid, v_amount, 'recovery:'||h.id::text||':d'||v_day, 'disciplina'::public.skill_category, NULL);
    END LOOP;
    UPDATE public.bad_habits SET last_awarded_day = LEAST(v_current_day, h.last_awarded_day + 400) WHERE id = h.id;
    v_total_days := v_current_day;
    FOR i IN 1..array_length(v_thresholds,1) LOOP
      v_th := v_thresholds[i];
      IF v_total_days >= v_th THEN
        v_key := 'recovery:'||h.id::text||':'||v_th;
        INSERT INTO public.achievements(user_id, badge_key, name, description, icon)
        VALUES (v_uid, v_key, v_names[i]||' — '||h.name, 'Recuperação de '||h.name, '🏅')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.record_timeline(
  p_user_id uuid, p_key text, p_category text, p_title text,
  p_description text DEFAULT NULL, p_icon text DEFAULT '⭐', p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.timeline_events(user_id, event_key, category, title, description, icon, metadata)
  VALUES (p_user_id, p_key, p_category, p_title, p_description, p_icon, p_metadata)
  ON CONFLICT (user_id, event_key) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.award_title(
  p_user_id uuid, p_key text, p_name text, p_desc text, p_icon text, p_rarity public.item_rarity
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inserted boolean := false;
BEGIN
  INSERT INTO public.user_titles(user_id, title_key, title_name, description, icon, rarity)
  VALUES (p_user_id, p_key, p_name, p_desc, p_icon, p_rarity)
  ON CONFLICT (user_id, title_key) DO NOTHING
  RETURNING true INTO v_inserted;
  IF v_inserted THEN
    INSERT INTO public.inventory_items(user_id, item_key, kind, name, description, icon, rarity)
    VALUES (p_user_id, 'title:'||p_key, 'title', p_name, p_desc, p_icon, p_rarity)
    ON CONFLICT DO NOTHING;
    PERFORM public.record_timeline(p_user_id, 'title:'||p_key, 'title',
      'Título desbloqueado: '||p_name, p_desc, p_icon, jsonb_build_object('rarity', p_rarity));
  END IF;
  RETURN COALESCE(v_inserted, false);
END $$;

CREATE OR REPLACE FUNCTION public.equip_title(p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_key IS NULL OR p_key = '' THEN
    UPDATE public.profiles SET equipped_title = NULL WHERE id = v_uid; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_titles WHERE user_id = v_uid AND title_key = p_key) THEN
    RAISE EXCEPTION 'title not owned';
  END IF;
  UPDATE public.profiles SET equipped_title = p_key, updated_at = now() WHERE id = v_uid;
END $$;

CREATE OR REPLACE FUNCTION public.calc_life_score(p_user_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_profile public.profiles;
  v_xp_7d int := 0; v_workouts_7d int := 0; v_habits_done_7d int := 0; v_focus_min_7d int := 0;
  v_recovery_days int := 0; v_relapse_7d int := 0; v_missions_7d int := 0; v_books int := 0;
  v_sleep_avg numeric := 0;
  s_xp numeric; s_streak numeric; s_missions numeric; s_habits numeric;
  s_workouts numeric; s_recovery numeric; s_reading numeric; s_focus numeric; s_sleep numeric; s_level numeric;
  v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_xp_7d FROM public.xp_history
    WHERE user_id = v_uid AND created_at >= now() - interval '7 days' AND amount > 0;
  SELECT COUNT(*) INTO v_workouts_7d FROM public.workouts
    WHERE user_id = v_uid AND performed_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO v_books FROM public.library_items
    WHERE user_id = v_uid AND completed = true AND updated_at >= now() - interval '30 days';
  SELECT COUNT(*) INTO v_habits_done_7d FROM public.habits
    WHERE user_id = v_uid AND last_completed_date >= CURRENT_DATE - 7;
  SELECT COALESCE(SUM(actual_seconds)/60,0) INTO v_focus_min_7d FROM public.focus_sessions
    WHERE user_id = v_uid AND started_at >= now() - interval '7 days' AND completed = true;
  SELECT COALESCE(SUM(GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - started_at))/86400)::int)),0)
    INTO v_recovery_days FROM public.bad_habits WHERE user_id = v_uid AND archived_at IS NULL;
  SELECT COUNT(*) INTO v_relapse_7d FROM public.bad_habit_relapses
    WHERE user_id = v_uid AND relapsed_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO v_missions_7d FROM public.tasks
    WHERE user_id = v_uid AND completed = true AND completed_at >= now() - interval '7 days';
  SELECT COALESCE(AVG(sleep_hours),0) INTO v_sleep_avg FROM public.health_logs
    WHERE user_id = v_uid AND log_date >= CURRENT_DATE - 7 AND sleep_hours IS NOT NULL;

  s_level    := LEAST(10, (COALESCE(v_profile.level,1)::numeric) / 5.0);
  s_xp       := LEAST(10, v_xp_7d::numeric / 500.0 * 10);
  s_streak   := LEAST(10, COALESCE(v_profile.streak_days,0)::numeric / 30.0 * 10);
  s_missions := LEAST(10, v_missions_7d::numeric / 14.0 * 10);
  s_habits   := LEAST(10, v_habits_done_7d::numeric / 5.0 * 10);
  s_workouts := LEAST(10, v_workouts_7d::numeric / 4.0 * 10);
  s_recovery := GREATEST(0, LEAST(10, v_recovery_days::numeric / 30.0 * 10) - v_relapse_7d * 2);
  s_reading  := LEAST(10, v_books::numeric / 2.0 * 10);
  s_focus    := LEAST(10, v_focus_min_7d::numeric / 300.0 * 10);
  s_sleep    := CASE WHEN v_sleep_avg = 0 THEN 5
                     WHEN v_sleep_avg BETWEEN 7 AND 9 THEN 10
                     WHEN v_sleep_avg BETWEEN 6 AND 10 THEN 7 ELSE 4 END;
  v_total := ROUND(s_level + s_xp + s_streak + s_missions + s_habits + s_workouts + s_recovery + s_reading + s_focus + s_sleep, 1);
  UPDATE public.profiles SET life_score = v_total, updated_at = now() WHERE id = v_uid;
  INSERT INTO public.life_score_snapshots(user_id, snapshot_date, score, breakdown)
  VALUES (v_uid, CURRENT_DATE, v_total, jsonb_build_object(
    'level',s_level,'xp',s_xp,'streak',s_streak,'missions',s_missions,'habits',s_habits,
    'workouts',s_workouts,'recovery',s_recovery,'reading',s_reading,'focus',s_focus,'sleep',s_sleep))
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET score = EXCLUDED.score, breakdown = EXCLUDED.breakdown;
  RETURN v_total;
END $$;

CREATE OR REPLACE FUNCTION public.check_all_titles(p_user_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_profile public.profiles;
  v_missions int; v_books int; v_workouts int; v_focus_hours numeric;
  v_recovery_days int; v_journal int; v_awarded int := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT COUNT(*) INTO v_missions FROM public.tasks WHERE user_id = v_uid AND completed = true;
  SELECT COUNT(*) INTO v_books FROM public.library_items WHERE user_id = v_uid AND completed = true;
  SELECT COUNT(*) INTO v_workouts FROM public.workouts WHERE user_id = v_uid;
  SELECT COALESCE(SUM(actual_seconds)/3600.0,0) INTO v_focus_hours FROM public.focus_sessions WHERE user_id = v_uid AND completed = true;
  SELECT COALESCE(MAX(GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - started_at))/86400)::int)),0)
    INTO v_recovery_days FROM public.bad_habits WHERE user_id = v_uid AND archived_at IS NULL;
  SELECT COUNT(*) INTO v_journal FROM public.journal_entries WHERE user_id = v_uid;

  IF v_profile.streak_days >= 7 AND public.award_title(v_uid,'disciplined','O Disciplinado','7 dias de streak','🧭','common') THEN v_awarded := v_awarded + 1; END IF;
  IF v_profile.streak_days >= 30 AND public.award_title(v_uid,'unbreakable','O Inquebrável','30 dias de streak','🛡️','rare') THEN v_awarded := v_awarded + 1; END IF;
  IF v_profile.streak_days >= 100 AND public.award_title(v_uid,'iron_mind','Mente de Ferro','100 dias de streak','🧠','epic') THEN v_awarded := v_awarded + 1; END IF;
  IF v_profile.streak_days >= 365 AND public.award_title(v_uid,'ascended','O Ascendido','365 dias de streak','👑','mythic') THEN v_awarded := v_awarded + 1; END IF;
  IF v_books >= 5 AND public.award_title(v_uid,'reader','O Leitor','5 livros terminados','📖','common') THEN v_awarded := v_awarded + 1; END IF;
  IF v_books >= 25 AND public.award_title(v_uid,'book_master','Mestre dos Livros','25 livros terminados','📚','epic') THEN v_awarded := v_awarded + 1; END IF;
  IF v_workouts >= 30 AND public.award_title(v_uid,'athlete','O Atleta','30 treinos','💪','rare') THEN v_awarded := v_awarded + 1; END IF;
  IF v_workouts >= 100 AND public.award_title(v_uid,'iron_body','Corpo de Ferro','100 treinos','🏋️','epic') THEN v_awarded := v_awarded + 1; END IF;
  IF v_focus_hours >= 10 AND public.award_title(v_uid,'focused','O Focado','10h de foco profundo','🎯','common') THEN v_awarded := v_awarded + 1; END IF;
  IF v_focus_hours >= 100 AND public.award_title(v_uid,'deep_worker','Trabalho Profundo','100h de foco','🔮','epic') THEN v_awarded := v_awarded + 1; END IF;
  IF v_recovery_days >= 30 AND public.award_title(v_uid,'recovered','O Recuperado','30 dias limpo','🌱','rare') THEN v_awarded := v_awarded + 1; END IF;
  IF v_recovery_days >= 365 AND public.award_title(v_uid,'reborn','O Renascido','1 ano limpo','🔥','legendary') THEN v_awarded := v_awarded + 1; END IF;
  IF v_missions >= 100 AND public.award_title(v_uid,'achiever','O Realizador','100 missões concluídas','⚡','rare') THEN v_awarded := v_awarded + 1; END IF;
  IF v_missions >= 500 AND public.award_title(v_uid,'legend','A Lenda','500 missões concluídas','🌟','legendary') THEN v_awarded := v_awarded + 1; END IF;
  IF EXISTS (SELECT 1 FROM public.finance_transactions WHERE user_id = v_uid AND kind = 'receita') AND
     public.award_title(v_uid,'investor','O Investidor','Primeiro rendimento registrado','💰','common') THEN v_awarded := v_awarded + 1; END IF;
  IF v_journal >= 30 AND public.award_title(v_uid,'reflective','O Reflexivo','30 entradas no diário','✍️','rare') THEN v_awarded := v_awarded + 1; END IF;
  RETURN v_awarded;
END $$;

CREATE OR REPLACE FUNCTION public.check_rank(p_user_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_p public.profiles; v_missions int; v_achievements int; v_skill_max int; v_skill_count int;
  v_new_rank text := 'beginner';
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COUNT(*) INTO v_missions FROM public.tasks WHERE user_id = v_uid AND completed = true;
  SELECT COUNT(*) INTO v_achievements FROM public.achievements WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_skill_count FROM public.skills WHERE user_id = v_uid AND level >= 3;
  SELECT COALESCE(MAX(level),0) INTO v_skill_max FROM public.skills WHERE user_id = v_uid;
  IF v_p.level >= 5 AND v_p.total_xp >= 500 THEN v_new_rank := 'explorer'; END IF;
  IF v_p.level >= 10 AND v_p.total_xp >= 2000 AND v_skill_max >= 5 AND v_achievements >= 5 THEN v_new_rank := 'warrior'; END IF;
  IF v_p.level >= 20 AND v_p.total_xp >= 6000 AND v_skill_max >= 8 AND v_skill_count >= 3 AND v_missions >= 100 THEN v_new_rank := 'master'; END IF;
  IF v_p.level >= 40 AND v_p.total_xp >= 20000 AND v_missions >= 300 THEN v_new_rank := 'legend'; END IF;
  UPDATE public.profiles SET current_rank = v_new_rank, updated_at = now() WHERE id = v_uid;
  RETURN v_new_rank;
END $$;

CREATE OR REPLACE FUNCTION public.sync_life_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_score numeric; v_rank text; v_titles int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_titles := public.check_all_titles(v_uid);
  v_rank := public.check_rank(v_uid);
  v_score := public.calc_life_score(v_uid);
  RETURN jsonb_build_object('life_score', v_score, 'rank', v_rank, 'new_titles', v_titles);
END $$;

CREATE OR REPLACE FUNCTION public.xp_history_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.profiles;
BEGIN
  IF NEW.amount <= 0 THEN RETURN NEW; END IF;
  SELECT * INTO v_p FROM public.profiles WHERE id = NEW.user_id;
  IF FOUND THEN
    IF v_p.level >= 5 THEN PERFORM public.record_timeline(NEW.user_id, 'level:5','level','Nível 5 alcançado','Sua jornada está firme.','🎯'); END IF;
    IF v_p.level >= 10 THEN PERFORM public.record_timeline(NEW.user_id, 'level:10','level','Nível 10 alcançado','Dobrou o dígito.','⭐'); END IF;
    IF v_p.level >= 20 THEN PERFORM public.record_timeline(NEW.user_id, 'level:20','level','Nível 20 alcançado','Você é elite.','🌟'); END IF;
    IF v_p.level >= 50 THEN PERFORM public.record_timeline(NEW.user_id, 'level:50','level','Nível 50 alcançado','Metade do caminho para lenda.','💫'); END IF;
    IF v_p.total_xp >= 1000 THEN PERFORM public.record_timeline(NEW.user_id, 'xp:1k','xp','1.000 XP total','Marco inicial.','⚡'); END IF;
    IF v_p.total_xp >= 10000 THEN PERFORM public.record_timeline(NEW.user_id, 'xp:10k','xp','10.000 XP total','Grande marco.','🔥'); END IF;
    BEGIN PERFORM public.check_all_titles(NEW.user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM public.check_rank(NEW.user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM public.calc_life_score(NEW.user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS xp_history_sync ON public.xp_history;
CREATE TRIGGER xp_history_sync AFTER INSERT ON public.xp_history
  FOR EACH ROW EXECUTE FUNCTION public.xp_history_after_insert();

CREATE OR REPLACE FUNCTION public.achievements_timeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.record_timeline(NEW.user_id, 'achv:'||NEW.badge_key, 'achievement',
    'Conquista: '||NEW.name, NEW.description, COALESCE(NEW.icon,'🏅'));
  INSERT INTO public.inventory_items(user_id, item_key, kind, name, description, icon, rarity)
  VALUES (NEW.user_id, 'achv:'||NEW.badge_key, 'badge', NEW.name, NEW.description, COALESCE(NEW.icon,'🏅'), 'common')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS achievements_timeline_trig ON public.achievements;
CREATE TRIGGER achievements_timeline_trig AFTER INSERT ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.achievements_timeline();

CREATE OR REPLACE FUNCTION public.project_future(p_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_p public.profiles;
  v_xp_daily numeric; v_missions_daily numeric; v_workouts_weekly numeric;
  v_books_daily numeric; v_savings_weekly numeric;
  v_proj_xp numeric; v_proj_level int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid;
  SELECT COALESCE(SUM(amount),0)::numeric/60 INTO v_xp_daily FROM public.xp_history
    WHERE user_id = v_uid AND created_at >= now() - interval '60 days' AND amount > 0;
  SELECT COUNT(*)::numeric/60 INTO v_missions_daily FROM public.tasks
    WHERE user_id = v_uid AND completed = true AND completed_at >= now() - interval '60 days';
  SELECT COUNT(*)::numeric/60*7 INTO v_workouts_weekly FROM public.workouts
    WHERE user_id = v_uid AND performed_at >= now() - interval '60 days';
  SELECT COUNT(*)::numeric/60 INTO v_books_daily FROM public.library_items
    WHERE user_id = v_uid AND completed = true AND updated_at >= now() - interval '60 days';
  SELECT COALESCE(SUM(CASE WHEN kind='receita' THEN amount ELSE -amount END),0)::numeric/60*7
    INTO v_savings_weekly FROM public.finance_transactions
    WHERE user_id = v_uid AND occurred_on >= CURRENT_DATE - 60;
  v_proj_xp := v_xp_daily * p_days;
  v_proj_level := GREATEST(1, floor(sqrt((COALESCE(v_p.total_xp,0) + v_proj_xp) / 50.0))::int + 1);
  RETURN jsonb_build_object(
    'days', p_days,
    'xp_gained', round(v_proj_xp),
    'level', v_proj_level,
    'books', floor(v_books_daily * p_days)::int,
    'workouts', floor(v_workouts_weekly * p_days / 7)::int,
    'savings', round(v_savings_weekly * p_days / 7, 2),
    'missions', floor(v_missions_daily * p_days)::int,
    'daily_xp_avg', round(v_xp_daily, 1)
  );
END $$;

CREATE OR REPLACE FUNCTION public.generate_weekly_boss(p_user_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_week_start date := date_trunc('week', CURRENT_DATE)::date;
  v_missions_avg int; v_workouts_avg int; v_xp_avg int; v_id uuid; v_objectives jsonb; v_reward int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_id FROM public.weekly_bosses WHERE user_id = v_uid AND week_start = v_week_start;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT COALESCE(COUNT(*)::int,0) INTO v_missions_avg FROM public.tasks
    WHERE user_id = v_uid AND completed = true AND completed_at >= now() - interval '28 days';
  SELECT COALESCE(COUNT(*)::int,0) INTO v_workouts_avg FROM public.workouts
    WHERE user_id = v_uid AND performed_at >= now() - interval '28 days';
  SELECT COALESCE(SUM(amount)::int,0) INTO v_xp_avg FROM public.xp_history
    WHERE user_id = v_uid AND amount > 0 AND created_at >= now() - interval '28 days';
  v_objectives := jsonb_build_array(
    jsonb_build_object('key','missions','label','Concluir missões','target', GREATEST(5, (v_missions_avg/4)+2), 'current', 0),
    jsonb_build_object('key','workouts','label','Treinar','target', GREATEST(3, (v_workouts_avg/4)+1), 'current', 0),
    jsonb_build_object('key','xp','label','Ganhar XP','target', GREATEST(200, (v_xp_avg/4)+100), 'current', 0),
    jsonb_build_object('key','no_relapse','label','Sem recaídas','target', 1, 'current', 0)
  );
  v_reward := GREATEST(300, (v_xp_avg/2)+200);
  INSERT INTO public.weekly_bosses(user_id, week_start, name, description, icon, objectives, xp_reward)
  VALUES (v_uid, v_week_start, 'Boss da Semana',
    'Complete todos os objetivos até domingo para derrotá-lo.', '👹', v_objectives, v_reward)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_weekly_boss_progress()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_week_start date := date_trunc('week', CURRENT_DATE)::date;
  v_boss public.weekly_bosses;
  v_missions int; v_workouts int; v_xp int; v_relapses int;
  v_new jsonb := '[]'::jsonb; v_all_done boolean := true;
  v_o jsonb; v_current int; v_target int;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_boss FROM public.weekly_bosses WHERE user_id = v_uid AND week_start = v_week_start;
  IF NOT FOUND THEN
    PERFORM public.generate_weekly_boss(v_uid);
    SELECT * INTO v_boss FROM public.weekly_bosses WHERE user_id = v_uid AND week_start = v_week_start;
  END IF;
  SELECT COUNT(*) INTO v_missions FROM public.tasks
    WHERE user_id = v_uid AND completed = true AND completed_at >= v_week_start;
  SELECT COUNT(*) INTO v_workouts FROM public.workouts
    WHERE user_id = v_uid AND performed_at >= v_week_start;
  SELECT COALESCE(SUM(amount),0) INTO v_xp FROM public.xp_history
    WHERE user_id = v_uid AND amount > 0 AND created_at >= v_week_start;
  SELECT COUNT(*) INTO v_relapses FROM public.bad_habit_relapses
    WHERE user_id = v_uid AND relapsed_at >= v_week_start;
  FOR v_o IN SELECT * FROM jsonb_array_elements(v_boss.objectives) LOOP
    v_target := (v_o->>'target')::int;
    v_current := CASE v_o->>'key'
      WHEN 'missions' THEN v_missions
      WHEN 'workouts' THEN v_workouts
      WHEN 'xp' THEN v_xp
      WHEN 'no_relapse' THEN CASE WHEN v_relapses = 0 THEN 1 ELSE 0 END
      ELSE 0 END;
    IF v_current < v_target THEN v_all_done := false; END IF;
    v_new := v_new || jsonb_build_array(v_o || jsonb_build_object('current', v_current));
  END LOOP;
  IF v_all_done AND v_boss.status = 'active' THEN
    UPDATE public.weekly_bosses SET status = 'completed', completed_at = now(), defeated_at = now(),
      updated_at = now(), objectives = v_new WHERE id = v_boss.id;
    PERFORM public._award_xp_for_user(v_uid, v_boss.xp_reward, 'boss:'||v_boss.id::text, 'disciplina'::public.skill_category, NULL);
    PERFORM public.record_timeline(v_uid, 'boss:'||v_boss.id::text, 'boss',
      'Boss derrotado', v_boss.name||' completo — +'||v_boss.xp_reward||' XP', '⚔️');
    INSERT INTO public.inventory_items(user_id, item_key, kind, name, description, icon, rarity)
    VALUES (v_uid, 'boss:'||v_boss.id::text, 'medal', 'Medalha do Boss', v_boss.name, '🏵️', 'epic')
    ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.weekly_bosses SET objectives = v_new, updated_at = now() WHERE id = v_boss.id;
  END IF;
  RETURN jsonb_build_object(
    'id', v_boss.id, 'name', v_boss.name, 'description', v_boss.description,
    'icon', v_boss.icon, 'status', COALESCE((SELECT status FROM public.weekly_bosses WHERE id = v_boss.id), 'active'),
    'xp_reward', v_boss.xp_reward, 'week_start', v_boss.week_start, 'objectives', v_new);
END $$;

CREATE OR REPLACE FUNCTION public.complete_focus_session(p_id uuid, p_actual_seconds integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_session public.focus_sessions; v_xp int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_session FROM public.focus_sessions WHERE id = p_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
  IF v_session.completed THEN RETURN v_session.xp_awarded; END IF;
  v_xp := GREATEST(5, floor(p_actual_seconds / 60.0)::int);
  UPDATE public.focus_sessions SET actual_seconds = p_actual_seconds, completed = true,
    ended_at = now(), xp_awarded = v_xp WHERE id = p_id;
  PERFORM public._award_xp_for_user(v_uid, v_xp, 'focus:'||p_id::text, COALESCE(v_session.skill_category, 'disciplina'::public.skill_category), NULL);
  RETURN v_xp;
END $$;

CREATE OR REPLACE FUNCTION public.get_day_detail(p_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_xp int; v_missions int; v_workouts int; v_sleep numeric; v_focus_min int;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_xp FROM public.xp_history WHERE user_id = v_uid AND date(created_at) = p_date;
  SELECT COUNT(*) INTO v_missions FROM public.tasks WHERE user_id = v_uid AND completed = true AND date(completed_at) = p_date;
  SELECT COUNT(*) INTO v_workouts FROM public.workouts WHERE user_id = v_uid AND date(performed_at) = p_date;
  SELECT COALESCE(AVG(sleep_hours),0) INTO v_sleep FROM public.health_logs WHERE user_id = v_uid AND log_date = p_date;
  SELECT COALESCE(SUM(actual_seconds)/60,0) INTO v_focus_min FROM public.focus_sessions
    WHERE user_id = v_uid AND date(started_at) = p_date AND completed = true;
  RETURN jsonb_build_object('date', p_date, 'xp', v_xp, 'missions', v_missions,
    'workouts', v_workouts, 'sleep_hours', v_sleep, 'focus_minutes', v_focus_min);
END $$;

CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid),
    'skills', (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.skills s WHERE s.user_id = v_uid),
    'xp_30d', (SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date(created_at), 'amount', amount, 'source', source, 'hour', EXTRACT(HOUR FROM created_at))), '[]'::jsonb)
               FROM public.xp_history WHERE user_id = v_uid AND created_at >= now() - interval '30 days'),
    'missions_30d', (SELECT COUNT(*) FROM public.tasks WHERE user_id = v_uid AND completed = true AND completed_at >= now() - interval '30 days'),
    'workouts_30d', (SELECT COUNT(*) FROM public.workouts WHERE user_id = v_uid AND performed_at >= now() - interval '30 days'),
    'books_total', (SELECT COUNT(*) FROM public.library_items WHERE user_id = v_uid AND completed = true),
    'sleep_avg_30d', (SELECT COALESCE(AVG(sleep_hours),0) FROM public.health_logs WHERE user_id = v_uid AND log_date >= CURRENT_DATE - 30),
    'focus_min_30d', (SELECT COALESCE(SUM(actual_seconds)/60,0) FROM public.focus_sessions WHERE user_id = v_uid AND completed = true AND started_at >= now() - interval '30 days'),
    'habits', (SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb) FROM public.habits h WHERE h.user_id = v_uid),
    'bad_habits', (SELECT COALESCE(jsonb_agg(to_jsonb(b)), '[]'::jsonb) FROM public.bad_habits b WHERE b.user_id = v_uid AND b.archived_at IS NULL),
    'finance_balance', (SELECT COALESCE(SUM(CASE WHEN kind='receita' THEN amount ELSE -amount END),0) FROM public.finance_transactions WHERE user_id = v_uid),
    'life_score', COALESCE((SELECT life_score FROM public.profiles WHERE id = v_uid), 0),
    'rank', COALESCE((SELECT current_rank FROM public.profiles WHERE id = v_uid), 'beginner'),
    'titles', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.user_titles t WHERE t.user_id = v_uid)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.get_activity_heatmap(p_year integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_year int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_start date := make_date(v_year, 1, 1);
  v_end date := make_date(v_year, 12, 31);
  v_data jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d, 'xp', COALESCE(x, 0))), '[]'::jsonb) INTO v_data
  FROM (
    SELECT date(created_at) AS d, SUM(amount) AS x FROM public.xp_history
    WHERE user_id = v_uid AND date(created_at) BETWEEN v_start AND v_end AND amount > 0
    GROUP BY date(created_at)
  ) q;
  RETURN v_data;
END $$;

CREATE OR REPLACE FUNCTION public.recalc_xp()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_total int; v_level int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT GREATEST(0, COALESCE(SUM(amount),0))::int INTO v_total FROM public.xp_history WHERE user_id = v_uid;
  v_level := GREATEST(1, floor(sqrt(v_total / 50.0))::int + 1);
  UPDATE public.profiles SET total_xp = v_total, xp = v_total, level = v_level, updated_at = now() WHERE id = v_uid;
  UPDATE public.skills s SET total_xp = COALESCE(a.tot,0), xp = COALESCE(a.tot,0),
    level = GREATEST(1, floor(sqrt(GREATEST(0, COALESCE(a.tot,0)) / 30.0))::int + 1)
  FROM (
    SELECT s2.id, COALESCE(SUM(h.amount),0)::int AS tot
    FROM public.skills s2
    LEFT JOIN public.xp_history h ON h.user_id = s2.user_id
      AND (h.custom_skill_id = s2.id OR (s2.category IS NOT NULL AND h.skill_category = s2.category))
    WHERE s2.user_id = v_uid GROUP BY s2.id
  ) a WHERE s.id = a.id;
END $$;

REVOKE ALL ON FUNCTION public.record_timeline(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_title(uuid, text, text, text, text, public.item_rarity) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bad_habits_touch_updated() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xp_history_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.achievements_timeline() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bad_habit_relapse(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bad_habit_sync_awards() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calc_life_score(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_all_titles(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_rank(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_life_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.equip_title(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.project_future(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_weekly_boss(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_weekly_boss_progress() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_focus_session(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_day_detail(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_activity_heatmap(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalc_xp() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.bad_habit_relapse(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bad_habit_sync_awards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_life_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_all_titles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rank(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_life_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_title(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_future(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_weekly_boss(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_boss_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_focus_session(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_day_detail(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_heatmap(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_xp() TO authenticated;
