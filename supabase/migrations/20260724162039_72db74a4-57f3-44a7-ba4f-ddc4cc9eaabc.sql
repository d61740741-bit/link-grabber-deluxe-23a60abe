ALTER FUNCTION public.recalculate_xp(uuid) RENAME TO recalculate_xp_with_achievement_bonus;

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
  v_rank text := 'beginner';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.recalculate_xp_with_achievement_bonus(p_user_id);

  DELETE FROM public.xp_history
  WHERE user_id = p_user_id
    AND source = 'achievement';

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

  UPDATE public.profiles
  SET current_rank = v_rank,
      updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.calc_life_score(p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_xp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_xp(uuid) TO service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalculate_xp(r.id);
  END LOOP;
END;
$$;