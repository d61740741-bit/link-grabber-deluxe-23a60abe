CREATE TYPE public.skill_category AS ENUM ('mente','corpo','conhecimento','financas','disciplina','social');
CREATE TYPE public.task_category AS ENUM ('estudo','treino','leitura','meditacao','nutricao','financas','habito','outro');
CREATE TYPE public.transaction_kind AS ENUM ('receita','despesa');
CREATE TYPE public.library_category AS ENUM ('psicologia','filosofia','financas','programacao','negocios','saude','nutricao','exercicio','sobrevivencia','primeiros_socorros');
CREATE TYPE public.library_item_type AS ENUM ('artigo','livro');
CREATE TYPE public.bad_habit_difficulty AS ENUM ('easy','medium','hard');
CREATE TYPE public.bad_habit_priority AS ENUM ('low','medium','high');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text, full_name text, avatar_url text, bio text,
  level int NOT NULL DEFAULT 1, xp int NOT NULL DEFAULT 0, total_xp int NOT NULL DEFAULT 0,
  streak_days int NOT NULL DEFAULT 0, last_active_date date,
  goals text, theme text NOT NULL DEFAULT 'dark', notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.skill_category,
  display_name text, icon text, color text,
  is_custom boolean NOT NULL DEFAULT false,
  custom_slug text,
  level int NOT NULL DEFAULT 1, xp int NOT NULL DEFAULT 0, total_xp int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skills_kind_check CHECK ((is_custom = false AND category IS NOT NULL AND custom_slug IS NULL) OR (is_custom = true AND category IS NULL AND custom_slug IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own skills" ON public.skills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX skills_user_category_uniq ON public.skills(user_id, category) WHERE category IS NOT NULL;
CREATE UNIQUE INDEX skills_user_custom_slug_uniq ON public.skills(user_id, custom_slug) WHERE custom_slug IS NOT NULL;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, description text,
  category public.task_category NOT NULL DEFAULT 'outro',
  skill_category public.skill_category,
  custom_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  xp_reward int NOT NULL DEFAULT 10,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz, due_date date,
  xp_awarded boolean NOT NULL DEFAULT false,
  xp_granted int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tasks_user_due_idx ON public.tasks(user_id, due_date);
CREATE INDEX tasks_custom_skill_id_idx ON public.tasks(custom_skill_id);

CREATE TABLE public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category public.task_category NOT NULL DEFAULT 'habito',
  skill_category public.skill_category,
  xp_reward int NOT NULL DEFAULT 5,
  streak int NOT NULL DEFAULT 0, best_streak int NOT NULL DEFAULT 0,
  last_completed_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits" ON public.habits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.xp_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount int NOT NULL, source text NOT NULL,
  source_key text,
  skill_category public.skill_category,
  custom_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_history TO authenticated;
GRANT ALL ON public.xp_history TO service_role;
ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own xp" ON public.xp_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX xp_history_user_date_idx ON public.xp_history(user_id, created_at DESC);
CREATE UNIQUE INDEX xp_history_user_source_key_uniq ON public.xp_history(user_id, source_key) WHERE source_key IS NOT NULL;
CREATE INDEX xp_history_custom_skill_id_idx ON public.xp_history(custom_skill_id);

CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key text NOT NULL, name text NOT NULL, description text, icon text,
  unlocked_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, badge_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own achievements" ON public.achievements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.journal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, mood int, thoughts text, gratitude text, lessons text, goals_today text, entry_date date NOT NULL DEFAULT CURRENT_DATE, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated; GRANT ALL ON public.journal_entries TO service_role; ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY; CREATE POLICY "own journal" ON public.journal_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.workouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, workout_type text NOT NULL, duration_min int NOT NULL DEFAULT 0, intensity text, notes text, calories_burned int, performed_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated; GRANT ALL ON public.workouts TO service_role; ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY; CREATE POLICY "own workouts" ON public.workouts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.workout_exercises (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, name text NOT NULL, sets int NOT NULL DEFAULT 0, reps int NOT NULL DEFAULT 0, weight_kg numeric(6,2), position int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated; GRANT ALL ON public.workout_exercises TO service_role; ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY; CREATE POLICY "own workout exercises" ON public.workout_exercises FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.health_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, log_date date NOT NULL DEFAULT CURRENT_DATE, weight_kg numeric(6,2), sleep_hours numeric(4,2), mood int, water_ml int, calories int, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, log_date));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_logs TO authenticated; GRANT ALL ON public.health_logs TO service_role; ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY; CREATE POLICY "own health" ON public.health_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, kind public.transaction_kind NOT NULL, amount numeric(12,2) NOT NULL, category text, description text, occurred_on date NOT NULL DEFAULT CURRENT_DATE, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated; GRANT ALL ON public.finance_transactions TO service_role; ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY; CREATE POLICY "own finance" ON public.finance_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.goals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, area text NOT NULL, title text NOT NULL, description text, target_value numeric, current_value numeric DEFAULT 0, unit text, deadline date, completed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated; GRANT ALL ON public.goals TO service_role; ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY; CREATE POLICY "own goals" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.library_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, title text NOT NULL, author text, url text, cover_url text, category public.library_category NOT NULL, item_type public.library_item_type NOT NULL DEFAULT 'artigo', total_pages int, current_page int, progress int NOT NULL DEFAULT 0, favorite boolean NOT NULL DEFAULT false, completed boolean NOT NULL DEFAULT false, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated; GRANT ALL ON public.library_items TO service_role; ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY; CREATE POLICY "own library" ON public.library_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.bad_habits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, name text NOT NULL, icon text NOT NULL DEFAULT '🚫', color text NOT NULL DEFAULT '#ef4444', difficulty public.bad_habit_difficulty NOT NULL DEFAULT 'medium', priority public.bad_habit_priority NOT NULL DEFAULT 'medium', motivation text, goal_date date, started_at timestamptz NOT NULL DEFAULT now(), best_streak_seconds bigint NOT NULL DEFAULT 0, total_clean_seconds bigint NOT NULL DEFAULT 0, relapse_count int NOT NULL DEFAULT 0, last_awarded_day int NOT NULL DEFAULT 0, archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bad_habits TO authenticated; GRANT ALL ON public.bad_habits TO service_role; ALTER TABLE public.bad_habits ENABLE ROW LEVEL SECURITY; CREATE POLICY "own bad_habits" ON public.bad_habits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.bad_habit_relapses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, bad_habit_id uuid NOT NULL REFERENCES public.bad_habits(id) ON DELETE CASCADE, relapsed_at timestamptz NOT NULL DEFAULT now(), streak_seconds bigint NOT NULL DEFAULT 0, note text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bad_habit_relapses TO authenticated; GRANT ALL ON public.bad_habit_relapses TO service_role; ALTER TABLE public.bad_habit_relapses ENABLE ROW LEVEL SECURITY; CREATE POLICY "own bad_habit_relapses" ON public.bad_habit_relapses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.recovery_missions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, bad_habit_id uuid REFERENCES public.bad_habits(id) ON DELETE CASCADE, title text NOT NULL, description text, xp_reward int NOT NULL DEFAULT 5, mission_date date NOT NULL DEFAULT CURRENT_DATE, completed boolean NOT NULL DEFAULT false, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_missions TO authenticated; GRANT ALL ON public.recovery_missions TO service_role; ALTER TABLE public.recovery_missions ENABLE ROW LEVEL SECURITY; CREATE POLICY "own recovery_missions" ON public.recovery_missions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.skills (user_id, category) SELECT NEW.id, c FROM unnest(ARRAY['mente','corpo','conhecimento','financas','disciplina','social']::public.skill_category[]) c;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public._compute_task_xp(p_user_id uuid, p_base int, p_completed_at timestamptz) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_done_today int; v_hour int; v_bonus_pct numeric := 0; v_flat int := 0; v_when timestamptz := COALESCE(p_completed_at, now());
BEGIN
  SELECT count(*) INTO v_done_today FROM public.tasks WHERE user_id = p_user_id AND completed = true AND completed_at IS NOT NULL AND date(completed_at) = date(v_when) AND completed_at <= v_when;
  IF v_done_today <= 1 THEN v_bonus_pct := 0.10; ELSIF v_done_today = 2 THEN v_bonus_pct := 0.05; ELSIF v_done_today = 3 THEN v_bonus_pct := 0.10; ELSIF v_done_today = 4 THEN v_bonus_pct := 0.20; ELSE v_bonus_pct := 0.30; END IF;
  v_hour := EXTRACT(HOUR FROM v_when); IF v_hour < 6 THEN v_flat := v_flat - 5; ELSIF v_hour < 12 THEN v_flat := v_flat + 5; END IF;
  RETURN GREATEST(0, round(COALESCE(p_base,0) * (1 + v_bonus_pct))::int + v_flat);
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_xp(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int := 0; v_level int := 1; v_last date; v_streak int := 0; v_cursor date;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.xp_history WHERE user_id = p_user_id;
  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, custom_skill_id, task_id, created_at)
  SELECT user_id, public._compute_task_xp(user_id, xp_reward, completed_at), 'task', 'task:'||id::text, skill_category, custom_skill_id, id, COALESCE(completed_at, created_at, now()) FROM public.tasks WHERE user_id = p_user_id AND completed = true;
  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT user_id, GREATEST(0, COALESCE(xp_reward,0) * GREATEST(COALESCE(best_streak, streak, 0), COALESCE(streak,0), CASE WHEN last_completed_date IS NULL THEN 0 ELSE 1 END)), 'habit', 'habit:'||id::text, skill_category, COALESCE(last_completed_date::timestamptz, created_at, now()) FROM public.habits WHERE user_id = p_user_id AND last_completed_date IS NOT NULL;
  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT w.user_id, GREATEST(0, round(COALESCE(w.duration_min,0)*0.8)::int + COALESCE(ex.c,0)*5), 'workout', 'workout:'||w.id::text, 'corpo'::public.skill_category, COALESCE(w.performed_at, now()) FROM public.workouts w LEFT JOIN (SELECT workout_id, count(*)::int c FROM public.workout_exercises WHERE user_id=p_user_id GROUP BY workout_id) ex ON ex.workout_id=w.id WHERE w.user_id=p_user_id;
  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at) SELECT user_id, 10, 'finance', 'finance:'||id::text, 'financas'::public.skill_category, COALESCE(occurred_on::timestamptz, created_at, now()) FROM public.finance_transactions WHERE user_id=p_user_id;
  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at) SELECT user_id, 15, 'journal', 'journal:'||id::text, 'mente'::public.skill_category, COALESCE(entry_date::timestamptz, created_at, now()) FROM public.journal_entries WHERE user_id=p_user_id;
  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at) SELECT user_id, CASE WHEN item_type::text='livro' THEN 50 ELSE 25 END, 'library', 'library:'||id::text, 'conhecimento'::public.skill_category, COALESCE(updated_at, created_at, now()) FROM public.library_items WHERE user_id=p_user_id AND completed=true;
  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at) SELECT user_id, GREATEST(0, COALESCE(xp_reward,0)), 'recovery_mission', 'recovery_mission:'||id::text, 'disciplina'::public.skill_category, COALESCE(completed_at, mission_date::timestamptz, created_at, now()) FROM public.recovery_missions WHERE user_id=p_user_id AND completed=true;
  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at) SELECT user_id, GREATEST(0, (CASE difficulty::text WHEN 'easy' THEN 5 WHEN 'medium' THEN 8 ELSE 12 END) * GREATEST(0, floor(EXTRACT(EPOCH FROM (now()-started_at))/86400)::int)), 'recovery', 'recovery:'||id::text, 'disciplina'::public.skill_category, COALESCE(started_at, created_at, now()) FROM public.bad_habits WHERE user_id=p_user_id AND archived_at IS NULL AND GREATEST(0, floor(EXTRACT(EPOCH FROM (now()-started_at))/86400)::int)>0;
  SELECT COALESCE(SUM(amount),0)::int INTO v_total FROM public.xp_history WHERE user_id=p_user_id; v_total := GREATEST(0, v_total); v_level := GREATEST(1, floor(sqrt(v_total/50.0))::int + 1);
  SELECT max(date(created_at)) INTO v_last FROM public.xp_history WHERE user_id=p_user_id AND amount>0;
  IF v_last IS NOT NULL AND v_last >= CURRENT_DATE - 1 THEN v_cursor := v_last; LOOP IF EXISTS (SELECT 1 FROM public.xp_history WHERE user_id=p_user_id AND amount>0 AND date(created_at)=v_cursor) THEN v_streak := v_streak + 1; v_cursor := v_cursor - 1; ELSE EXIT; END IF; END LOOP; END IF;
  UPDATE public.profiles SET total_xp=v_total, xp=v_total, level=v_level, streak_days=v_streak, last_active_date=v_last, updated_at=now() WHERE id=p_user_id;
  UPDATE public.skills s SET total_xp=COALESCE(a.tot,0), xp=COALESCE(a.tot,0), level=GREATEST(1, floor(sqrt(GREATEST(0,COALESCE(a.tot,0))/30.0))::int+1) FROM (SELECT s2.id, COALESCE(SUM(h.amount),0)::int tot FROM public.skills s2 LEFT JOIN public.xp_history h ON h.user_id=s2.user_id AND (h.custom_skill_id=s2.id OR (s2.category IS NOT NULL AND h.skill_category=s2.category)) WHERE s2.user_id=p_user_id GROUP BY s2.id) a WHERE s.id=a.id;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_xp(uuid) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.recalculate_xp(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recalculate_xp() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_uid uuid := auth.uid(); BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF; PERFORM public.recalculate_xp(v_uid); END $$;
CREATE OR REPLACE FUNCTION public.recalc_xp() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN PERFORM public.recalculate_xp(); END $$;
GRANT EXECUTE ON FUNCTION public.recalculate_xp() TO authenticated; GRANT EXECUTE ON FUNCTION public.recalc_xp() TO authenticated;

CREATE OR REPLACE FUNCTION public.award_xp(p_amount integer, p_source text, p_skill public.skill_category DEFAULT NULL, p_custom_skill_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_uid uuid := auth.uid(); BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF; PERFORM public.recalculate_xp(v_uid); END $$;
GRANT EXECUTE ON FUNCTION public.award_xp(integer, text, public.skill_category, uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.award_xp(p_amount integer, p_source text, p_skill public.skill_category DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_uid uuid := auth.uid(); BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF; PERFORM public.recalculate_xp(v_uid); END $$;
GRANT EXECUTE ON FUNCTION public.award_xp(integer, text, public.skill_category) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_habit_today(p_habit_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE v_uid uuid := auth.uid(); v_habit public.habits; v_new_streak int; BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF; SELECT * INTO v_habit FROM public.habits WHERE id=p_habit_id AND user_id=v_uid; IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF; IF v_habit.last_completed_date=CURRENT_DATE THEN PERFORM public.recalculate_xp(v_uid); RETURN; END IF; IF v_habit.last_completed_date=CURRENT_DATE-1 THEN v_new_streak:=v_habit.streak+1; ELSE v_new_streak:=1; END IF; UPDATE public.habits SET streak=v_new_streak,best_streak=GREATEST(best_streak,v_new_streak),last_completed_date=CURRENT_DATE WHERE id=p_habit_id; PERFORM public.recalculate_xp(v_uid); END $$;
GRANT EXECUTE ON FUNCTION public.complete_habit_today(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_xp_after_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN PERFORM public.recalculate_xp(COALESCE(NEW.user_id, OLD.user_id)); RETURN COALESCE(NEW, OLD); END $$;
CREATE TRIGGER trg_recalculate_xp_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_habits AFTER INSERT OR UPDATE OR DELETE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_workouts AFTER INSERT OR UPDATE OR DELETE ON public.workouts FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_workout_exercises AFTER INSERT OR UPDATE OR DELETE ON public.workout_exercises FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_finance AFTER INSERT OR UPDATE OR DELETE ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_journal AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_library AFTER INSERT OR UPDATE OR DELETE ON public.library_items FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_recovery_missions AFTER INSERT OR UPDATE OR DELETE ON public.recovery_missions FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();
CREATE TRIGGER trg_recalculate_xp_bad_habits AFTER INSERT OR UPDATE OR DELETE ON public.bad_habits FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();