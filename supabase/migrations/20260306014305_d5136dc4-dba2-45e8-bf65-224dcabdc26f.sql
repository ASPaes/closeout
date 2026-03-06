
-- Add latitude and longitude columns
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Replace is_active with status text
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
UPDATE public.venues SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END;
ALTER TABLE public.venues DROP COLUMN IF EXISTS is_active;

-- Drop capacity column (not in new spec)
ALTER TABLE public.venues DROP COLUMN IF EXISTS capacity;

-- Add validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_venue_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status: must be active or inactive';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_venue_status
  BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.validate_venue_status();
