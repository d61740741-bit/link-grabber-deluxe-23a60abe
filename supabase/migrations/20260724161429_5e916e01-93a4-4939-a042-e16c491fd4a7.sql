
-- Ensure XP is always recomputed from source rows: attach AFTER INSERT/UPDATE/DELETE
-- triggers on every domain table that feeds xp_history. The recalc function is
-- idempotent (deletes+rebuilds the ledger, then updates profiles/skills).

CREATE OR REPLACE FUNCTION public.recalculate_xp_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recalculate_xp(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tasks','habits','workouts','workout_exercises','finance_transactions',
    'journal_entries','library_items','recovery_missions','bad_habits',
    'bad_habit_relapses','focus_sessions','health_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_recalc_xp ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_recalc_xp AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.recalculate_xp_after_change()',
      t
    );
  END LOOP;
END $$;
