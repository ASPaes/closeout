
-- ============================================================
-- RBAC Consolidation Phase 1.1 — Single atomic migration
-- ============================================================

-- (a) Expand enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'waiter';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'consumer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'event_organizer';

-- (b) Drop ALL existing RESTRICTIVE policies

-- audit_logs
DROP POLICY IF EXISTS audit_logs_select_super_admin ON audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_authenticated ON audit_logs;
DROP POLICY IF EXISTS audit_logs_select_client_manager ON audit_logs;

-- clients
DROP POLICY IF EXISTS clients_all_super_admin ON clients;
DROP POLICY IF EXISTS clients_select_client_manager ON clients;
DROP POLICY IF EXISTS clients_update_client_manager ON clients;

-- events
DROP POLICY IF EXISTS events_all_super_admin ON events;
DROP POLICY IF EXISTS events_select_client_manager ON events;
DROP POLICY IF EXISTS events_insert_client_manager ON events;
DROP POLICY IF EXISTS events_update_client_manager ON events;
DROP POLICY IF EXISTS events_delete_client_manager ON events;
DROP POLICY IF EXISTS events_select_assigned ON events;

-- venues
DROP POLICY IF EXISTS venues_all_super_admin ON venues;
DROP POLICY IF EXISTS venues_select_client_manager ON venues;
DROP POLICY IF EXISTS venues_insert_client_manager ON venues;
DROP POLICY IF EXISTS venues_update_client_manager ON venues;
DROP POLICY IF EXISTS venues_delete_client_manager ON venues;
DROP POLICY IF EXISTS venues_select_assigned ON venues;

-- profiles
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_select_super_admin ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_update_super_admin ON profiles;

-- roles
DROP POLICY IF EXISTS roles_select_authenticated ON roles;
DROP POLICY IF EXISTS roles_all_super_admin ON roles;

-- user_roles_new
DROP POLICY IF EXISTS user_roles_new_all_super_admin ON user_roles_new;
DROP POLICY IF EXISTS user_roles_new_select_own ON user_roles_new;
DROP POLICY IF EXISTS user_roles_new_select_client_manager ON user_roles_new;
DROP POLICY IF EXISTS user_roles_new_insert_client_manager ON user_roles_new;
DROP POLICY IF EXISTS user_roles_new_delete_client_manager ON user_roles_new;

-- user_roles
DROP POLICY IF EXISTS user_roles_all_super_admin ON user_roles;
DROP POLICY IF EXISTS user_roles_select_own ON user_roles;

-- (c) Drop obsolete tables and functions
DROP TABLE IF EXISTS user_roles_new CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP FUNCTION IF EXISTS get_user_client_ids_v2(uuid);
DROP FUNCTION IF EXISTS get_user_event_ids_v2(uuid);
DROP FUNCTION IF EXISTS get_user_venue_ids_v2(uuid);
DROP FUNCTION IF EXISTS has_role_name(uuid, text);

-- (d) Recreate all policies as PERMISSIVE (default)

-- == audit_logs ==
CREATE POLICY al_select_super ON audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY al_select_client_admin ON audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND user_id = auth.uid());

CREATE POLICY al_insert_auth ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- == clients ==
CREATE POLICY cl_all_super ON clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY cl_select_client_admin ON clients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND id IN (SELECT public.get_user_client_ids(auth.uid())));

CREATE POLICY cl_update_client_admin ON clients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND id IN (SELECT public.get_user_client_ids(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'client_admin') AND id IN (SELECT public.get_user_client_ids(auth.uid())));

-- == venues ==
CREATE POLICY vn_all_super ON venues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY vn_select_client_admin ON venues FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())));

CREATE POLICY vn_insert_client_admin ON venues FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())));

CREATE POLICY vn_update_client_admin ON venues FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())));

CREATE POLICY vn_delete_client_admin ON venues FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())));

CREATE POLICY vn_select_assigned ON venues FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_venue_ids(auth.uid())));

-- == events ==
CREATE POLICY ev_all_super ON events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY ev_select_client_admin ON events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND venue_id IN (SELECT id FROM venues WHERE client_id IN (SELECT public.get_user_client_ids(auth.uid()))));

CREATE POLICY ev_insert_client_admin ON events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'client_admin') AND venue_id IN (SELECT id FROM venues WHERE client_id IN (SELECT public.get_user_client_ids(auth.uid()))));

CREATE POLICY ev_update_client_admin ON events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND venue_id IN (SELECT id FROM venues WHERE client_id IN (SELECT public.get_user_client_ids(auth.uid()))))
  WITH CHECK (public.has_role(auth.uid(), 'client_admin') AND venue_id IN (SELECT id FROM venues WHERE client_id IN (SELECT public.get_user_client_ids(auth.uid()))));

CREATE POLICY ev_delete_client_admin ON events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND venue_id IN (SELECT id FROM venues WHERE client_id IN (SELECT public.get_user_client_ids(auth.uid()))));

CREATE POLICY ev_select_assigned ON events FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_event_ids(auth.uid())));

-- == profiles ==
CREATE POLICY pf_select_own ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY pf_select_super ON profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY pf_update_own ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY pf_update_super ON profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- == user_roles — FORCE RLS ==
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY ur_all_super ON user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY ur_select_own ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY ur_select_client_admin ON user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())));

CREATE POLICY ur_insert_client_admin ON user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())));

CREATE POLICY ur_update_client_admin ON user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())));

CREATE POLICY ur_delete_client_admin ON user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'client_admin') AND client_id IN (SELECT public.get_user_client_ids(auth.uid())));

-- (e) Create get_my_roles()
CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS TABLE(role app_role, client_id uuid, venue_id uuid, event_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role, client_id, venue_id, event_id
  FROM user_roles
  WHERE user_id = auth.uid();
$$;
