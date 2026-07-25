-- =========================================================================
-- XP TOTALMENTE DERIVADO DOS REGISTROS EXISTENTES
-- Causa raiz: profiles.total_xp / skills.total_xp eram acumuladores
-- permanentes alimentados por um ledger append-only (xp_history) que não
-- tinha vínculo com o registro de origem. Ao excluir registros, as linhas
-- do ledger e os acumuladores permaneciam -> XP residual (97).
-- Agora: xp_history é 100% derivado dos registros e todos os totais são
-- recalculados do zero a cada mudança em qualquer módulo.
-- =========================================================================

-- 1) Remove a lógica incremental antiga
DROP TRIGGER IF EXISTS trg_tasks_after_award ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_after_insert_award ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_insert_award ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_before_delete_refund ON public.tasks;
DROP TRIGGER IF EXISTS xp_history_sync ON public.xp_history;

-- 2) Vínculo do ledger derivado com a origem
ALTER TABLE public.xp_history ADD COLUMN IF NOT EXISTS source_key text;
CREATE INDEX IF NOT EXISTS xp_history_user_idx ON public.xp_history(user_id);

-- 3) XP acumulado de recuperação (hábitos ruins), determinístico
CREATE OR REPLACE FUNCTION public._recovery_xp_total(p_difficulty text, p_days int)
RETURNS int LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_base int; v_step int; v_weekly int; v_monthly int; v_total int := 0; d int;
BEGIN
  IF p_days IS NULL OR p_days < 1 THEN RETURN 0; END IF;
  v_base    := CASE p_difficulty WHEN 'easy' THEN 5 WHEN 'medium' THEN 8 ELSE 12 END;
  v_step    := CASE p_difficulty WHEN 'easy' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END;
  v_weekly  := CASE p_difficulty WHEN 'easy' THEN 20 WHEN 'medium' THEN 35 ELSE 50 END;
  v_monthly := CASE p_difficulty WHEN 'easy' THEN 100 WHEN 'medium' THEN 200 ELSE 300 END;
  FOR d IN 1..LEAST(p_days, 2000) LOOP
    v_total := v_total + v_base + floor(d/7)::int * v_step;
    IF d % 30 = 0 THEN v_total := v_total + v_monthly;
    ELSIF d % 7 = 0 THEN v_total := v_total + v_weekly; END IF;
  END LOOP;
  RETURN v_total;
END $$;

-- 4) Ledger derivado: única fonte de verdade do XP
CREATE OR REPLACE FUNCTION public.xp_ledger_for(p_user uuid)
RETURNS TABLE(source text, source_key text, amount int, skill public.skill_category, custom_skill_id uuid, occurred_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (
    SELECT id, xp_reward, skill_category, custom_skill_id,
           COALESCE(completed_at, created_at) AS ts,
           row_number() OVER (PARTITION BY date(COALESCE(completed_at, created_at))
                              ORDER BY COALESCE(completed_at, created_at), id) AS seq
    FROM public.tasks WHERE user_id = p_user AND completed = true
  )
  SELECT 'task'::text, ('task:'||id::text)::text,
         GREATEST(0, round(COALESCE(xp_reward,0) * (1 + CASE WHEN seq <= 1 THEN 0.10 WHEN seq = 2 THEN 0.05
              WHEN seq = 3 THEN 0.10 WHEN seq = 4 THEN 0.20 ELSE 0.30 END))::int
           + CASE WHEN EXTRACT(HOUR FROM ts) < 6 THEN -5 WHEN EXTRACT(HOUR FROM ts) < 12 THEN 5 ELSE 0 END)::int,
         skill_category, custom_skill_id, ts
  FROM t
  UNION ALL
  SELECT 'perfect_day'::text, ('perfect_day:'||d::text)::text, 25,
         NULL::public.skill_category, NULL::uuid, (d::timestamptz + interval '23 hours')
  FROM (SELECT due_date AS d FROM public.tasks
        WHERE user_id = p_user AND due_date IS NOT NULL
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
$$;

-- 5) Recálculo completo (idempotente, sem recursão)
CREATE OR REPLACE FUNCTION public.recompute_user_xp(p_user uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_streak int;
BEGIN
  IF p_user IS NULL THEN RETURN 0; END IF;
  IF COALESCE(current_setting('app.xp_recomputing', true), '') = 'on' THEN RETURN 0; END IF;
  PERFORM set_config('app.xp_recomputing', 'on', true);

  DELETE FROM public.xp_history WHERE user_id = p_user;
  INSERT INTO public.xp_history (user_id, amount, source, source_key, skill_category, custom_skill_id, created_at)
  SELECT p_user, l.amount, l.source, l.source_key, l.skill, l.custom_skill_id, COALESCE(l.occurred_at, now())
  FROM public.xp_ledger_for(p_user) l
  WHERE l.amount <> 0;

  SELECT COALESCE(SUM(amount), 0)::int INTO v_total FROM public.xp_history WHERE user_id = p_user;
  v_total := GREATEST(0, v_total);

  -- streak = dias consecutivos com atividade terminando hoje/ontem
  WITH d AS (
    SELECT DISTINCT date(created_at) AS day FROM public.xp_history
    WHERE user_id = p_user AND amount > 0
  ), g AS (
    SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp FROM d
  ), runs AS (
    SELECT grp, count(*)::int AS len, max(day) AS last_day FROM g GROUP BY grp
  )
  SELECT COALESCE(MAX(len), 0) INTO v_streak FROM runs
  WHERE last_day >= CURRENT_DATE - 1;

  UPDATE public.profiles SET
    total_xp = v_total,
    xp = v_total,
    level = GREATEST(1, floor(sqrt(v_total / 50.0))::int + 1),
    streak_days = COALESCE(v_streak, 0),
    last_active_date = (SELECT MAX(date(created_at)) FROM public.xp_history WHERE user_id = p_user AND amount > 0),
    updated_at = now()
  WHERE id = p_user;

  UPDATE public.skills s SET
    total_xp = COALESCE(a.tot, 0),
    xp = COALESCE(a.tot, 0),
    level = GREATEST(1, floor(sqrt(GREATEST(0, COALESCE(a.tot, 0)) / 30.0))::int + 1)
  FROM (
    SELECT s2.id, COALESCE(SUM(h.amount), 0)::int AS tot
    FROM public.skills s2
    LEFT JOIN public.xp_history h ON h.user_id = s2.user_id
      AND (h.custom_skill_id = s2.id OR (s2.category IS NOT NULL AND h.skill_category = s2.category))
    WHERE s2.user_id = p_user
    GROUP BY s2.id
  ) a
  WHERE s.id = a.id;

  -- XP exibido em cada missão = valor derivado
  UPDATE public.tasks t SET xp_granted = COALESCE(h.amount, 0), xp_awarded = t.completed
  FROM (SELECT source_key, amount FROM public.xp_history WHERE user_id = p_user AND source = 'task') h
  WHERE t.user_id = p_user AND ('task:'||t.id::text) = h.source_key
    AND (t.xp_granted IS DISTINCT FROM h.amount OR t.xp_awarded IS DISTINCT FROM t.completed);
  UPDATE public.tasks SET xp_granted = 0, xp_awarded = false
  WHERE user_id = p_user AND completed = false AND (xp_granted <> 0 OR xp_awarded = true);

  BEGIN PERFORM public.check_all_titles(p_user); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM public.check_rank(p_user); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM public.calc_life_score(p_user); EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM set_config('app.xp_recomputing', 'off', true);
  RETURN v_total;
END $$;

-- 6) Gatilho genérico em todos os módulos que geram XP
CREATE OR REPLACE FUNCTION public.trg_recompute_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  v_uid := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE (to_jsonb(NEW)->>'user_id')::uuid END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE (to_jsonb(OLD)->>'user_id')::uuid END);
  PERFORM public.recompute_user_xp(v_uid);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tasks','habits','workouts','workout_exercises','journal_entries',
    'finance_transactions','focus_sessions','recovery_missions','library_items','health_logs','bad_habits']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_xp_recompute ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER trg_xp_recompute AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_xp()', tbl);
  END LOOP;
END $$;

-- 7) Missão concluída marca a data (sem conceder XP incremental)
CREATE OR REPLACE FUNCTION public.tasks_auto_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed = true THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.xp_awarded := true;
  ELSE
    NEW.completed_at := NULL;
    NEW.xp_awarded := false;
    NEW.xp_granted := 0;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tasks_auto_award ON public.tasks;
CREATE TRIGGER trg_tasks_auto_award BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_auto_award();

-- 8) APIs antigas passam a apenas recalcular (nunca somar/subtrair)
CREATE OR REPLACE FUNCTION public._award_xp_for_user(p_user_id uuid, p_amount integer, p_source text,
  p_skill public.skill_category DEFAULT NULL, p_custom_skill_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.recompute_user_xp(p_user_id); END $$;

CREATE OR REPLACE FUNCTION public._refund_xp_for_user(p_user_id uuid, p_amount integer,
  p_skill public.skill_category DEFAULT NULL, p_custom_skill_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.recompute_user_xp(p_user_id); END $$;

CREATE OR REPLACE FUNCTION public.award_xp(p_amount integer, p_source text,
  p_skill public.skill_category DEFAULT NULL, p_custom_skill_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.recompute_user_xp(auth.uid()); END $$;

CREATE OR REPLACE FUNCTION public.recalc_xp()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.recompute_user_xp(auth.uid()); END $$;

CREATE OR REPLACE FUNCTION public.sync_life_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_total int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_total := public.recompute_user_xp(v_uid);
  RETURN jsonb_build_object(
    'total_xp', v_total,
    'life_score', (SELECT life_score FROM public.profiles WHERE id = v_uid),
    'rank', (SELECT current_rank FROM public.profiles WHERE id = v_uid));
END $$;

-- 9) Hábito concluído hoje: apenas atualiza o registro; XP vem do recálculo
CREATE OR REPLACE FUNCTION public.complete_habit_today(p_habit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_habit public.habits; v_new_streak int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_habit FROM public.habits WHERE id = p_habit_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF v_habit.last_completed_date = CURRENT_DATE THEN RETURN; END IF;
  IF v_habit.last_completed_date = CURRENT_DATE - 1 THEN v_new_streak := v_habit.streak + 1;
  ELSE v_new_streak := 1; END IF;
  UPDATE public.habits SET streak = v_new_streak,
    best_streak = GREATEST(best_streak, v_new_streak), last_completed_date = CURRENT_DATE
  WHERE id = p_habit_id;
END $$;

-- 10) Sessão de foco: grava e recalcula
CREATE OR REPLACE FUNCTION public.complete_focus_session(p_id uuid, p_actual_seconds integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_session public.focus_sessions; v_xp int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_session FROM public.focus_sessions WHERE id = p_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
  v_xp := GREATEST(5, floor(p_actual_seconds / 60.0)::int);
  UPDATE public.focus_sessions SET actual_seconds = p_actual_seconds, completed = true,
    ended_at = COALESCE(ended_at, now()), xp_awarded = v_xp WHERE id = p_id;
  RETURN v_xp;
END $$;

-- 11) Recuperação: apenas ajusta o registro (XP é derivado dos dias limpos)
CREATE OR REPLACE FUNCTION public.bad_habit_sync_awards()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); h RECORD; v_days int;
  v_thresholds int[] := ARRAY[1,3,7,14,21,30,60,90,180,365,500,1000];
  v_names text[] := ARRAY['1 dia limpo','3 dias limpo','1 semana limpo','2 semanas limpo','3 semanas limpo','1 mês limpo','2 meses limpo','3 meses limpo','6 meses limpo','1 ano limpo','500 dias limpo','1000 dias limpo'];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  FOR h IN SELECT id, name, started_at FROM public.bad_habits
           WHERE user_id = v_uid AND archived_at IS NULL LOOP
    v_days := GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - h.started_at))/86400)::int);
    FOR i IN 1..array_length(v_thresholds,1) LOOP
      IF v_days >= v_thresholds[i] THEN
        INSERT INTO public.achievements(user_id, badge_key, name, description, icon)
        VALUES (v_uid, 'recovery:'||h.id::text||':'||v_thresholds[i], v_names[i]||' — '||h.name,
                'Recuperação de '||h.name, '🏅')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
  PERFORM public.recompute_user_xp(v_uid);
END $$;

-- 12) Life Score = 0 quando não há nenhum registro
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

  s_level    := LEAST(10, GREATEST(0, COALESCE(v_profile.level,1) - 1)::numeric / 5.0);
  s_xp       := LEAST(10, v_xp_7d::numeric / 500.0 * 10);
  s_streak   := LEAST(10, COALESCE(v_profile.streak_days,0)::numeric / 30.0 * 10);
  s_missions := LEAST(10, v_missions_7d::numeric / 14.0 * 10);
  s_habits   := LEAST(10, v_habits_done_7d::numeric / 5.0 * 10);
  s_workouts := LEAST(10, v_workouts_7d::numeric / 4.0 * 10);
  s_recovery := GREATEST(0, LEAST(10, v_recovery_days::numeric / 30.0 * 10) - v_relapse_7d * 2);
  s_reading  := LEAST(10, v_books::numeric / 2.0 * 10);
  s_focus    := LEAST(10, v_focus_min_7d::numeric / 300.0 * 10);
  s_sleep    := CASE WHEN v_sleep_avg = 0 THEN 0
                     WHEN v_sleep_avg BETWEEN 7 AND 9 THEN 10
                     WHEN v_sleep_avg BETWEEN 6 AND 10 THEN 7 ELSE 4 END;
  v_total := ROUND(s_level + s_xp + s_streak + s_missions + s_habits + s_workouts + s_recovery + s_reading + s_focus + s_sleep, 1);
  UPDATE public.profiles SET life_score = v_total, updated_at = now() WHERE id = v_uid;
  IF v_total > 0 THEN
    INSERT INTO public.life_score_snapshots(user_id, snapshot_date, score, breakdown)
    VALUES (v_uid, CURRENT_DATE, v_total, jsonb_build_object(
      'level',s_level,'xp',s_xp,'streak',s_streak,'missions',s_missions,'habits',s_habits,
      'workouts',s_workouts,'recovery',s_recovery,'reading',s_reading,'focus',s_focus,'sleep',s_sleep))
    ON CONFLICT (user_id, snapshot_date) DO UPDATE SET score = EXCLUDED.score, breakdown = EXCLUDED.breakdown;
  ELSE
    DELETE FROM public.life_score_snapshots WHERE user_id = v_uid AND snapshot_date = CURRENT_DATE;
  END IF;
  RETURN v_total;
END $$;

-- 13) Recalcula todos os usuários existentes agora (remove o resíduo)
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT id FROM public.profiles LOOP
    PERFORM public.recompute_user_xp(u);
  END LOOP;
END $$;