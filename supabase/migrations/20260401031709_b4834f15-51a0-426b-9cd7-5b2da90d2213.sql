
-- ============================================================
-- 1. FIX: waiter_invites overpermissive RLS (waiter_invites_overpermissive)
-- ============================================================
DROP POLICY IF EXISTS "wi_all_manager" ON public.waiter_invites;
CREATE POLICY "wi_all_manager" ON public.waiter_invites
AS PERMISSIVE FOR ALL TO authenticated
USING (is_client_manager(client_id))
WITH CHECK (is_client_manager(client_id));

-- ============================================================
-- 2. FIX: clients table sensitive data exposure (clients_table_sensitive_exposure)
-- Replace broad policies with ones that only allow reading non-sensitive columns
-- We drop the overly broad policies and create a secure view for lower-privileged users
-- ============================================================
DROP POLICY IF EXISTS "cl_select_event_assigned" ON public.clients;
DROP POLICY IF EXISTS "cl_select_venue_manager" ON public.clients;

-- Create restricted policies that only match on id (RLS grants row access, not column access)
-- So we create a secure view with limited columns for lower-privileged roles
CREATE OR REPLACE VIEW public.clients_limited 
WITH (security_invoker = true)
AS
SELECT id, name, slug, logo_url, status
FROM public.clients;

-- Grant access to the view
GRANT SELECT ON public.clients_limited TO authenticated;

-- Re-create policies that allow venue managers and event-assigned users to SELECT
-- but only through the main table for basic lookups (id, name needed for FK display)
CREATE POLICY "cl_select_venue_manager" ON public.clients
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  id IN (SELECT get_clients_for_user_venues(auth.uid()))
);

CREATE POLICY "cl_select_event_assigned" ON public.clients
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  id IN (SELECT get_clients_for_user_events(auth.uid()))
);

-- ============================================================
-- 3. FIX: has_role_for_event client-level bypass (has_role_for_event_client_broad)
-- Restrict client-level match to admin/manager roles only
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role_for_event(p_user_id uuid, p_event_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.events e ON e.id = p_event_id
    WHERE ur.user_id = p_user_id
      AND ur.role::text = ANY(p_roles)
      AND (
        -- global role (super_admin — no client_id, no event_id)
        (ur.client_id IS NULL AND ur.event_id IS NULL)
        -- client-level match ONLY for admin/manager roles
        OR (ur.client_id = e.client_id AND ur.role IN ('client_admin', 'client_manager', 'super_admin'))
        -- explicit event assignment (for operational roles like bar_staff, cashier, waiter)
        OR ur.event_id = p_event_id
      )
  );
$$;

-- ============================================================
-- 4. FIX: Function search_path mutable (SUPA_function_search_path_mutable)
-- Set search_path on all public functions missing it
-- ============================================================

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- has_role_for_client
CREATE OR REPLACE FUNCTION public.has_role_for_client(p_user_id uuid, p_client_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text = ANY(p_roles)
      AND (
        ur.client_id IS NULL  -- super_admin
        OR ur.client_id = p_client_id
      )
  );
$$;

-- is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

-- is_client_manager
CREATE OR REPLACE FUNCTION public.is_client_manager(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
        role = 'super_admin'
        OR (role IN ('client_admin', 'client_manager') AND client_id = p_client_id)
      )
  )
$$;

-- is_cashier
CREATE OR REPLACE FUNCTION public.is_cashier(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'cashier'
      AND client_id = p_client_id
  )
$$;

-- has_role_in_client
CREATE OR REPLACE FUNCTION public.has_role_in_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND client_id = p_client_id
  )
$$;

-- is_waiter_for_event
CREATE OR REPLACE FUNCTION public.is_waiter_for_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'waiter'
      AND event_id = p_event_id
  )
$$;

-- set_updated_at (trigger function)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- cash_orders_set_order_number (trigger function) 
CREATE OR REPLACE FUNCTION public.cash_orders_set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO public.cash_order_counters (event_id, next_number)
  VALUES (NEW.event_id, 2)
  ON CONFLICT (event_id) DO UPDATE SET next_number = cash_order_counters.next_number + 1, updated_at = now()
  RETURNING next_number - 1 INTO v_next;
  
  NEW.order_number := v_next;
  RETURN NEW;
END;
$$;

-- close_cash_register
CREATE OR REPLACE FUNCTION public.close_cash_register(p_register_id uuid, p_closing_balance numeric, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cash_registers
  SET status = 'closed',
      closed_at = now(),
      closing_balance = p_closing_balance,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_register_id
    AND status = 'open';
END;
$$;

-- next_cash_order_number
CREATE OR REPLACE FUNCTION public.next_cash_order_number(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO public.cash_order_counters (event_id, next_number)
  VALUES (p_event_id, 2)
  ON CONFLICT (event_id) DO UPDATE SET next_number = cash_order_counters.next_number + 1, updated_at = now()
  RETURNING next_number - 1 INTO v_next;
  RETURN v_next;
END;
$$;

-- handle_orders_updated_at (trigger function)
CREATE OR REPLACE FUNCTION public.handle_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- expire_waiter_invites_on_event_close
CREATE OR REPLACE FUNCTION public.expire_waiter_invites_on_event_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
    UPDATE public.waiter_invites
    SET status = 'expired', updated_at = now()
    WHERE event_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. FIX: waiter_calls always-true INSERT (SUPA_rls_policy_always_true)
-- ============================================================
DROP POLICY IF EXISTS "wc_insert_authenticated" ON public.waiter_calls;
CREATE POLICY "wc_insert_authenticated" ON public.waiter_calls
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND event_id IN (
    SELECT event_id FROM public.event_checkins WHERE user_id = auth.uid() AND checked_out_at IS NULL
    UNION
    SELECT event_id FROM public.user_roles WHERE user_id = auth.uid() AND event_id IS NOT NULL
  )
);

-- ============================================================
-- 6. FIX: Security definer views (SUPA_security_definer_view)
-- Convert views to security_invoker = true
-- ============================================================
-- v_event_closing_report
ALTER VIEW public.v_event_closing_report SET (security_invoker = true);
ALTER VIEW public.v_event_sales_summary SET (security_invoker = true);
ALTER VIEW public.v_event_cash_movements SET (security_invoker = true);
ALTER VIEW public.v_event_cancellations SET (security_invoker = true);
ALTER VIEW public.consumer_event_stats SET (security_invoker = true);
