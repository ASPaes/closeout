
-- Allow client_manager to read profiles of users within their client scope
CREATE POLICY "pf_select_client_manager" ON public.profiles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND id IN (
    SELECT ur.user_id FROM public.user_roles ur
    WHERE ur.client_id IN (SELECT get_user_client_ids(auth.uid()))
  )
);

-- Allow client_manager to delete (revoke) roles within their client scope for allowed roles only
CREATE POLICY "ur_delete_client_manager" ON public.user_roles
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND client_id IN (SELECT get_user_client_ids(auth.uid()))
  AND role IN ('cashier'::app_role, 'bar_staff'::app_role, 'waiter'::app_role, 'staff'::app_role, 'venue_manager'::app_role, 'event_manager'::app_role)
);
