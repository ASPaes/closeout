
-- Add client_id column
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

-- Rename date to start_at (timestamp)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing data: combine date + start_time/end_time into start_at/end_at
UPDATE public.events SET
  start_at = (date::text || ' ' || COALESCE(start_time::text, '00:00:00'))::timestamp with time zone,
  end_at = (date::text || ' ' || COALESCE(end_time::text, '23:59:59'))::timestamp with time zone;

-- Drop old date/time columns
ALTER TABLE public.events
  DROP COLUMN IF EXISTS date,
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time;

-- Add new operational fields
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS geo_radius_meters INTEGER,
  ADD COLUMN IF NOT EXISTS max_order_value NUMERIC,
  ADD COLUMN IF NOT EXISTS unretrieved_order_alert_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS stock_control_enabled BOOLEAN NOT NULL DEFAULT true;

-- Update status: change enum to text
-- First drop the default that references the enum
ALTER TABLE public.events ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.events ALTER COLUMN status SET DATA TYPE TEXT USING status::text;
ALTER TABLE public.events ALTER COLUMN status SET DEFAULT 'draft';

-- Add validation trigger for event status
CREATE OR REPLACE FUNCTION public.validate_event_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'active', 'closed') THEN
    RAISE EXCEPTION 'Invalid event status: must be draft, active, or closed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_event_status
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_status();
