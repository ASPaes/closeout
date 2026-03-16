
-- 1) Add new columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_cpf text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS default_fee_percent numeric;

-- 2) Add default_fee_percent to platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS default_fee_percent numeric NOT NULL DEFAULT 10;

-- 3) Create sequence for slug
CREATE SEQUENCE IF NOT EXISTS public.client_slug_seq START 1;

-- 4) Sync sequence with existing clients count
SELECT setval('public.client_slug_seq', GREATEST((SELECT count(*) FROM public.clients), 1), true);

-- 5) Create trigger function for auto-slug and default_fee_percent
CREATE OR REPLACE FUNCTION public.auto_client_defaults()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _default_fee numeric;
BEGIN
  -- Auto-generate slug if empty
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lpad(nextval('public.client_slug_seq')::text, 6, '0');
  END IF;

  -- Auto-fill default_fee_percent from platform_settings if null
  IF NEW.default_fee_percent IS NULL THEN
    SELECT default_fee_percent INTO _default_fee
    FROM public.platform_settings
    LIMIT 1;
    IF _default_fee IS NOT NULL THEN
      NEW.default_fee_percent := _default_fee;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 6) Create trigger (BEFORE INSERT)
DROP TRIGGER IF EXISTS trg_auto_client_defaults ON public.clients;
CREATE TRIGGER trg_auto_client_defaults
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_client_defaults();
