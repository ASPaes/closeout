
-- ============================================================
-- FASE 1.2 — RLS Geral, Audit Logs e Enums
-- ============================================================

-- 1. Expandir audit_logs
ALTER TABLE audit_logs 
  ADD COLUMN IF NOT EXISTS old_data jsonb,
  ADD COLUMN IF NOT EXISTS new_data jsonb,
  ADD COLUMN IF NOT EXISTS user_role text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 2. Funcao log_audit
CREATE OR REPLACE FUNCTION log_audit(
  p_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  INSERT INTO audit_logs (
    user_id, action, entity_type, entity_id,
    old_data, new_data, metadata, created_at
  ) VALUES (
    p_user_id, p_action, p_entity_type, p_entity_id,
    p_old_data, p_new_data, p_metadata, now()
  );
$$;

-- 3. Criar enums de status
CREATE TYPE order_status AS ENUM (
  'pending', 'paid', 'preparing', 'ready', 'delivered', 'cancelled'
);

CREATE TYPE payment_status AS ENUM (
  'created', 'processing', 'approved', 'failed', 'cancelled'
);

CREATE TYPE qr_status AS ENUM (
  'valid', 'used', 'cancelled', 'invalid'
);

CREATE TYPE stock_movement_type AS ENUM (
  'entry', 'reservation', 'release', 'sale', 'adjustment'
);

CREATE TYPE campaign_status AS ENUM (
  'scheduled', 'active', 'paused', 'ended'
);

CREATE TYPE cash_register_status AS ENUM (
  'open', 'closed'
);

CREATE TYPE waiter_session_status AS ENUM (
  'active', 'closed'
);

CREATE TYPE order_origin AS ENUM (
  'consumer_app', 'waiter_app', 'cashier'
);

-- 4. FORCE RLS em todas as tabelas
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE venues FORCE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- 5. DROP todas as policies RESTRICTIVE existentes
DROP POLICY IF EXISTS al_select_super ON audit_logs;
DROP POLICY IF EXISTS al_select_client_admin ON audit_logs;
DROP POLICY IF EXISTS al_insert_auth ON audit_logs;

DROP POLICY IF EXISTS cl_all_super ON clients;
DROP POLICY IF EXISTS cl_select_client_admin ON clients;
DROP POLICY IF EXISTS cl_update_client_admin ON clients;

DROP POLICY IF EXISTS vn_all_super ON venues;
DROP POLICY IF EXISTS vn_select_client_admin ON venues;
DROP POLICY IF EXISTS vn_insert_client_admin ON venues;
DROP POLICY IF EXISTS vn_update_client_admin ON venues;
DROP POLICY IF EXISTS vn_delete_client_admin ON venues;
DROP POLICY IF EXISTS vn_select_assigned ON venues;

DROP POLICY IF EXISTS ev_all_super ON events;
DROP POLICY IF EXISTS ev_select_client_admin ON events;
DROP POLICY IF EXISTS ev_insert_client_admin ON events;
DROP POLICY IF EXISTS ev_update_client_admin ON events;
DROP POLICY IF EXISTS ev_delete_client_admin ON events;
DROP POLICY IF EXISTS ev_select_assigned ON events;

DROP POLICY IF EXISTS pf_select_own ON profiles;
DROP POLICY IF EXISTS pf_select_super ON profiles;
DROP POLICY IF EXISTS pf_update_own ON profiles;
DROP POLICY IF EXISTS pf_update_super ON profiles;

DROP POLICY IF EXISTS ur_all_super ON user_roles;
DROP POLICY IF EXISTS ur_select_own ON user_roles;
DROP POLICY IF EXISTS ur_select_client_admin ON user_roles;
DROP POLICY IF EXISTS ur_insert_client_admin ON user_roles;
DROP POLICY IF EXISTS ur_update_client_admin ON user_roles;
DROP POLICY IF EXISTS ur_delete_client_admin ON user_roles;

-- 6. Recriar TODAS as policies como PERMISSIVE

-- === audit_logs ===
CREATE POLICY al_select_super_admin ON audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY al_select_client_admin ON audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND user_id = auth.uid());

CREATE POLICY al_insert_authenticated ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- === clients ===
CREATE POLICY cl_all_super ON clients
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY cl_select_client_admin ON clients
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cl_update_client_admin ON clients
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND id IN (SELECT get_user_client_ids(auth.uid())));

-- === venues ===
CREATE POLICY vn_all_super ON venues
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY vn_select_client_admin ON venues
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY vn_insert_client_admin ON venues
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY vn_update_client_admin ON venues
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY vn_delete_client_admin ON venues
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY vn_select_assigned ON venues
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_venue_ids(auth.uid())));

-- === events ===
CREATE POLICY ev_all_super ON events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY ev_select_client_admin ON events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND venue_id IN (SELECT venues.id FROM venues WHERE venues.client_id IN (SELECT get_user_client_ids(auth.uid()))));

CREATE POLICY ev_insert_client_admin ON events
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND venue_id IN (SELECT venues.id FROM venues WHERE venues.client_id IN (SELECT get_user_client_ids(auth.uid()))));

CREATE POLICY ev_update_client_admin ON events
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND venue_id IN (SELECT venues.id FROM venues WHERE venues.client_id IN (SELECT get_user_client_ids(auth.uid()))))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND venue_id IN (SELECT venues.id FROM venues WHERE venues.client_id IN (SELECT get_user_client_ids(auth.uid()))));

CREATE POLICY ev_delete_client_admin ON events
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND venue_id IN (SELECT venues.id FROM venues WHERE venues.client_id IN (SELECT get_user_client_ids(auth.uid()))));

CREATE POLICY ev_select_assigned ON events
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_event_ids(auth.uid())));

-- === profiles ===
CREATE POLICY pf_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY pf_select_super ON profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY pf_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY pf_update_super ON profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- === user_roles ===
CREATE POLICY ur_all_super ON user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY ur_select_own ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY ur_select_client_admin ON user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY ur_insert_client_admin ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY ur_update_client_admin ON user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY ur_delete_client_admin ON user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));
