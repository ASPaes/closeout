
-- RPC: consumer_checkin
CREATE OR REPLACE FUNCTION public.consumer_checkin(
  p_event_id uuid,
  p_method text,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_client_id uuid;
  v_existing_event_id uuid;
  v_checkin_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF p_method NOT IN ('gps', 'manual') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_METHOD');
  END IF;

  -- Check for active checkin in another event
  SELECT event_id INTO v_existing_event_id
  FROM public.event_checkins
  WHERE user_id = v_user_id AND checked_out_at IS NULL
  LIMIT 1;

  IF v_existing_event_id IS NOT NULL THEN
    IF v_existing_event_id != p_event_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CHECKED_IN_OTHER_EVENT', 'event_id', v_existing_event_id);
    ELSE
      -- Already checked in this event
      RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CHECKED_IN');
    END IF;
  END IF;

  -- Get client_id from event
  SELECT client_id INTO v_client_id FROM public.events WHERE id = p_event_id;
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  -- Insert checkin
  INSERT INTO public.event_checkins (
    user_id, event_id, client_id, check_in_method, latitude, longitude, is_visible
  ) VALUES (
    v_user_id, p_event_id, v_client_id, p_method,
    CASE WHEN p_method = 'gps' THEN p_lat ELSE NULL END,
    CASE WHEN p_method = 'gps' THEN p_lng ELSE NULL END,
    true
  )
  RETURNING id INTO v_checkin_id;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, 'CONSUMER_CHECKIN', 'event_checkin', v_checkin_id,
    jsonb_build_object('event_id', p_event_id, 'method', p_method, 'lat', p_lat, 'lng', p_lng));

  RETURN jsonb_build_object('ok', true, 'checkin_id', v_checkin_id);
END;
$function$;

-- RPC: consumer_checkout
CREATE OR REPLACE FUNCTION public.consumer_checkout(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_checkin_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT id INTO v_checkin_id
  FROM public.event_checkins
  WHERE user_id = v_user_id AND event_id = p_event_id AND checked_out_at IS NULL
  LIMIT 1;

  IF v_checkin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NO_ACTIVE_CHECKIN');
  END IF;

  UPDATE public.event_checkins
  SET checked_out_at = now()
  WHERE id = v_checkin_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, 'CONSUMER_CHECKOUT', 'event_checkin', v_checkin_id,
    jsonb_build_object('event_id', p_event_id));

  RETURN jsonb_build_object('ok', true);
END;
$function$;
