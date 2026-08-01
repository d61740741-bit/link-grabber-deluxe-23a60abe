DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tasks','habits','workouts','health_logs','health_goals','library_items',
    'finance_transactions','finance_goals','bad_habits','bad_habit_relapses',
    'recovery_missions','skills','profiles','xp_history','achievements',
    'weekly_bosses','user_titles','goals'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;