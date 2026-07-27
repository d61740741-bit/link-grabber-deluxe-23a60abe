ALTER TYPE public.library_item_type ADD VALUE IF NOT EXISTS 'curso';
ALTER TYPE public.library_item_type ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE public.library_item_type ADD VALUE IF NOT EXISTS 'link';
ALTER TYPE public.library_item_type ADD VALUE IF NOT EXISTS 'pdf';

ALTER TYPE public.library_category ADD VALUE IF NOT EXISTS 'fitness';
ALTER TYPE public.library_category ADD VALUE IF NOT EXISTS 'idiomas';
ALTER TYPE public.library_category ADD VALUE IF NOT EXISTS 'marketing';
ALTER TYPE public.library_category ADD VALUE IF NOT EXISTS 'desenvolvimento_pessoal';

DO $$ BEGIN
  CREATE TYPE public.library_status AS ENUM ('em_andamento','concluido','pausado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status public.library_status NOT NULL DEFAULT 'em_andamento',
  ADD COLUMN IF NOT EXISTS study_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

UPDATE public.library_items SET status = 'concluido', completed_at = COALESCE(completed_at, updated_at)
WHERE completed = true AND status <> 'concluido';

CREATE OR REPLACE FUNCTION public.library_sync_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
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

DROP TRIGGER IF EXISTS trg_library_sync_status ON public.library_items;
CREATE TRIGGER trg_library_sync_status
BEFORE INSERT OR UPDATE ON public.library_items
FOR EACH ROW EXECUTE FUNCTION public.library_sync_status();