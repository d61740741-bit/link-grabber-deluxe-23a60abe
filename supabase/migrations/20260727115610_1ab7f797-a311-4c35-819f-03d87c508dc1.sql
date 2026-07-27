CREATE OR REPLACE FUNCTION public.xp_ledger_for(p_user uuid)
 RETURNS TABLE(source text, source_key text, amount integer, skill skill_category, custom_skill_id uuid, occurred_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
  SELECT 'library'::text, ('library:'||id::text)::text,
         (CASE item_type::text
            WHEN 'livro' THEN 100 WHEN 'curso' THEN 80 WHEN 'pdf' THEN 30
            WHEN 'video' THEN 20 WHEN 'artigo' THEN 15 ELSE 10 END
          + floor(COALESCE(study_seconds,0)/3600.0)::int * 10)::int,
         (CASE category::text
            WHEN 'psicologia' THEN 'mente' WHEN 'filosofia' THEN 'mente'
            WHEN 'desenvolvimento_pessoal' THEN 'mente'
            WHEN 'financas' THEN 'financas' WHEN 'negocios' THEN 'financas'
            WHEN 'marketing' THEN 'social'
            WHEN 'fitness' THEN 'corpo' WHEN 'exercicio' THEN 'corpo'
            WHEN 'saude' THEN 'corpo' WHEN 'nutricao' THEN 'corpo'
            WHEN 'sobrevivencia' THEN 'disciplina' WHEN 'primeiros_socorros' THEN 'disciplina'
            ELSE 'conhecimento' END)::public.skill_category,
         NULL::uuid, COALESCE(completed_at, updated_at)
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