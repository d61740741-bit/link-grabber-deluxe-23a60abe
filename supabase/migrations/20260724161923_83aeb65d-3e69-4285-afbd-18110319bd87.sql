CREATE OR REPLACE FUNCTION public.recalculate_xp_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.recalculate_xp(v_user_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public._compute_task_xp(p_user_id uuid, p_base integer, p_completed_at timestamp with time zone)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_done_today int;
  v_hour int;
  v_bonus_pct numeric := 0;
  v_flat int := 0;
  v_when timestamptz := COALESCE(p_completed_at, now());
BEGIN
  SELECT count(*)
    INTO v_done_today
  FROM public.tasks
  WHERE user_id = p_user_id
    AND completed = true
    AND completed_at IS NOT NULL
    AND date(completed_at) = date(v_when)
    AND completed_at <= v_when;

  IF v_done_today <= 1 THEN
    v_bonus_pct := 0.10;
  ELSIF v_done_today = 2 THEN
    v_bonus_pct := 0.05;
  ELSIF v_done_today = 3 THEN
    v_bonus_pct := 0.10;
  ELSIF v_done_today = 4 THEN
    v_bonus_pct := 0.20;
  ELSE
    v_bonus_pct := 0.30;
  END IF;

  v_hour := EXTRACT(HOUR FROM v_when);
  IF v_hour < 6 THEN
    v_flat := v_flat - 5;
  ELSIF v_hour < 12 THEN
    v_flat := v_flat + 5;
  END IF;

  RETURN GREATEST(0, round(COALESCE(p_base, 0) * (1 + v_bonus_pct))::int + v_flat);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_xp(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int := 0;
  v_level int := 1;
  v_last date;
  v_streak int := 0;
  v_cursor date;
  v_life_score numeric := 0;
  v_rank text := 'beginner';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.xp_history WHERE user_id = p_user_id;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, custom_skill_id, task_id, created_at)
  SELECT
    t.user_id,
    public._compute_task_xp(t.user_id, t.xp_reward, COALESCE(t.completed_at, t.updated_at, t.created_at, now())),
    'task',
    'task:' || t.id::text,
    t.skill_category,
    t.custom_skill_id,
    t.id,
    COALESCE(t.completed_at, t.updated_at, t.created_at, now())
  FROM public.tasks t
  WHERE t.user_id = p_user_id
    AND t.completed = true;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    h.user_id,
    GREATEST(0, COALESCE(h.xp_reward, 0) * GREATEST(COALESCE(h.best_streak, h.streak, 0), COALESCE(h.streak, 0), CASE WHEN h.last_completed_date IS NULL THEN 0 ELSE 1 END)),
    'habit',
    'habit:' || h.id::text,
    h.skill_category,
    COALESCE(h.last_completed_date::timestamptz, h.updated_at, h.created_at, now())
  FROM public.habits h
  WHERE h.user_id = p_user_id
    AND h.last_completed_date IS NOT NULL;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    w.user_id,
    GREATEST(0, round(COALESCE(w.duration_min, 0) * 0.8)::int + COALESCE(ex.c, 0) * 5),
    'workout',
    'workout:' || w.id::text,
    'corpo'::public.skill_category,
    COALESCE(w.performed_at, w.created_at, now())
  FROM public.workouts w
  LEFT JOIN (
    SELECT workout_id, count(*)::int AS c
    FROM public.workout_exercises
    WHERE user_id = p_user_id
    GROUP BY workout_id
  ) ex ON ex.workout_id = w.id
  WHERE w.user_id = p_user_id;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    ft.user_id,
    10,
    'finance',
    'finance:' || ft.id::text,
    'financas'::public.skill_category,
    COALESCE(ft.occurred_on::timestamptz, ft.created_at, now())
  FROM public.finance_transactions ft
  WHERE ft.user_id = p_user_id;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    j.user_id,
    15,
    'journal',
    'journal:' || j.id::text,
    'mente'::public.skill_category,
    COALESCE(j.entry_date::timestamptz, j.created_at, now())
  FROM public.journal_entries j
  WHERE j.user_id = p_user_id;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    li.user_id,
    CASE WHEN li.item_type::text = 'livro' THEN 50 ELSE 25 END,
    'library',
    'library:' || li.id::text,
    'conhecimento'::public.skill_category,
    COALESCE(li.updated_at, li.created_at, now())
  FROM public.library_items li
  WHERE li.user_id = p_user_id
    AND li.completed = true;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    fs.user_id,
    GREATEST(5, floor(COALESCE(fs.actual_seconds, 0) / 60.0)::int),
    'focus',
    'focus:' || fs.id::text,
    'disciplina'::public.skill_category,
    COALESCE(fs.ended_at, fs.started_at, fs.created_at, now())
  FROM public.focus_sessions fs
  WHERE fs.user_id = p_user_id
    AND fs.completed = true;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    rm.user_id,
    GREATEST(0, COALESCE(rm.xp_reward, 0)),
    'recovery_mission',
    'recovery_mission:' || rm.id::text,
    'disciplina'::public.skill_category,
    COALESCE(rm.completed_at, rm.mission_date::timestamptz, rm.created_at, now())
  FROM public.recovery_missions rm
  WHERE rm.user_id = p_user_id
    AND rm.completed = true;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    bh.user_id,
    GREATEST(0, (CASE bh.difficulty::text WHEN 'easy' THEN 5 WHEN 'medium' THEN 8 ELSE 12 END) * GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - bh.started_at)) / 86400)::int)),
    'recovery',
    'recovery:' || bh.id::text,
    'disciplina'::public.skill_category,
    COALESCE(bh.started_at, bh.created_at, now())
  FROM public.bad_habits bh
  WHERE bh.user_id = p_user_id
    AND bh.archived_at IS NULL
    AND GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - bh.started_at)) / 86400)::int) > 0;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    wb.user_id,
    GREATEST(0, COALESCE(wb.xp_reward, 0)),
    'weekly_boss',
    'weekly_boss:' || wb.id::text,
    'disciplina'::public.skill_category,
    COALESCE(wb.defeated_at, wb.updated_at, wb.created_at, now())
  FROM public.weekly_bosses wb
  WHERE wb.user_id = p_user_id
    AND wb.status::text IN ('defeated', 'completed');

  INSERT INTO public.xp_history(user_id, amount, source, source_key, created_at)
  SELECT
    a.user_id,
    COALESCE((badge.value ->> 'xp')::int, 0),
    'achievement',
    'achievement:' || a.badge_key,
    COALESCE(a.unlocked_at, now())
  FROM public.achievements a
  JOIN LATERAL jsonb_array_elements(
    '[
      {"key":"primeira_missao","xp":25},{"key":"primeiro_streak","xp":25},{"key":"primeiro_nivel","xp":30},{"key":"primeira_skill","xp":30},
      {"key":"xp_100","xp":20},{"key":"xp_500","xp":40},{"key":"xp_1000","xp":60},{"key":"xp_5000","xp":120},{"key":"xp_10000","xp":200},{"key":"xp_50000","xp":500},
      {"key":"streak_3","xp":25},{"key":"streak_7","xp":60},{"key":"streak_30","xp":150},{"key":"streak_100","xp":500},
      {"key":"nivel_5","xp":40},{"key":"nivel_10","xp":80},{"key":"nivel_25","xp":150},{"key":"nivel_50","xp":300},{"key":"nivel_100","xp":1000},
      {"key":"missoes_10","xp":30},{"key":"missoes_50","xp":60},{"key":"missoes_100","xp":150},{"key":"missoes_500","xp":600},
      {"key":"skill_5","xp":60},{"key":"skill_10","xp":200},
      {"key":"leitor","xp":50},{"key":"atleta","xp":50},{"key":"financeiro","xp":50},{"key":"mente_clara","xp":50}
    ]'::jsonb
  ) AS badge(value) ON badge.value ->> 'key' = a.badge_key
  WHERE a.user_id = p_user_id
    AND COALESCE((badge.value ->> 'xp')::int, 0) > 0;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, custom_skill_id, created_at)
  SELECT
    a.user_id,
    CASE WHEN a.badge_key LIKE '%_lv2' THEN 30 ELSE 120 END,
    'achievement',
    'achievement:' || a.badge_key,
    s.id,
    COALESCE(a.unlocked_at, now())
  FROM public.achievements a
  JOIN public.skills s
    ON s.user_id = a.user_id
   AND s.is_custom = true
   AND a.badge_key IN ('custom_skill_' || left(s.id::text, 8) || '_lv2', 'custom_skill_' || left(s.id::text, 8) || '_lv5')
  WHERE a.user_id = p_user_id;

  SELECT COALESCE(SUM(amount), 0)::int
    INTO v_total
  FROM public.xp_history
  WHERE user_id = p_user_id;

  v_total := GREATEST(0, v_total);
  v_level := GREATEST(1, floor(sqrt(v_total / 50.0))::int + 1);

  SELECT max(date(created_at))
    INTO v_last
  FROM public.xp_history
  WHERE user_id = p_user_id
    AND amount > 0;

  IF v_last IS NOT NULL AND v_last >= CURRENT_DATE - 1 THEN
    v_cursor := v_last;
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.xp_history
        WHERE user_id = p_user_id
          AND amount > 0
          AND date(created_at) = v_cursor
      ) THEN
        v_streak := v_streak + 1;
        v_cursor := v_cursor - 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.profiles
  SET total_xp = v_total,
      xp = v_total,
      level = v_level,
      streak_days = v_streak,
      last_active_date = v_last,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.skills s
  SET total_xp = COALESCE(a.tot, 0),
      xp = COALESCE(a.tot, 0),
      level = GREATEST(1, floor(sqrt(GREATEST(0, COALESCE(a.tot, 0)) / 30.0))::int + 1)
  FROM (
    SELECT s2.id, COALESCE(SUM(h.amount), 0)::int AS tot
    FROM public.skills s2
    LEFT JOIN public.xp_history h
      ON h.user_id = s2.user_id
     AND (
       h.custom_skill_id = s2.id
       OR (s2.category IS NOT NULL AND h.skill_category = s2.category)
     )
    WHERE s2.user_id = p_user_id
    GROUP BY s2.id
  ) a
  WHERE s.id = a.id;

  IF v_level >= 5 AND v_total >= 500 THEN v_rank := 'explorer'; END IF;
  IF v_level >= 10 AND v_total >= 2000 THEN v_rank := 'warrior'; END IF;
  IF v_level >= 20 AND v_total >= 6000 THEN v_rank := 'elite'; END IF;
  IF v_level >= 35 AND v_total >= 15000 THEN v_rank := 'master'; END IF;
  IF v_level >= 50 AND v_total >= 35000 THEN v_rank := 'legend'; END IF;
  IF v_level >= 75 AND v_total >= 75000 THEN v_rank := 'ascended'; END IF;

  SELECT ROUND(
    LEAST(10, v_level::numeric / 5 * 10)
    + LEAST(10, COALESCE((SELECT SUM(amount) FROM public.xp_history WHERE user_id = p_user_id AND created_at >= now() - interval '7 days' AND amount > 0), 0)::numeric / 500 * 10)
    + LEAST(10, v_streak::numeric / 30 * 10)
    + LEAST(10, COALESCE((SELECT COUNT(*) FROM public.tasks WHERE user_id = p_user_id AND completed = true AND completed_at >= now() - interval '7 days'), 0)::numeric / 14 * 10)
    + LEAST(10, COALESCE((SELECT COUNT(*) FROM public.habits WHERE user_id = p_user_id AND last_completed_date >= CURRENT_DATE - 7), 0)::numeric / 5 * 10)
    + LEAST(10, COALESCE((SELECT COUNT(*) FROM public.workouts WHERE user_id = p_user_id AND performed_at >= now() - interval '7 days'), 0)::numeric / 4 * 10)
    + GREATEST(0, LEAST(10, COALESCE((SELECT SUM(GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - started_at)) / 86400)::int)) FROM public.bad_habits WHERE user_id = p_user_id AND archived_at IS NULL), 0)::numeric / 30 * 10) - COALESCE((SELECT COUNT(*) FROM public.bad_habit_relapses WHERE user_id = p_user_id AND relapsed_at >= now() - interval '7 days'), 0) * 2)
    + LEAST(10, COALESCE((SELECT SUM(actual_seconds) / 60 FROM public.focus_sessions WHERE user_id = p_user_id AND started_at >= now() - interval '7 days' AND completed = true), 0)::numeric / 300 * 10)
    + COALESCE((SELECT CASE WHEN AVG(sleep_hours) IS NULL THEN 5 WHEN AVG(sleep_hours) BETWEEN 7 AND 9 THEN 10 WHEN AVG(sleep_hours) BETWEEN 6 AND 10 THEN 7 ELSE 4 END FROM public.health_logs WHERE user_id = p_user_id AND log_date >= CURRENT_DATE - 7 AND sleep_hours IS NOT NULL), 5)
  , 1)
    INTO v_life_score;

  UPDATE public.profiles
  SET current_rank = v_rank,
      life_score = COALESCE(v_life_score, 0),
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.life_score_snapshots(user_id, snapshot_date, score, breakdown)
  VALUES (p_user_id, CURRENT_DATE, COALESCE(v_life_score, 0), '{}'::jsonb)
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET score = EXCLUDED.score;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_xp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM public.recalculate_xp(v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_xp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recalculate_xp();
END;
$$;

CREATE OR REPLACE FUNCTION public.award_xp(p_amount integer, p_source text, p_skill public.skill_category DEFAULT NULL::public.skill_category)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM public.recalculate_xp(v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_xp(p_amount integer, p_source text, p_skill public.skill_category DEFAULT NULL::public.skill_category, p_custom_skill_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  PERFORM public.recalculate_xp(v_uid);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_xp_tasks ON public.tasks;
DROP TRIGGER IF EXISTS trg_recalculate_xp_habits ON public.habits;
DROP TRIGGER IF EXISTS trg_recalculate_xp_workouts ON public.workouts;
DROP TRIGGER IF EXISTS trg_recalculate_xp_workout_exercises ON public.workout_exercises;
DROP TRIGGER IF EXISTS trg_recalculate_xp_finance ON public.finance_transactions;
DROP TRIGGER IF EXISTS trg_recalculate_xp_journal ON public.journal_entries;
DROP TRIGGER IF EXISTS trg_recalculate_xp_library ON public.library_items;
DROP TRIGGER IF EXISTS trg_recalculate_xp_focus ON public.focus_sessions;
DROP TRIGGER IF EXISTS trg_recalculate_xp_recovery_missions ON public.recovery_missions;
DROP TRIGGER IF EXISTS trg_recalculate_xp_bad_habits ON public.bad_habits;
DROP TRIGGER IF EXISTS trg_recalculate_xp_weekly_bosses ON public.weekly_bosses;
DROP TRIGGER IF EXISTS trg_recalculate_xp_achievements ON public.achievements;

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.tasks;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.habits;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.habits
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.workouts;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.workouts
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.workout_exercises;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.workout_exercises
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.finance_transactions;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.finance_transactions
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.journal_entries;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.library_items;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.library_items
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.focus_sessions;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.recovery_missions;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.recovery_missions
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.bad_habits;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.bad_habits
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.bad_habit_relapses;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.bad_habit_relapses
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.weekly_bosses;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.weekly_bosses
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DROP TRIGGER IF EXISTS trg_recalc_xp ON public.achievements;
CREATE TRIGGER trg_recalc_xp
AFTER INSERT OR UPDATE OR DELETE ON public.achievements
FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalculate_xp(r.id);
  END LOOP;
END;
$$;