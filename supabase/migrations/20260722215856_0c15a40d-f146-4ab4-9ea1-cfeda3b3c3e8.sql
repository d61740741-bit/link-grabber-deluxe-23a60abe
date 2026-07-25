
-- ENUMs
CREATE TYPE public.skill_category AS ENUM ('mente','corpo','conhecimento','financas','disciplina','social');
CREATE TYPE public.task_category AS ENUM ('estudo','treino','leitura','meditacao','nutricao','financas','habito','outro');
CREATE TYPE public.transaction_kind AS ENUM ('receita','despesa');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT, full_name TEXT, avatar_url TEXT, bio TEXT,
  level INT NOT NULL DEFAULT 1, xp INT NOT NULL DEFAULT 0,
  total_xp INT NOT NULL DEFAULT 0, streak_days INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.skill_category NOT NULL,
  level INT NOT NULL DEFAULT 1, xp INT NOT NULL DEFAULT 0, total_xp INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own skills" ON public.skills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  category public.task_category NOT NULL DEFAULT 'outro',
  skill_category public.skill_category,
  xp_reward INT NOT NULL DEFAULT 10,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ, due_date DATE,
  xp_awarded boolean NOT NULL DEFAULT false,
  xp_granted int NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tasks_user_due_idx ON public.tasks(user_id, due_date);

CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category public.task_category NOT NULL DEFAULT 'habito',
  skill_category public.skill_category,
  xp_reward INT NOT NULL DEFAULT 5,
  streak INT NOT NULL DEFAULT 0, best_streak INT NOT NULL DEFAULT 0,
  last_completed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO authenticated;
GRANT ALL ON public.habits TO service_role;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits" ON public.habits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.xp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL, source TEXT NOT NULL,
  skill_category public.skill_category,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_history TO authenticated;
GRANT ALL ON public.xp_history TO service_role;
ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own xp" ON public.xp_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX xp_history_user_date_idx ON public.xp_history(user_id, created_at DESC);
CREATE INDEX xp_history_task_id_idx ON public.xp_history(task_id);
CREATE INDEX xp_history_user_id_idx ON public.xp_history(user_id);

CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL, name TEXT NOT NULL, description TEXT, icon TEXT,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own achievements" ON public.achievements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood INT, thoughts TEXT, gratitude TEXT, lessons TEXT, goals_today TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own journal" ON public.journal_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_type TEXT NOT NULL,
  duration_min INT NOT NULL DEFAULT 0,
  intensity TEXT, notes TEXT,
  calories_burned INT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workouts" ON public.workouts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(6,2), sleep_hours NUMERIC(4,2),
  mood INT, water_ml INT, calories INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_logs TO authenticated;
GRANT ALL ON public.health_logs TO service_role;
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own health" ON public.health_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.transaction_kind NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT, description TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated;
GRANT ALL ON public.finance_transactions TO service_role;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own finance" ON public.finance_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  target_value NUMERIC, current_value NUMERIC DEFAULT 0,
  unit TEXT, deadline DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TYPE public.library_category AS ENUM ('psicologia','filosofia','financas','programacao','negocios','saude','nutricao','exercicio','sobrevivencia','primeiros_socorros');
CREATE TYPE public.library_item_type AS ENUM ('artigo','livro');

CREATE TABLE public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, author TEXT, url TEXT, cover_url TEXT,
  category public.library_category NOT NULL,
  item_type public.library_item_type NOT NULL DEFAULT 'artigo',
  total_pages INT, current_page INT,
  progress INT NOT NULL DEFAULT 0,
  favorite BOOLEAN NOT NULL DEFAULT false,
  completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own library" ON public.library_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX library_items_user_idx ON public.library_items(user_id, favorite DESC, created_at DESC);

CREATE TABLE public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INT NOT NULL DEFAULT 0, reps INT NOT NULL DEFAULT 0,
  weight_kg NUMERIC(6,2), position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout exercises" ON public.workout_exercises FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX workout_exercises_workout_idx ON public.workout_exercises(workout_id, position);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.skills (user_id, category)
  SELECT NEW.id, c FROM unnest(ARRAY['mente','corpo','conhecimento','financas','disciplina','social']::public.skill_category[]) c;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public._award_xp_for_user(p_user_id uuid, p_amount int, p_source text, p_skill public.skill_category DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN RETURN; END IF;
  INSERT INTO public.xp_history (user_id, amount, source, skill_category)
  VALUES (p_user_id, p_amount, p_source, p_skill);
  UPDATE public.profiles
    SET total_xp = total_xp + p_amount,
        xp = xp + p_amount,
        level = GREATEST(1, floor(sqrt((total_xp + p_amount) / 50.0))::int + 1),
        streak_days = CASE
          WHEN last_active_date IS NULL THEN 1
          WHEN last_active_date = CURRENT_DATE THEN streak_days
          WHEN last_active_date = CURRENT_DATE - 1 THEN streak_days + 1
          ELSE 1
        END,
        last_active_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = p_user_id;
  IF p_skill IS NOT NULL THEN
    UPDATE public.skills
      SET total_xp = total_xp + p_amount,
          xp = xp + p_amount,
          level = GREATEST(1, floor(sqrt((total_xp + p_amount) / 30.0))::int + 1)
      WHERE user_id = p_user_id AND category = p_skill;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public._refund_xp_for_user(p_user_id uuid, p_amount int, p_skill public.skill_category DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN RETURN; END IF;
  INSERT INTO public.xp_history (user_id, amount, source, skill_category)
    VALUES (p_user_id, -p_amount, 'refund', p_skill);
  UPDATE public.profiles
    SET total_xp = GREATEST(0, total_xp - p_amount),
        xp      = GREATEST(0, xp - p_amount),
        level   = GREATEST(1, floor(sqrt(GREATEST(0, total_xp - p_amount) / 50.0))::int + 1),
        updated_at = now()
    WHERE id = p_user_id;
  IF p_skill IS NOT NULL THEN
    UPDATE public.skills
      SET total_xp = GREATEST(0, total_xp - p_amount),
          xp       = GREATEST(0, xp - p_amount),
          level    = GREATEST(1, floor(sqrt(GREATEST(0, total_xp - p_amount) / 30.0))::int + 1)
      WHERE user_id = p_user_id AND category = p_skill;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public._compute_task_xp(p_user_id uuid, p_base int, p_completed_at timestamptz)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_done_today int; v_hour int; v_bonus_pct numeric := 0; v_flat int := 0;
  v_when timestamptz := COALESCE(p_completed_at, now());
BEGIN
  SELECT count(*) INTO v_done_today FROM public.tasks
    WHERE user_id = p_user_id AND completed = true
      AND completed_at IS NOT NULL AND date(completed_at) = date(v_when);
  IF v_done_today <= 1 THEN v_bonus_pct := 0.10;
  ELSIF v_done_today = 2 THEN v_bonus_pct := 0.05;
  ELSIF v_done_today = 3 THEN v_bonus_pct := 0.10;
  ELSIF v_done_today = 4 THEN v_bonus_pct := 0.20;
  ELSE v_bonus_pct := 0.30; END IF;
  v_hour := EXTRACT(HOUR FROM v_when);
  IF v_hour < 6 THEN v_flat := v_flat - 5;
  ELSIF v_hour < 12 THEN v_flat := v_flat + 5; END IF;
  RETURN GREATEST(0, round(p_base * (1 + v_bonus_pct))::int + v_flat);
END; $$;

CREATE OR REPLACE FUNCTION public.award_xp(p_amount int, p_source text, p_skill public.skill_category DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public._award_xp_for_user(v_uid, p_amount, p_source, p_skill);
END; $$;

CREATE OR REPLACE FUNCTION public.tasks_auto_award() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed = true AND COALESCE(OLD.completed, false) = false AND NEW.xp_awarded = false THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.xp_awarded := true;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tasks_insert_award() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed = true AND NEW.xp_awarded = false THEN
    NEW.xp_awarded := true;
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tasks_after_award() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_final int; v_pending int;
BEGIN
  IF NEW.xp_awarded = true AND COALESCE(OLD.xp_awarded, false) = false THEN
    v_final := public._compute_task_xp(NEW.user_id, NEW.xp_reward, NEW.completed_at);
    PERFORM public._award_xp_for_user(NEW.user_id, v_final, 'task', NEW.skill_category);
    UPDATE public.tasks SET xp_granted = v_final WHERE id = NEW.id;
    SELECT count(*) INTO v_pending FROM public.tasks
      WHERE user_id = NEW.user_id AND completed = false AND due_date = CURRENT_DATE;
    IF v_pending = 0 AND NOT EXISTS (
      SELECT 1 FROM public.xp_history
      WHERE user_id = NEW.user_id AND source = 'perfect_day' AND date(created_at) = CURRENT_DATE
    ) THEN
      PERFORM public._award_xp_for_user(NEW.user_id, 25, 'perfect_day', NULL);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tasks_after_insert_award() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_final int; v_pending int;
BEGIN
  IF NEW.xp_awarded = true THEN
    v_final := public._compute_task_xp(NEW.user_id, NEW.xp_reward, NEW.completed_at);
    PERFORM public._award_xp_for_user(NEW.user_id, v_final, 'task', NEW.skill_category);
    UPDATE public.tasks SET xp_granted = v_final WHERE id = NEW.id;
    SELECT count(*) INTO v_pending FROM public.tasks
      WHERE user_id = NEW.user_id AND completed = false AND due_date = CURRENT_DATE;
    IF v_pending = 0 AND NOT EXISTS (
      SELECT 1 FROM public.xp_history
      WHERE user_id = NEW.user_id AND source = 'perfect_day' AND date(created_at) = CURRENT_DATE
    ) THEN
      PERFORM public._award_xp_for_user(NEW.user_id, 25, 'perfect_day', NULL);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tasks_before_delete_refund() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.xp_awarded = true AND OLD.xp_granted > 0 THEN
    PERFORM public._refund_xp_for_user(OLD.user_id, OLD.xp_granted, OLD.skill_category);
  END IF;
  RETURN OLD;
END; $$;

CREATE TRIGGER trg_tasks_auto_award BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_auto_award();
CREATE TRIGGER trg_tasks_after_award AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_after_award();
CREATE TRIGGER trg_tasks_insert_award BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_insert_award();
CREATE TRIGGER trg_tasks_after_insert_award AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_after_insert_award();
CREATE TRIGGER trg_tasks_before_delete_refund BEFORE DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_before_delete_refund();

CREATE OR REPLACE FUNCTION public.complete_habit_today(p_habit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_habit public.habits; v_new_streak int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_habit FROM public.habits WHERE id = p_habit_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF v_habit.last_completed_date = CURRENT_DATE THEN RETURN; END IF;
  IF v_habit.last_completed_date = CURRENT_DATE - 1 THEN
    v_new_streak := v_habit.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;
  UPDATE public.habits
    SET streak = v_new_streak,
        best_streak = GREATEST(best_streak, v_new_streak),
        last_completed_date = CURRENT_DATE
    WHERE id = p_habit_id;
  PERFORM public._award_xp_for_user(v_uid, v_habit.xp_reward, 'habit', v_habit.skill_category);
END; $$;

REVOKE ALL ON FUNCTION public._award_xp_for_user(uuid, integer, text, public.skill_category) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._refund_xp_for_user(uuid, integer, public.skill_category) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._compute_task_xp(uuid, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_auto_award() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_after_award() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_insert_award() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_after_insert_award() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_before_delete_refund() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_xp(integer, text, public.skill_category) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(integer, text, public.skill_category) TO authenticated;

-- Extend skills for customization
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_slug text;

ALTER TABLE public.skills ALTER COLUMN category DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skills_user_id_category_key' AND conrelid = 'public.skills'::regclass
  ) THEN
    ALTER TABLE public.skills DROP CONSTRAINT skills_user_id_category_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS skills_user_category_uniq ON public.skills(user_id, category) WHERE category IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS skills_user_custom_slug_uniq ON public.skills(user_id, custom_slug) WHERE custom_slug IS NOT NULL;

ALTER TABLE public.skills ADD CONSTRAINT skills_kind_check CHECK (
  (is_custom = false AND category IS NOT NULL AND custom_slug IS NULL) OR
  (is_custom = true  AND category IS NULL     AND custom_slug IS NOT NULL)
);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS custom_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL;

ALTER TABLE public.xp_history
  ADD COLUMN IF NOT EXISTS custom_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_custom_skill_id_idx ON public.tasks(custom_skill_id);
CREATE INDEX IF NOT EXISTS xp_history_custom_skill_id_idx ON public.xp_history(custom_skill_id);

CREATE OR REPLACE FUNCTION public._award_xp_for_user(
  p_user_id uuid,
  p_amount integer,
  p_source text,
  p_skill public.skill_category DEFAULT NULL,
  p_custom_skill_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN RETURN; END IF;
  INSERT INTO public.xp_history (user_id, amount, source, skill_category, custom_skill_id)
  VALUES (p_user_id, p_amount, p_source, p_skill, p_custom_skill_id);
  UPDATE public.profiles
    SET total_xp = total_xp + p_amount,
        xp = xp + p_amount,
        level = GREATEST(1, floor(sqrt((total_xp + p_amount) / 50.0))::int + 1),
        streak_days = CASE
          WHEN last_active_date IS NULL THEN 1
          WHEN last_active_date = CURRENT_DATE THEN streak_days
          WHEN last_active_date = CURRENT_DATE - 1 THEN streak_days + 1
          ELSE 1
        END,
        last_active_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = p_user_id;
  IF p_skill IS NOT NULL THEN
    UPDATE public.skills
      SET total_xp = total_xp + p_amount,
          xp = xp + p_amount,
          level = GREATEST(1, floor(sqrt((total_xp + p_amount) / 30.0))::int + 1)
      WHERE user_id = p_user_id AND category = p_skill;
  ELSIF p_custom_skill_id IS NOT NULL THEN
    UPDATE public.skills
      SET total_xp = total_xp + p_amount,
          xp = xp + p_amount,
          level = GREATEST(1, floor(sqrt((total_xp + p_amount) / 30.0))::int + 1)
      WHERE id = p_custom_skill_id AND user_id = p_user_id;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public._refund_xp_for_user(
  p_user_id uuid,
  p_amount integer,
  p_skill public.skill_category DEFAULT NULL,
  p_custom_skill_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN RETURN; END IF;
  INSERT INTO public.xp_history (user_id, amount, source, skill_category, custom_skill_id)
    VALUES (p_user_id, -p_amount, 'refund', p_skill, p_custom_skill_id);
  UPDATE public.profiles
    SET total_xp = GREATEST(0, total_xp - p_amount),
        xp      = GREATEST(0, xp - p_amount),
        level   = GREATEST(1, floor(sqrt(GREATEST(0, total_xp - p_amount) / 50.0))::int + 1),
        updated_at = now()
    WHERE id = p_user_id;
  IF p_skill IS NOT NULL THEN
    UPDATE public.skills
      SET total_xp = GREATEST(0, total_xp - p_amount),
          xp       = GREATEST(0, xp - p_amount),
          level    = GREATEST(1, floor(sqrt(GREATEST(0, total_xp - p_amount) / 30.0))::int + 1)
      WHERE user_id = p_user_id AND category = p_skill;
  ELSIF p_custom_skill_id IS NOT NULL THEN
    UPDATE public.skills
      SET total_xp = GREATEST(0, total_xp - p_amount),
          xp       = GREATEST(0, xp - p_amount),
          level    = GREATEST(1, floor(sqrt(GREATEST(0, total_xp - p_amount) / 30.0))::int + 1)
      WHERE id = p_custom_skill_id AND user_id = p_user_id;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.award_xp(
  p_amount integer,
  p_source text,
  p_skill public.skill_category DEFAULT NULL,
  p_custom_skill_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public._award_xp_for_user(v_uid, p_amount, p_source, p_skill, p_custom_skill_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.tasks_after_award()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_final int; v_pending int;
BEGIN
  IF NEW.xp_awarded = true AND COALESCE(OLD.xp_awarded, false) = false THEN
    v_final := public._compute_task_xp(NEW.user_id, NEW.xp_reward, NEW.completed_at);
    PERFORM public._award_xp_for_user(NEW.user_id, v_final, 'task', NEW.skill_category, NEW.custom_skill_id);
    UPDATE public.tasks SET xp_granted = v_final WHERE id = NEW.id;
    SELECT count(*) INTO v_pending FROM public.tasks
      WHERE user_id = NEW.user_id AND completed = false AND due_date = CURRENT_DATE;
    IF v_pending = 0 AND NOT EXISTS (
      SELECT 1 FROM public.xp_history
      WHERE user_id = NEW.user_id AND source = 'perfect_day' AND date(created_at) = CURRENT_DATE
    ) THEN
      PERFORM public._award_xp_for_user(NEW.user_id, 25, 'perfect_day', NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tasks_after_insert_award()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_final int; v_pending int;
BEGIN
  IF NEW.xp_awarded = true THEN
    v_final := public._compute_task_xp(NEW.user_id, NEW.xp_reward, NEW.completed_at);
    PERFORM public._award_xp_for_user(NEW.user_id, v_final, 'task', NEW.skill_category, NEW.custom_skill_id);
    UPDATE public.tasks SET xp_granted = v_final WHERE id = NEW.id;
    SELECT count(*) INTO v_pending FROM public.tasks
      WHERE user_id = NEW.user_id AND completed = false AND due_date = CURRENT_DATE;
    IF v_pending = 0 AND NOT EXISTS (
      SELECT 1 FROM public.xp_history
      WHERE user_id = NEW.user_id AND source = 'perfect_day' AND date(created_at) = CURRENT_DATE
    ) THEN
      PERFORM public._award_xp_for_user(NEW.user_id, 25, 'perfect_day', NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tasks_before_delete_refund()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.xp_awarded = true AND OLD.xp_granted > 0 THEN
    PERFORM public._refund_xp_for_user(OLD.user_id, OLD.xp_granted, OLD.skill_category, OLD.custom_skill_id);
  END IF;
  RETURN OLD;
END; $function$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='skills' AND policyname='Users manage own skills') THEN
    CREATE POLICY "Users manage own skills" ON public.skills
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

REVOKE ALL ON FUNCTION public._award_xp_for_user(uuid, integer, text, public.skill_category, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._refund_xp_for_user(uuid, integer, public.skill_category, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_xp(integer, text, public.skill_category, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(integer, text, public.skill_category, uuid) TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goals text,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.xp_history; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.skills; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.habits; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tasks','xp_history','profiles','skills','habits','achievements',
    'journal_entries','workouts','workout_exercises','health_logs',
    'finance_transactions','goals','library_items'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN others THEN NULL; END;
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
             WHEN others THEN NULL; END;
  END LOOP;
END $$;
