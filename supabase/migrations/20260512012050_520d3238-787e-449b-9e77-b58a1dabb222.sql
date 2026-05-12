
DO $$
DECLARE
  v_client_id uuid := 'cc032d5f-7258-4693-92c5-1dbe35519a37';
  v_venue_id  uuid := '1ca2e24b-3003-4187-8a83-215c18386d4a';
  v_event_id  uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.events (
    id, venue_id, client_id, name, description, status,
    start_at, end_at, geo_radius_meters, max_order_value,
    unretrieved_order_alert_minutes, stock_control_enabled,
    payment_sandbox_mode, event_type, table_service_enabled
  ) VALUES (
    v_event_id, v_venue_id, v_client_id,
    'Serena Bar — Friday Night Sessions',
    'Open House com DJs convidados, drinks autorais e cardápio assinado pelo chef.',
    'active',
    now() - interval '1 hour',
    now() + interval '6 hours',
    5000, 500,
    20, true, true, 'party', false
  );

  INSERT INTO public.event_settings (event_id, client_id, geo_radius_meters, max_order_value, unretrieved_order_alert_minutes, stock_control_enabled)
  VALUES (v_event_id, v_client_id, 5000, 500, 20, true);

  -- Vincula todos os catálogos existentes do cliente
  INSERT INTO public.event_catalogs (event_id, client_id, catalog_id, is_active)
  SELECT v_event_id, v_client_id, c.id, true
  FROM public.catalogs c
  WHERE c.client_id = v_client_id;
END $$;
