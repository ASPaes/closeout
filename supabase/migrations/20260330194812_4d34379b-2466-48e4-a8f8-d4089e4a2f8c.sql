CREATE OR REPLACE FUNCTION public.get_consumer_profile_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_orders', (
      SELECT count(*) FROM public.orders
      WHERE consumer_id = auth.uid()
        AND status IN ('paid', 'preparing', 'ready', 'partially_delivered', 'delivered')
    ),
    'total_spent', (
      SELECT coalesce(sum(total), 0) FROM public.orders
      WHERE consumer_id = auth.uid()
        AND status IN ('paid', 'preparing', 'ready', 'partially_delivered', 'delivered')
    ),
    'total_events', (
      SELECT count(DISTINCT event_id) FROM public.event_checkins
      WHERE user_id = auth.uid()
    )
  );
$$;