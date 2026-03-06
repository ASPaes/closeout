
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pt-BR';

CREATE OR REPLACE FUNCTION public.validate_profile_language()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.language NOT IN ('pt-BR', 'en-US') THEN
    RAISE EXCEPTION 'Invalid language: must be pt-BR or en-US';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_profile_language
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_language();
