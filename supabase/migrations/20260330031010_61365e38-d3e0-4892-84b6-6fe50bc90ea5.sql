
-- RPC: start_waiter_session
CREATE OR REPLACE FUNCTION public.start_waiter_session(
  p_event_id uuid,
  p_assignment_type text DEFAULT 'free',
  p_assignment_value text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_existing_id uuid;
  v_session_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT id INTO v_existing_id
  FROM public.waiter_sessions
  WHERE waiter_id = v_user_id AND closed_at IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SESSION_ALREADY_ACTIVE', 'session_id', v_existing_id);
  END IF;

  SELECT client_id INTO v_client_id
  FROM public.events WHERE id = p_event_id;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  INSERT INTO public.waiter_sessions (waiter_id, event_id, client_id, assignment_type, assignment_value)
  VALUES (v_user_id, p_event_id, v_client_id, COALESCE(p_assignment_type, 'free'), p_assignment_value)
  RETURNING id INTO v_session_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'waiter_session.started', 'waiter_session', v_session_id,
    jsonb_build_object('event_id', p_event_id, 'assignment_type', p_assignment_type, 'assignment_value', p_assignment_value));

  RETURN jsonb_build_object('ok', true, 'session_id', v_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_waiter_session(uuid, text, text) TO authenticated;
