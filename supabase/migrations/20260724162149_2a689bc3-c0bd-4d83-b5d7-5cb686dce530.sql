DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalculate_xp(r.id);
  END LOOP;
END;
$$;