
DO $$ BEGIN
  CREATE TYPE public.bad_habit_difficulty AS ENUM ('easy','medium','hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bad_habit_priority AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
CREATE POLICY "own bad_habits" ON public.bad_habits FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
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
CREATE POLICY "own bad_habit_relapses" ON public.bad_habit_relapses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
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
CREATE POLICY "own recovery_missions" ON public.recovery_missions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX recovery_missions_user_date_idx ON public.recovery_missions(user_id, mission_date);

CREATE OR REPLACE FUNCTION public.bad_habits_touch_updated() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER bad_habits_touch BEFORE UPDATE ON public.bad_habits
  FOR EACH ROW EXECUTE FUNCTION public.bad_habits_touch_updated();

CREATE OR REPLACE FUNCTION public.bad_habit_relapse(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_habit public.bad_habits;
  v_streak bigint;
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
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  h RECORD;
  v_current_day int;
  v_day int;
  v_amount int;
  v_base int;
  v_weekly int;
  v_monthly int;
  v_total_days int;
  v_thresholds int[] := ARRAY[1,3,7,14,21,30,60,90,180,365,500,1000];
  v_names text[] := ARRAY['1 dia limpo','3 dias limpo','1 semana limpo','2 semanas limpo','3 semanas limpo','1 mês limpo','2 meses limpo','3 meses limpo','6 meses limpo','1 ano limpo','500 dias limpo','1000 dias limpo'];
  v_th int;
  v_key text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  FOR h IN
    SELECT id, name, difficulty, started_at, last_awarded_day
    FROM public.bad_habits
    WHERE user_id = v_uid AND archived_at IS NULL
  LOOP
    v_current_day := GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - h.started_at))/86400)::int);
    IF v_current_day <= h.last_awarded_day THEN CONTINUE; END IF;
    v_base := CASE h.difficulty WHEN 'easy' THEN 5 WHEN 'medium' THEN 8 ELSE 12 END;
    v_weekly := CASE h.difficulty WHEN 'easy' THEN 20 WHEN 'medium' THEN 35 ELSE 50 END;
    v_monthly := CASE h.difficulty WHEN 'easy' THEN 100 WHEN 'medium' THEN 200 ELSE 300 END;
    FOR v_day IN (h.last_awarded_day + 1)..LEAST(v_current_day, h.last_awarded_day + 400) LOOP
      v_amount := v_base + floor(v_day/7)::int * (CASE h.difficulty WHEN 'easy' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END);
      IF v_day % 30 = 0 THEN v_amount := v_amount + v_monthly;
      ELSIF v_day % 7 = 0 THEN v_amount := v_amount + v_weekly;
      END IF;
      PERFORM public._award_xp_for_user(v_uid, v_amount, 'recovery:'||h.id::text||':d'||v_day, 'disciplina'::public.skill_category, NULL);
    END LOOP;
    UPDATE public.bad_habits SET last_awarded_day = LEAST(v_current_day, h.last_awarded_day + 400)
    WHERE id = h.id;

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

REVOKE ALL ON FUNCTION public.bad_habits_touch_updated() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bad_habit_relapse(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bad_habit_relapse(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.bad_habit_sync_awards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bad_habit_sync_awards() TO authenticated;

DO $$ BEGIN
  CREATE UNIQUE INDEX achievements_user_badge_uniq ON public.achievements(user_id, badge_key);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
