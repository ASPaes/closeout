
DROP POLICY IF EXISTS "ur_insert_client_manager" ON public.user_roles;

CREATE POLICY "ur_insert_client_manager" ON public.user_roles
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND client_id IS NOT NULL
  AND client_id IN (SELECT get_user_client_ids(auth.uid()))
  AND role = ANY (ARRAY[
    'cashier'::app_role,
    'bar_staff'::app_role,
    'waiter'::app_role,
    'staff'::app_role,
    'venue_manager'::app_role,
    'event_manager'::app_role
  ])
  AND (
    venue_id IS NULL
    OR venue_id IN (SELECT id FROM public.venues WHERE client_id IN (SELECT get_user_client_ids(auth.uid())))
  )
  AND (
    event_id IS NULL
    OR event_id IN (SELECT id FROM public.events WHERE client_id IN (SELECT get_user_client_ids(auth.uid())))
  )
);
