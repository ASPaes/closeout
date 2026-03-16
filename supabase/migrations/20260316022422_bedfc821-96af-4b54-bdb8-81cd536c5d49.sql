-- RLS policies for client_manager on user_invites
CREATE POLICY "ui_select_client_manager"
ON public.user_invites FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND client_id IN (SELECT get_user_client_ids(auth.uid()))
);

CREATE POLICY "ui_insert_client_manager"
ON public.user_invites FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND client_id IS NOT NULL
  AND client_id IN (SELECT get_user_client_ids(auth.uid()))
);

CREATE POLICY "ui_update_client_manager"
ON public.user_invites FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND client_id IN (SELECT get_user_client_ids(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND client_id IN (SELECT get_user_client_ids(auth.uid()))
);

-- user_roles: client_manager can SELECT roles within their client scope
CREATE POLICY "ur_select_client_manager"
ON public.user_roles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND client_id IN (SELECT get_user_client_ids(auth.uid()))
);

-- user_roles: client_manager can INSERT only allowed operational roles for their client
CREATE POLICY "ur_insert_client_manager"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'client_manager'::app_role)
  AND client_id IS NOT NULL
  AND client_id IN (SELECT get_user_client_ids(auth.uid()))
  AND role IN ('cashier'::app_role, 'bar_staff'::app_role, 'waiter'::app_role, 'staff'::app_role, 'venue_manager'::app_role, 'event_manager'::app_role)
);