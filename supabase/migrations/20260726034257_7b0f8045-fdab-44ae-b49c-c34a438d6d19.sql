
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.task_difficulty AS ENUM ('muito_facil','facil','media','dificil','epica','lendaria');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('baixa','normal','alta','urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('pendente','em_andamento','concluida','falhada','atrasada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.task_repeat AS ENUM ('unica','diaria','semanal','mensal','personalizada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.task_repeat_rule AS ENUM ('every_day','weekdays','weekends','specific_days','every_x_days','every_x_weeks','every_x_months','custom_date');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_min integer,
  ADD COLUMN IF NOT EXISTS difficulty public.task_difficulty NOT NULL DEFAULT 'facil',
  ADD COLUMN IF NOT EXISTS difficulty_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority public.task_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS status public.task_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS due_time time,
  ADD COLUMN IF NOT EXISTS reminder_minutes integer,
  ADD COLUMN IF NOT EXISTS penalty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS penalty_xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_kind public.task_repeat NOT NULL DEFAULT 'unica',
  ADD COLUMN IF NOT EXISTS repeat_rule public.task_repeat_rule,
  ADD COLUMN IF NOT EXISTS repeat_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS repeat_weekdays smallint[],
  ADD COLUMN IF NOT EXISTS repeat_until date,
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS last_generated_date date,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_spent_min integer;

CREATE INDEX IF NOT EXISTS tasks_template_idx ON public.tasks(template_id);
CREATE INDEX IF NOT EXISTS tasks_user_status_idx ON public.tasks(user_id, status);

UPDATE public.tasks SET status = 'concluida' WHERE completed = true AND status <> 'concluida';

-- LEDGER: templates não contam; penalidades entram como negativo
CREATE OR REPLACE FUNCTION public.xp_ledger_for(p_user uuid)
 RETURNS TABLE(source text, source_key text, amount integer, skill skill_category, custom_skill_id uuid, occurred_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH t AS (
    SELECT id, xp_reward, skill_category, custom_skill_id,
           COALESCE(completed_at, created_at) AS ts,
           row_number() OVER (PARTITION BY date(COALESCE(completed_at, created_at))
                              ORDER BY COALESCE(completed_at, created_at), id) AS seq
    FROM public.tasks WHERE user_id = p_user AND completed = true AND is_template = false
  )
  SELECT 'task'::text, ('task:'||id::text)::text,
         GREATEST(0, round(COALESCE(xp_reward,0) * (1 + CASE WHEN seq <= 1 THEN 0.10 WHEN seq = 2 THEN 0.05
              WHEN seq = 3 THEN 0.10 WHEN seq = 4 THEN 0.20 ELSE 0.30 END))::int
           + CASE WHEN EXTRACT(HOUR FROM ts) < 6 THEN -5 WHEN EXTRACT(HOUR FROM ts) < 12 THEN 5 ELSE 0 END)::int,
         skill_category, custom_skill_id, ts
  FROM t
  UNION ALL
  SELECT 'task_penalty'::text, ('task_penalty:'||id::text)::text, -GREATEST(0, COALESCE(penalty_xp,0))::int,
         skill_category, custom_skill_id, COALESCE(failed_at, created_at)
  FROM public.tasks
  WHERE user_id = p_user AND is_template = false AND completed = false
    AND status = 'falhada' AND penalty_enabled = true AND COALESCE(penalty_xp,0) > 0
  UNION ALL
  SELECT 'perfect_day'::text, ('perfect_day:'||d::text)::text, 25,
         NULL::public.skill_category, NULL::uuid, (d::timestamptz + interval '23 hours')
  FROM (SELECT due_date AS d FROM public.tasks
        WHERE user_id = p_user AND due_date IS NOT NULL AND is_template = false
          AND status NOT IN ('cancelada')
        GROUP BY due_date
        HAVING count(*) FILTER (WHERE completed = false) = 0
           AND count(*) FILTER (WHERE completed = true) > 0) pd
  UNION ALL
  SELECT 'habit'::text, ('habit:'||id::text)::text,
         (COALESCE(xp_reward,0) * GREATEST(COALESCE(streak,0),
            CASE WHEN last_completed_date IS NOT NULL THEN 1 ELSE 0 END))::int,
         skill_category, NULL::uuid,
         COALESCE(last_completed_date::timestamptz, created_at)
  FROM public.habits WHERE user_id = p_user
  UNION ALL
  SELECT 'workout'::text, ('workout:'||w.id::text)::text,
         (round(COALESCE(w.duration_min,0) * 0.8)::int
          + 5 * (SELECT count(*) FROM public.workout_exercises e WHERE e.workout_id = w.id))::int,
         'corpo'::public.skill_category, NULL::uuid, w.performed_at
  FROM public.workouts w WHERE w.user_id = p_user
  UNION ALL
  SELECT 'journal'::text, ('journal:'||id::text)::text, 15,
         'mente'::public.skill_category, NULL::uuid, created_at
  FROM public.journal_entries WHERE user_id = p_user
  UNION ALL
  SELECT 'finance'::text, ('finance:'||id::text)::text, 10,
         'financas'::public.skill_category, NULL::uuid, created_at
  FROM public.finance_transactions WHERE user_id = p_user
  UNION ALL
  SELECT 'focus'::text, ('focus:'||id::text)::text,
         GREATEST(5, floor(COALESCE(actual_seconds,0)/60.0)::int)::int,
         COALESCE(skill_category, 'disciplina'::public.skill_category), NULL::uuid, started_at
  FROM public.focus_sessions WHERE user_id = p_user AND completed = true
  UNION ALL
  SELECT 'recovery_mission'::text, ('recovery_mission:'||id::text)::text, COALESCE(xp_reward,0)::int,
         'disciplina'::public.skill_category, NULL::uuid, COALESCE(completed_at, created_at)
  FROM public.recovery_missions WHERE user_id = p_user AND completed = true
  UNION ALL
  SELECT 'library'::text, ('library:'||id::text)::text, 30,
         'conhecimento'::public.skill_category, NULL::uuid, updated_at
  FROM public.library_items WHERE user_id = p_user AND completed = true
  UNION ALL
  SELECT 'health'::text, ('health:'||id::text)::text, 5,
         'corpo'::public.skill_category, NULL::uuid, created_at
  FROM public.health_logs WHERE user_id = p_user
  UNION ALL
  SELECT 'recovery'::text, ('recovery:'||id::text)::text,
         public._recovery_xp_total(difficulty::text,
           GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - started_at))/86400)::int)),
         'disciplina'::public.skill_category, NULL::uuid, started_at
  FROM public.bad_habits WHERE user_id = p_user AND archived_at IS NULL
$function$;

-- recompute: ajusta xp_granted somente para missões reais
CREATE OR REPLACE FUNCTION public.tasks_sync_status()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.completed = true THEN
    NEW.status := 'concluida';
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.failed_at := NULL;
  ELSE
    NEW.completed_at := NULL;
    IF NEW.status = 'concluida' THEN NEW.status := 'pendente'; END IF;
    IF NEW.status = 'falhada' THEN NEW.failed_at := COALESCE(NEW.failed_at, now());
    ELSE NEW.failed_at := NULL; END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_tasks_sync_status ON public.tasks;
CREATE TRIGGER trg_tasks_sync_status BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_sync_status();

-- marca atrasadas / falhadas (aplica penalidade via ledger)
CREATE OR REPLACE FUNCTION public.refresh_mission_states()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_n int := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  -- atrasada: prazo passou (dia/horário) e ainda pendente
  UPDATE public.tasks SET status = 'atrasada'
  WHERE user_id = v_uid AND is_template = false AND completed = false
    AND status IN ('pendente','em_andamento') AND due_date IS NOT NULL
    AND (due_date + COALESCE(due_time, '23:59'::time)) < (now() AT TIME ZONE 'UTC');
  -- falhada: passou mais de 1 dia do prazo
  UPDATE public.tasks SET status = 'falhada', failed_at = COALESCE(failed_at, now())
  WHERE user_id = v_uid AND is_template = false AND completed = false
    AND status = 'atrasada' AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM public.recompute_user_xp(v_uid);
  RETURN v_n;
END $function$;

-- gera as instâncias recorrentes devidas
CREATE OR REPLACE FUNCTION public.generate_recurring_missions()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); tpl RECORD; v_due boolean; v_diff int; v_created int := 0;
  v_dow int := EXTRACT(ISODOW FROM CURRENT_DATE)::int;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  FOR tpl IN SELECT * FROM public.tasks
             WHERE user_id = v_uid AND is_template = true AND status <> 'cancelada'
               AND (repeat_until IS NULL OR repeat_until >= CURRENT_DATE)
               AND (start_date IS NULL OR start_date <= CURRENT_DATE) LOOP
    v_due := false;
    v_diff := CURRENT_DATE - COALESCE(tpl.start_date, date(tpl.created_at));
    CASE COALESCE(tpl.repeat_rule, 'every_day')
      WHEN 'every_day' THEN v_due := true;
      WHEN 'weekdays' THEN v_due := v_dow BETWEEN 1 AND 5;
      WHEN 'weekends' THEN v_due := v_dow >= 6;
      WHEN 'specific_days' THEN v_due := v_dow = ANY(COALESCE(tpl.repeat_weekdays, '{}'::smallint[]));
      WHEN 'every_x_days' THEN v_due := GREATEST(1, tpl.repeat_interval) > 0 AND v_diff % GREATEST(1, tpl.repeat_interval) = 0;
      WHEN 'every_x_weeks' THEN v_due := v_diff % (7 * GREATEST(1, tpl.repeat_interval)) = 0;
      WHEN 'every_x_months' THEN v_due := EXTRACT(DAY FROM CURRENT_DATE)::int = EXTRACT(DAY FROM COALESCE(tpl.start_date, date(tpl.created_at)))::int
        AND (((EXTRACT(YEAR FROM CURRENT_DATE)::int * 12 + EXTRACT(MONTH FROM CURRENT_DATE)::int)
            - (EXTRACT(YEAR FROM COALESCE(tpl.start_date, date(tpl.created_at)))::int * 12
             + EXTRACT(MONTH FROM COALESCE(tpl.start_date, date(tpl.created_at)))::int)) % GREATEST(1, tpl.repeat_interval) = 0);
      WHEN 'custom_date' THEN v_due := COALESCE(tpl.start_date, CURRENT_DATE) = CURRENT_DATE;
      ELSE v_due := false;
    END CASE;
    IF v_due AND NOT EXISTS (
      SELECT 1 FROM public.tasks c WHERE c.template_id = tpl.id AND c.due_date = CURRENT_DATE
    ) THEN
      INSERT INTO public.tasks(user_id, title, description, category, skill_category, custom_skill_id,
        xp_reward, due_date, due_time, estimated_min, difficulty, difficulty_locked, priority,
        reminder_minutes, penalty_enabled, penalty_xp, repeat_kind, template_id, is_template, start_date)
      VALUES (tpl.user_id, tpl.title, tpl.description, tpl.category, tpl.skill_category, tpl.custom_skill_id,
        tpl.xp_reward, CURRENT_DATE, tpl.due_time, tpl.estimated_min, tpl.difficulty, tpl.difficulty_locked,
        tpl.priority, tpl.reminder_minutes, tpl.penalty_enabled, tpl.penalty_xp, tpl.repeat_kind, tpl.id, false, CURRENT_DATE);
      UPDATE public.tasks SET last_generated_date = CURRENT_DATE WHERE id = tpl.id;
      v_created := v_created + 1;
    END IF;
  END LOOP;
  IF v_created > 0 THEN PERFORM public.recompute_user_xp(v_uid); END IF;
  RETURN v_created;
END $function$;

-- estatísticas
CREATE OR REPLACE FUNCTION public.get_mission_stats()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_done int; v_failed int; v_pending int; v_xp int;
  v_time int; v_streak int;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT count(*) FILTER (WHERE completed = true),
         count(*) FILTER (WHERE status = 'falhada'),
         count(*) FILTER (WHERE status IN ('pendente','em_andamento','atrasada')),
         COALESCE(SUM(COALESCE(time_spent_min, estimated_min)) FILTER (WHERE completed = true), 0)
    INTO v_done, v_failed, v_pending, v_time
  FROM public.tasks WHERE user_id = v_uid AND is_template = false;
  SELECT COALESCE(SUM(amount),0) INTO v_xp FROM public.xp_history
    WHERE user_id = v_uid AND source IN ('task','task_penalty','perfect_day');
  WITH d AS (SELECT DISTINCT date(completed_at) AS day FROM public.tasks
             WHERE user_id = v_uid AND completed = true AND completed_at IS NOT NULL AND is_template = false),
  g AS (SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp FROM d),
  runs AS (SELECT count(*)::int AS len FROM g GROUP BY grp)
  SELECT COALESCE(MAX(len),0) INTO v_streak FROM runs;
  RETURN jsonb_build_object('completed', v_done, 'failed', v_failed, 'pending', v_pending,
    'success_rate', CASE WHEN (v_done + v_failed) = 0 THEN 0 ELSE round(v_done::numeric * 100 / (v_done + v_failed), 1) END,
    'best_streak', v_streak, 'xp_from_missions', v_xp, 'time_spent_min', v_time);
END $function$;
