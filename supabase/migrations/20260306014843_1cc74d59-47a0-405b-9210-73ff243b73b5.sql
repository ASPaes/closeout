
-- ============================================
-- STEP 1: Create helper functions for new RBAC
-- ============================================

-- Check if a user has a role by name (uses new user_roles_new + roles tables)
CREATE OR REPLACE FUNCTION public.has_role_name(_user_id UUID, _role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles_new urn
    JOIN public.roles r ON r.id = urn.role_id
    WHERE urn.user_id = _user_id AND r.name = _role_name
  )
$$;

-- Get client IDs a user can access (through venue assignments)
CREATE OR REPLACE FUNCTION public.get_user_client_ids_v2(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT v.client_id
  FROM public.user_roles_new urn
  JOIN public.venues v ON v.id = urn.venue_id
  WHERE urn.user_id = _user_id AND urn.venue_id IS NOT NULL
$$;

-- Get venue IDs a user can access
CREATE OR REPLACE FUNCTION public.get_user_venue_ids_v2(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT urn.venue_id
  FROM public.user_roles_new urn
  WHERE urn.user_id = _user_id AND urn.venue_id IS NOT NULL
$$;

-- Get event IDs a user can access
CREATE OR REPLACE FUNCTION public.get_user_event_ids_v2(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT urn.event_id
  FROM public.user_roles_new urn
  WHERE urn.user_id = _user_id AND urn.event_id IS NOT NULL
$$;

-- ============================================
-- STEP 2: Drop ALL existing policies
-- ============================================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- clients
DROP POLICY IF EXISTS "Super admins can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their clients" ON public.clients;

-- venues
DROP POLICY IF EXISTS "Super admins can manage all venues" ON public.venues;
DROP POLICY IF EXISTS "Client admins can manage their venues" ON public.venues;
DROP POLICY IF EXISTS "Users can view their venues" ON public.venues;

-- events
DROP POLICY IF EXISTS "Super admins can manage all events" ON public.events;
DROP POLICY IF EXISTS "Client admins can manage events in their venues" ON public.events;
DROP POLICY IF EXISTS "Venue managers can manage events in their venues" ON public.events;
DROP POLICY IF EXISTS "Users can view their events" ON public.events;

-- user_roles (old)
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Client admins can view roles in their client" ON public.user_roles;

-- user_roles_new
DROP POLICY IF EXISTS "Super admins can manage all user roles" ON public.user_roles_new;
DROP POLICY IF EXISTS "Users can view own role assignments" ON public.user_roles_new;
DROP POLICY IF EXISTS "Client admins can manage roles in their venues" ON public.user_roles_new;
DROP POLICY IF EXISTS "Venue managers can manage roles in their venues" ON public.user_roles_new;

-- roles
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.roles;

-- audit_logs
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

-- ============================================
-- STEP 3: Recreate comprehensive RLS policies
-- ============================================

-- ==================
-- PROFILES
-- ==================
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_select_super_admin" ON public.profiles FOR SELECT
  USING (public.has_role_name(auth.uid(), 'super_admin'));

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_super_admin" ON public.profiles FOR UPDATE
  USING (public.has_role_name(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role_name(auth.uid(), 'super_admin'));

-- ==================
-- CLIENTS
-- ==================
-- super_admin: full CRUD
CREATE POLICY "clients_all_super_admin" ON public.clients FOR ALL
  USING (public.has_role_name(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role_name(auth.uid(), 'super_admin'));

-- client_manager: SELECT only their clients
CREATE POLICY "clients_select_client_manager" ON public.clients FOR SELECT
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
  );

-- client_manager: UPDATE their clients
CREATE POLICY "clients_update_client_manager" ON public.clients FOR UPDATE
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
  )
  WITH CHECK (
    public.has_role_name(auth.uid(), 'client_manager')
    AND id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
  );

-- ==================
-- VENUES
-- ==================
-- super_admin: full CRUD
CREATE POLICY "venues_all_super_admin" ON public.venues FOR ALL
  USING (public.has_role_name(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role_name(auth.uid(), 'super_admin'));

-- client_manager: SELECT venues of their clients
CREATE POLICY "venues_select_client_manager" ON public.venues FOR SELECT
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
  );

-- client_manager: INSERT venues for their clients
CREATE POLICY "venues_insert_client_manager" ON public.venues FOR INSERT
  WITH CHECK (
    public.has_role_name(auth.uid(), 'client_manager')
    AND client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
  );

-- client_manager: UPDATE venues of their clients
CREATE POLICY "venues_update_client_manager" ON public.venues FOR UPDATE
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
  )
  WITH CHECK (
    public.has_role_name(auth.uid(), 'client_manager')
    AND client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
  );

-- client_manager: DELETE venues of their clients
CREATE POLICY "venues_delete_client_manager" ON public.venues FOR DELETE
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
  );

-- Other roles: SELECT their assigned venues
CREATE POLICY "venues_select_assigned" ON public.venues FOR SELECT
  USING (id IN (SELECT public.get_user_venue_ids_v2(auth.uid())));

-- ==================
-- EVENTS
-- ==================
-- super_admin: full CRUD
CREATE POLICY "events_all_super_admin" ON public.events FOR ALL
  USING (public.has_role_name(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role_name(auth.uid(), 'super_admin'));

-- client_manager: CRUD on events in their client's venues
CREATE POLICY "events_select_client_manager" ON public.events FOR SELECT
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND venue_id IN (
      SELECT id FROM public.venues WHERE client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
    )
  );

CREATE POLICY "events_insert_client_manager" ON public.events FOR INSERT
  WITH CHECK (
    public.has_role_name(auth.uid(), 'client_manager')
    AND venue_id IN (
      SELECT id FROM public.venues WHERE client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
    )
  );

CREATE POLICY "events_update_client_manager" ON public.events FOR UPDATE
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND venue_id IN (
      SELECT id FROM public.venues WHERE client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
    )
  )
  WITH CHECK (
    public.has_role_name(auth.uid(), 'client_manager')
    AND venue_id IN (
      SELECT id FROM public.venues WHERE client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
    )
  );

CREATE POLICY "events_delete_client_manager" ON public.events FOR DELETE
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND venue_id IN (
      SELECT id FROM public.venues WHERE client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
    )
  );

-- Other roles: SELECT their assigned events
CREATE POLICY "events_select_assigned" ON public.events FOR SELECT
  USING (id IN (SELECT public.get_user_event_ids_v2(auth.uid())));

-- ==================
-- ROLES (reference table)
-- ==================
CREATE POLICY "roles_select_authenticated" ON public.roles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "roles_all_super_admin" ON public.roles FOR ALL
  USING (public.has_role_name(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role_name(auth.uid(), 'super_admin'));

-- ==================
-- USER_ROLES_NEW
-- ==================
-- super_admin: full CRUD
CREATE POLICY "user_roles_new_all_super_admin" ON public.user_roles_new FOR ALL
  USING (public.has_role_name(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role_name(auth.uid(), 'super_admin'));

-- Users can view their own role assignments
CREATE POLICY "user_roles_new_select_own" ON public.user_roles_new FOR SELECT
  USING (user_id = auth.uid());

-- client_manager: manage roles in their venues
CREATE POLICY "user_roles_new_select_client_manager" ON public.user_roles_new FOR SELECT
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND (venue_id IN (
      SELECT id FROM public.venues WHERE client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
    ) OR venue_id IS NULL)
  );

CREATE POLICY "user_roles_new_insert_client_manager" ON public.user_roles_new FOR INSERT
  WITH CHECK (
    public.has_role_name(auth.uid(), 'client_manager')
    AND (venue_id IN (
      SELECT id FROM public.venues WHERE client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
    ))
  );

CREATE POLICY "user_roles_new_delete_client_manager" ON public.user_roles_new FOR DELETE
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND (venue_id IN (
      SELECT id FROM public.venues WHERE client_id IN (SELECT public.get_user_client_ids_v2(auth.uid()))
    ))
  );

-- ==================
-- USER_ROLES (old - keep minimal for backward compat)
-- ==================
CREATE POLICY "user_roles_all_super_admin" ON public.user_roles FOR ALL
  USING (public.has_role_name(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role_name(auth.uid(), 'super_admin'));

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- ==================
-- AUDIT_LOGS
-- ==================
-- super_admin: SELECT all
CREATE POLICY "audit_logs_select_super_admin" ON public.audit_logs FOR SELECT
  USING (public.has_role_name(auth.uid(), 'super_admin'));

-- Authenticated users can INSERT (log their own actions)
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- client_manager: view audit logs for their entities
CREATE POLICY "audit_logs_select_client_manager" ON public.audit_logs FOR SELECT
  USING (
    public.has_role_name(auth.uid(), 'client_manager')
    AND user_id = auth.uid()
  );
