
-- ============================================================
-- Fix infinite recursion in RLS policies
-- Root cause: venue policies query events, event policies query venues
-- Solution: SECURITY DEFINER functions for cross-table lookups
-- ============================================================

-- 1) Helper: get venue IDs belonging to user's clients (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_venues_for_user_clients(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v.id FROM venues v
  WHERE v.client_id IN (SELECT get_user_client_ids(_user_id))
$$;

-- 2) Helper: get client IDs from user's assigned venues (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_clients_for_user_venues(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT v.client_id FROM venues v
  WHERE v.id IN (SELECT get_user_venue_ids(_user_id))
$$;

-- 3) Helper: get client IDs from user's assigned events (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_clients_for_user_events(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT v.client_id FROM venues v
  JOIN events e ON e.venue_id = v.id
  WHERE e.id IN (SELECT get_user_event_ids(_user_id))
$$;

-- 4) Helper: get venue IDs from user's assigned events (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_venues_for_user_events(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT e.venue_id FROM events e
  WHERE e.id IN (SELECT get_user_event_ids(_user_id))
$$;

-- ============================================================
-- Drop and recreate problematic policies on CLIENTS
-- ============================================================

-- cl_select_venue_manager: was doing inline SELECT on venues
DROP POLICY IF EXISTS "cl_select_venue_manager" ON public.clients;
CREATE POLICY "cl_select_venue_manager"
  ON public.clients FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_clients_for_user_venues(auth.uid())));

-- cl_select_event_assigned: was doing inline SELECT on venues+events
DROP POLICY IF EXISTS "cl_select_event_assigned" ON public.clients;
CREATE POLICY "cl_select_event_assigned"
  ON public.clients FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_clients_for_user_events(auth.uid())));

-- ============================================================
-- Drop and recreate problematic policies on VENUES
-- ============================================================

-- vn_select_event_assigned: was doing inline SELECT on events
DROP POLICY IF EXISTS "vn_select_event_assigned" ON public.venues;
CREATE POLICY "vn_select_event_assigned"
  ON public.venues FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_venues_for_user_events(auth.uid())));

-- ============================================================
-- Drop and recreate problematic policies on EVENTS
-- ============================================================

-- ev_select_client_admin: was doing inline SELECT on venues
DROP POLICY IF EXISTS "ev_select_client_admin" ON public.events;
CREATE POLICY "ev_select_client_admin"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'client_admin'::app_role)
    AND venue_id IN (SELECT get_venues_for_user_clients(auth.uid()))
  );

-- ev_insert_client_admin
DROP POLICY IF EXISTS "ev_insert_client_admin" ON public.events;
CREATE POLICY "ev_insert_client_admin"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'client_admin'::app_role)
    AND venue_id IN (SELECT get_venues_for_user_clients(auth.uid()))
  );

-- ev_update_client_admin
DROP POLICY IF EXISTS "ev_update_client_admin" ON public.events;
CREATE POLICY "ev_update_client_admin"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'client_admin'::app_role)
    AND venue_id IN (SELECT get_venues_for_user_clients(auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(), 'client_admin'::app_role)
    AND venue_id IN (SELECT get_venues_for_user_clients(auth.uid()))
  );

-- ev_delete_client_admin
DROP POLICY IF EXISTS "ev_delete_client_admin" ON public.events;
CREATE POLICY "ev_delete_client_admin"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'client_admin'::app_role)
    AND venue_id IN (SELECT get_venues_for_user_clients(auth.uid()))
  );

-- ============================================================
-- Also fix venue policies for client_admin (they query clients inline via get_user_client_ids which is OK,
-- but let's be consistent and ensure no inline cross-table queries)
-- vn_select_client_admin, vn_insert_client_admin, vn_update_client_admin, vn_delete_client_admin
-- These use client_id IN (SELECT get_user_client_ids(...)) which is fine (no cross-table RLS trigger)
-- ============================================================
