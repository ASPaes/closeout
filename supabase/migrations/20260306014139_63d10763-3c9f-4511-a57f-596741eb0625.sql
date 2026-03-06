
-- Add missing columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS document TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Rename contact_email/contact_phone to email/phone
ALTER TABLE public.clients RENAME COLUMN contact_email TO email;
ALTER TABLE public.clients RENAME COLUMN contact_phone TO phone;

-- Replace is_active boolean with status text
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
UPDATE public.clients SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END;
ALTER TABLE public.clients DROP COLUMN is_active;

-- Add validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_client_status()
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

CREATE TRIGGER check_client_status
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_status();
