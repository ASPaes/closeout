
-- Add missing columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Rename full_name to name
ALTER TABLE public.profiles RENAME COLUMN full_name TO name;

-- Make name NOT NULL with default
ALTER TABLE public.profiles ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN name SET DEFAULT '';

-- Add validation trigger for status values
CREATE OR REPLACE FUNCTION public.validate_profile_status()
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

CREATE TRIGGER check_profile_status
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_status();
