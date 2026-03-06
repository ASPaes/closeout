
-- Create indexes on user_roles_new table
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles_new(user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON public.user_roles_new(role_id);
CREATE INDEX IF NOT EXISTS user_roles_venue_id_idx ON public.user_roles_new(venue_id);
CREATE INDEX IF NOT EXISTS user_roles_event_id_idx ON public.user_roles_new(event_id);

-- Create indexes on venues table
CREATE INDEX IF NOT EXISTS venues_client_id_idx ON public.venues(client_id);

-- Create indexes on events table
CREATE INDEX IF NOT EXISTS events_venue_id_idx ON public.events(venue_id);
CREATE INDEX IF NOT EXISTS events_client_id_idx ON public.events(client_id);
CREATE INDEX IF NOT EXISTS events_status_idx ON public.events(status);
CREATE INDEX IF NOT EXISTS events_start_at_idx ON public.events(start_at);

-- Create indexes on audit_logs table
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
