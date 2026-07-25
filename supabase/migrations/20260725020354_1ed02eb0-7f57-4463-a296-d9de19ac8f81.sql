
CREATE OR REPLACE FUNCTION public.recalculate_xp_with_achievement_bonus(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total int := 0;
  v_level int := 1;
  v_last date;
  v_streak int := 0;
  v_cursor date;
  v_life_score numeric := 0;
  v_rank text := 'beginner';
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.xp_history WHERE user_id = p_user_id;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, custom_skill_id, task_id, created_at)
  SELECT
    t.user_id,
    public._compute_task_xp(t.user_id, t.xp_reward, COALESCE(t.completed_at, t.created_at, now())),
    'task',
    'task:' || t.id::text,
    t.skill_category,
    t.custom_skill_id,
    t.id,
    COALESCE(t.completed_at, t.created_at, now())
  FROM public.tasks t
  WHERE t.user_id = p_user_id AND t.completed = true;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    h.user_id,
    GREATEST(0, COALESCE(h.xp_reward,0) * GREATEST(COALESCE(h.best_streak,h.streak,0), COALESCE(h.streak,0), CASE WHEN h.last_completed_date IS NULL THEN 0 ELSE 1 END)),
    'habit',
    'habit:' || h.id::text,
    h.skill_category,
    COALESCE(h.last_completed_date::timestamptz, h.created_at, now())
  FROM public.habits h
  WHERE h.user_id = p_user_id AND h.last_completed_date IS NOT NULL;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT
    w.user_id,
    GREATEST(0, round(COALESCE(w.duration_min,0) * 0.8)::int + COALESCE(ex.c,0) * 5),
    'workout',
    'workout:' || w.id::text,
    'corpo'::skill_category,
    COALESCE(w.performed_at, now())
  FROM public.workouts w
  LEFT JOIN (SELECT workout_id, count(*)::int c FROM public.workout_exercises WHERE user_id=p_user_id GROUP BY workout_id) ex ON ex.workout_id=w.id
  WHERE w.user_id = p_user_id;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT ft.user_id, 10, 'finance', 'finance:'||ft.id::text, 'financas'::skill_category,
    COALESCE(ft.occurred_on::timestamptz, ft.created_at, now())
  FROM public.finance_transactions ft WHERE ft.user_id = p_user_id;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT j.user_id, 15, 'journal', 'journal:'||j.id::text, 'mente'::skill_category,
    COALESCE(j.entry_date::timestamptz, j.created_at, now())
  FROM public.journal_entries j WHERE j.user_id = p_user_id;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT li.user_id,
    CASE WHEN li.item_type::text='livro' THEN 50 ELSE 25 END,
    'library','library:'||li.id::text,'conhecimento'::skill_category,
    COALESCE(li.updated_at, li.created_at, now())
  FROM public.library_items li WHERE li.user_id = p_user_id AND li.completed = true;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT fs.user_id,
    GREATEST(5, floor(COALESCE(fs.actual_seconds,0)/60.0)::int),
    'focus','focus:'||fs.id::text,'disciplina'::skill_category,
    COALESCE(fs.ended_at, fs.started_at, fs.created_at, now())
  FROM public.focus_sessions fs WHERE fs.user_id = p_user_id AND fs.completed = true;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT rm.user_id, GREATEST(0, COALESCE(rm.xp_reward,0)),
    'recovery_mission','recovery_mission:'||rm.id::text,'disciplina'::skill_category,
    COALESCE(rm.completed_at, rm.mission_date::timestamptz, rm.created_at, now())
  FROM public.recovery_missions rm WHERE rm.user_id=p_user_id AND rm.completed = true;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT bh.user_id,
    GREATEST(0, (CASE bh.difficulty::text WHEN 'easy' THEN 5 WHEN 'medium' THEN 8 ELSE 12 END)
      * GREATEST(0, floor(EXTRACT(EPOCH FROM (now()-bh.started_at))/86400)::int)),
    'recovery','recovery:'||bh.id::text,'disciplina'::skill_category,
    COALESCE(bh.started_at, bh.created_at, now())
  FROM public.bad_habits bh
  WHERE bh.user_id=p_user_id AND bh.archived_at IS NULL
    AND GREATEST(0, floor(EXTRACT(EPOCH FROM (now()-bh.started_at))/86400)::int) > 0;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, created_at)
  SELECT wb.user_id, GREATEST(0, COALESCE(wb.xp_reward,0)),
    'weekly_boss','weekly_boss:'||wb.id::text,'disciplina'::skill_category,
    COALESCE(wb.completed_at, wb.created_at, now())
  FROM public.weekly_bosses wb
  WHERE wb.user_id=p_user_id AND wb.status::text IN ('defeated','completed');

  INSERT INTO public.xp_history(user_id, amount, source, source_key, created_at)
  SELECT a.user_id, COALESCE((badge.value->>'xp')::int, 0),
    'achievement','achievement:'||a.badge_key, COALESCE(a.unlocked_at, now())
  FROM public.achievements a
  JOIN LATERAL jsonb_array_elements(
    '[{"key":"primeira_missao","xp":25},{"key":"primeiro_streak","xp":25},{"key":"primeiro_nivel","xp":30},{"key":"primeira_skill","xp":30},
      {"key":"xp_100","xp":20},{"key":"xp_500","xp":40},{"key":"xp_1000","xp":60},{"key":"xp_5000","xp":120},{"key":"xp_10000","xp":200},{"key":"xp_50000","xp":500},
      {"key":"streak_3","xp":25},{"key":"streak_7","xp":60},{"key":"streak_30","xp":150},{"key":"streak_100","xp":500},
      {"key":"nivel_5","xp":40},{"key":"nivel_10","xp":80},{"key":"nivel_25","xp":150},{"key":"nivel_50","xp":300},{"key":"nivel_100","xp":1000},
      {"key":"missoes_10","xp":30},{"key":"missoes_50","xp":60},{"key":"missoes_100","xp":150},{"key":"missoes_500","xp":600},
      {"key":"skill_5","xp":60},{"key":"skill_10","xp":200},
      {"key":"leitor","xp":50},{"key":"atleta","xp":50},{"key":"financeiro","xp":50},{"key":"mente_clara","xp":50}]'::jsonb
  ) badge(value) ON badge.value->>'key' = a.badge_key
  WHERE a.user_id = p_user_id AND COALESCE((badge.value->>'xp')::int, 0) > 0;

  INSERT INTO public.xp_history(user_id, amount, source, source_key, custom_skill_id, created_at)
  SELECT a.user_id, CASE WHEN a.badge_key LIKE '%_lv2' THEN 30 ELSE 120 END,
    'achievement','achievement:'||a.badge_key, s.id, COALESCE(a.unlocked_at, now())
  FROM public.achievements a
  JOIN public.skills s ON s.user_id=a.user_id AND s.is_custom=true
    AND a.badge_key IN ('custom_skill_'||left(s.id::text,8)||'_lv2','custom_skill_'||left(s.id::text,8)||'_lv5')
  WHERE a.user_id = p_user_id;

  SELECT COALESCE(SUM(amount),0)::int INTO v_total FROM public.xp_history WHERE user_id=p_user_id;
  v_total := GREATEST(0, v_total);
  v_level := GREATEST(1, floor(sqrt(v_total/50.0))::int + 1);

  SELECT max(date(created_at)) INTO v_last FROM public.xp_history WHERE user_id=p_user_id AND amount>0;
  IF v_last IS NOT NULL AND v_last >= CURRENT_DATE - 1 THEN
    v_cursor := v_last;
    LOOP
      IF EXISTS (SELECT 1 FROM public.xp_history WHERE user_id=p_user_id AND amount>0 AND date(created_at)=v_cursor) THEN
        v_streak := v_streak+1; v_cursor := v_cursor-1;
      ELSE EXIT; END IF;
    END LOOP;
  END IF;

  UPDATE public.profiles SET total_xp=v_total, xp=v_total, level=v_level,
    streak_days=v_streak, last_active_date=v_last, updated_at=now() WHERE id=p_user_id;

  UPDATE public.skills s SET total_xp=COALESCE(a.tot,0), xp=COALESCE(a.tot,0),
    level=GREATEST(1, floor(sqrt(GREATEST(0,COALESCE(a.tot,0))/30.0))::int + 1)
  FROM (SELECT s2.id, COALESCE(SUM(h.amount),0)::int tot
        FROM public.skills s2 LEFT JOIN public.xp_history h
          ON h.user_id=s2.user_id AND (h.custom_skill_id=s2.id OR (s2.category IS NOT NULL AND h.skill_category=s2.category))
        WHERE s2.user_id=p_user_id GROUP BY s2.id) a
  WHERE s.id=a.id;

  IF v_level >= 5 AND v_total >= 500 THEN v_rank := 'explorer'; END IF;
  IF v_level >= 10 AND v_total >= 2000 THEN v_rank := 'warrior'; END IF;
  IF v_level >= 20 AND v_total >= 6000 THEN v_rank := 'elite'; END IF;
  IF v_level >= 35 AND v_total >= 15000 THEN v_rank := 'master'; END IF;
  IF v_level >= 50 AND v_total >= 35000 THEN v_rank := 'legend'; END IF;
  IF v_level >= 75 AND v_total >= 75000 THEN v_rank := 'ascended'; END IF;

  UPDATE public.profiles SET current_rank=v_rank, updated_at=now() WHERE id=p_user_id;

  PERFORM public.calc_life_score(p_user_id);
END;
$function$;
