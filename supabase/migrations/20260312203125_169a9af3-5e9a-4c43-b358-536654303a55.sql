
-- =============================================
-- Additional RLS policies for granular role access
-- =============================================

-- VENUES: venue_manager can update their assigned venues
CREATE POLICY "vn_update_venue_manager"
  ON public.venues FOR UPDATE
  TO authenticated
  USING (id IN (SELECT get_user_venue_ids(auth.uid())))
  WITH CHECK (id IN (SELECT get_user_venue_ids(auth.uid())));

-- EVENTS: venue_manager can manage events at their venues
CREATE POLICY "ev_select_venue_manager"
  ON public.events FOR SELECT
  TO authenticated
  USING (venue_id IN (SELECT get_user_venue_ids(auth.uid())));

CREATE POLICY "ev_insert_venue_manager"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (venue_id IN (SELECT get_user_venue_ids(auth.uid())));

CREATE POLICY "ev_update_venue_manager"
  ON public.events FOR UPDATE
  TO authenticated
  USING (venue_id IN (SELECT get_user_venue_ids(auth.uid())))
  WITH CHECK (venue_id IN (SELECT get_user_venue_ids(auth.uid())));

-- EVENTS: event_manager can update their assigned events
CREATE POLICY "ev_update_event_manager"
  ON public.events FOR UPDATE
  TO authenticated
  USING (id IN (SELECT get_user_event_ids(auth.uid())))
  WITH CHECK (id IN (SELECT get_user_event_ids(auth.uid())));

-- VENUES: allow SELECT for users assigned to events at that venue
CREATE POLICY "vn_select_event_assigned"
  ON public.venues FOR SELECT
  TO authenticated
  USING (id IN (
    SELECT DISTINCT e.venue_id FROM events e
    WHERE e.id IN (SELECT get_user_event_ids(auth.uid()))
  ));

-- CLIENTS: allow SELECT for users assigned to venues/events under that client
CREATE POLICY "cl_select_venue_manager"
  ON public.clients FOR SELECT
  TO authenticated
  USING (id IN (
    SELECT DISTINCT v.client_id FROM venues v
    WHERE v.id IN (SELECT get_user_venue_ids(auth.uid()))
  ));

CREATE POLICY "cl_select_event_assigned"
  ON public.clients FOR SELECT
  TO authenticated
  USING (id IN (
    SELECT DISTINCT v.client_id FROM venues v
    JOIN events e ON e.venue_id = v.id
    WHERE e.id IN (SELECT get_user_event_ids(auth.uid()))
  ));

-- AUDIT_LOGS: allow insert via log_audit function (SECURITY DEFINER) already handles this,
-- but ensure venue_manager/event_manager can also insert their own logs
-- (already covered by al_insert_authenticated)

-- PROFILES: consumer can only see own profile (already covered by pf_select_own + pf_update_own)
