-- Add realtime publication for remaining gamification tables so every change syncs live
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'bad_habits','bad_habit_relapses','recovery_missions',
    'focus_sessions','user_titles','timeline_events',
    'inventory_items','life_score_snapshots','weekly_bosses'
  ]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Skills: allow archive/restore (icon, color, display_name already exist)
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Suggest XP for a task based on difficulty/time/category — single source of truth
CREATE OR REPLACE FUNCTION public.suggest_task_xp(
  p_difficulty text DEFAULT 'medium',
  p_estimated_minutes int DEFAULT 15,
  p_category text DEFAULT NULL,
  p_priority text DEFAULT 'normal'
) RETURNS int
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_base numeric;
  v_diff_mult numeric;
  v_prio_mult numeric;
  v_cat_mult numeric;
BEGIN
  -- Base from estimated time (10 min ≈ 10 XP, 60 min ≈ 45 XP, 120 min ≈ 70 XP)
  v_base := CASE
    WHEN p_estimated_minutes <= 5 THEN 5
    WHEN p_estimated_minutes <= 15 THEN 8 + p_estimated_minutes * 0.3
    WHEN p_estimated_minutes <= 60 THEN 12 + (p_estimated_minutes - 15) * 0.7
    WHEN p_estimated_minutes <= 120 THEN 45 + (p_estimated_minutes - 60) * 0.42
    ELSE 70 + (p_estimated_minutes - 120) * 0.25
  END;

  v_diff_mult := CASE lower(coalesce(p_difficulty,'medium'))
    WHEN 'trivial' THEN 0.6
    WHEN 'easy' THEN 0.85
    WHEN 'medium' THEN 1.0
    WHEN 'hard' THEN 1.35
    WHEN 'epic' THEN 1.75
    ELSE 1.0
  END;

  v_prio_mult := CASE lower(coalesce(p_priority,'normal'))
    WHEN 'low' THEN 0.9
    WHEN 'normal' THEN 1.0
    WHEN 'high' THEN 1.15
    WHEN 'critical' THEN 1.3
    ELSE 1.0
  END;

  v_cat_mult := CASE lower(coalesce(p_category,''))
    WHEN 'corpo' THEN 1.1
    WHEN 'mente' THEN 1.05
    WHEN 'conhecimento' THEN 1.1
    WHEN 'financas' THEN 1.0
    WHEN 'disciplina' THEN 1.15
    WHEN 'social' THEN 0.95
    ELSE 1.0
  END;

  RETURN GREATEST(3, round(v_base * v_diff_mult * v_prio_mult * v_cat_mult)::int);
END $$;

GRANT EXECUTE ON FUNCTION public.suggest_task_xp(text,int,text,text) TO authenticated;