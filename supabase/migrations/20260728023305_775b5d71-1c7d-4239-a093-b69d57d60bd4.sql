ALTER TABLE public.health_logs ADD COLUMN IF NOT EXISTS sleep_quality integer;

CREATE TABLE IF NOT EXISTS public.health_goals (
  user_id uuid PRIMARY KEY,
  water_ml_goal integer NOT NULL DEFAULT 2500,
  sleep_hours_goal numeric NOT NULL DEFAULT 8,
  weight_goal_kg numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_goals TO authenticated;
GRANT ALL ON public.health_goals TO service_role;

ALTER TABLE public.health_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own health goals" ON public.health_goals;
CREATE POLICY "own health goals" ON public.health_goals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.health_goals_touch_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_health_goals_updated ON public.health_goals;
CREATE TRIGGER trg_health_goals_updated BEFORE UPDATE ON public.health_goals
  FOR EACH ROW EXECUTE FUNCTION public.health_goals_touch_updated();