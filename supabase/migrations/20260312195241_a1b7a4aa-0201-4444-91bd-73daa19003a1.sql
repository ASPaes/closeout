
-- 1. Create platform_settings table
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_geo_radius_meters integer NOT NULL DEFAULT 500,
  default_max_order_value numeric NOT NULL DEFAULT 500.00,
  default_unretrieved_order_alert_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings FORCE ROW LEVEL SECURITY;

-- 3. RLS policies - only super_admin can read/write
CREATE POLICY "ps_select_super" ON public.platform_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "ps_all_super" ON public.platform_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 4. Updated_at trigger
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Seed with default row
INSERT INTO public.platform_settings (default_geo_radius_meters, default_max_order_value, default_unretrieved_order_alert_minutes)
VALUES (500, 500.00, 15);

-- 6. Fix validate_event_status trigger function to use correct enum values
CREATE OR REPLACE FUNCTION public.validate_event_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('draft', 'active', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid event status: must be draft, active, completed, or cancelled';
  END IF;
  RETURN NEW;
END;
$function$;
