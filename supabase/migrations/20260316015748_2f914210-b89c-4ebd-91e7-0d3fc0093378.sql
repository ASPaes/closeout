
-- Remove client_admin SELECT policies from billing tables
DROP POLICY IF EXISTS "br_select_client_admin" ON public.billing_rules;
DROP POLICY IF EXISTS "ebo_select_client_admin" ON public.event_billing_overrides;

-- Add DELETE policy for super_admin on event_billing_overrides (was missing)
CREATE POLICY "ebo_delete_super" ON public.event_billing_overrides
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
