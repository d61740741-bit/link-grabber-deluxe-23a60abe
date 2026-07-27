CREATE OR REPLACE FUNCTION public.library_sync_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'concluido' THEN NEW.completed := true; END IF;
    IF NEW.completed = true THEN NEW.status := 'concluido'; END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.completed := (NEW.status = 'concluido');
  ELSE
    IF NEW.completed = true AND NEW.status <> 'concluido' THEN NEW.status := 'concluido'; END IF;
    IF NEW.completed = false AND NEW.status = 'concluido' THEN NEW.status := 'em_andamento'; END IF;
  END IF;
  IF NEW.completed = true THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.progress := 100;
    IF NEW.total_pages IS NOT NULL THEN NEW.current_page := NEW.total_pages; END IF;
  ELSE
    NEW.completed_at := NULL;
    IF NEW.progress >= 100 THEN NEW.progress := 99; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;