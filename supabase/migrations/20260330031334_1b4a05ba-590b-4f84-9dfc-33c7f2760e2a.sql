
-- RPC: accept_waiter_call
CREATE OR REPLACE FUNCTION public.accept_waiter_call(p_call_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_call record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_call FROM public.waiter_calls WHERE id = p_call_id;

  IF v_call IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CALL_NOT_FOUND');
  END IF;

  IF v_call.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CALL_NOT_PENDING');
  END IF;

  UPDATE public.waiter_calls
  SET status = 'accepted', accepted_by = v_user_id, accepted_at = now()
  WHERE id = p_call_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'waiter_call.accepted', 'waiter_call', p_call_id,
    jsonb_build_object('event_id', v_call.event_id, 'call_type', v_call.call_type));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_waiter_call(uuid) TO authenticated;

-- RPC: complete_waiter_call
CREATE OR REPLACE FUNCTION public.complete_waiter_call(p_call_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_call record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_call FROM public.waiter_calls WHERE id = p_call_id;

  IF v_call IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CALL_NOT_FOUND');
  END IF;

  IF v_call.status != 'accepted' OR v_call.accepted_by != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_YOUR_CALL');
  END IF;

  UPDATE public.waiter_calls
  SET status = 'completed', completed_at = now()
  WHERE id = p_call_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'waiter_call.completed', 'waiter_call', p_call_id,
    jsonb_build_object('event_id', v_call.event_id, 'call_type', v_call.call_type));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_waiter_call(uuid) TO authenticated;
