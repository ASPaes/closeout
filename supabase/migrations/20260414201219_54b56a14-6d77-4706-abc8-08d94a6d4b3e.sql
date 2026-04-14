
CREATE OR REPLACE FUNCTION public.ensure_consumer_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, client_id, venue_id, event_id)
  VALUES (auth.uid(), 'consumer', NULL, NULL, NULL)
  ON CONFLICT (user_id, role, client_id, venue_id, event_id) DO NOTHING;
END;
$$;
