
-- 1) Seed platform_settings with fixed ID if not exists
INSERT INTO public.platform_settings (id, default_geo_radius_meters, default_max_order_value, default_unretrieved_order_alert_minutes)
VALUES ('00000000-0000-0000-0000-000000000001', 500, 500.00, 15)
ON CONFLICT (id) DO NOTHING;

-- 2) Update event status validation trigger to allow: draft, active, completed, cancelled
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
