
-- ================================================
-- Event Settings
-- ================================================
CREATE TABLE public.event_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  geo_radius_meters integer NOT NULL DEFAULT 500,
  max_order_value numeric,
  unretrieved_order_alert_minutes integer NOT NULL DEFAULT 15,
  stock_control_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_settings FORCE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_event_settings_event_id ON public.event_settings(event_id);
CREATE INDEX idx_event_settings_client_id ON public.event_settings(client_id);

-- RLS: super_admin full access
CREATE POLICY es_all_super ON public.event_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS: client_admin scoped
CREATE POLICY es_select_client_admin ON public.event_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY es_insert_client_admin ON public.event_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY es_update_client_admin ON public.event_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY es_delete_client_admin ON public.event_settings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- updated_at trigger
CREATE TRIGGER trg_event_settings_updated_at
  BEFORE UPDATE ON public.event_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================
-- Audit trigger for event_settings
-- ================================================
CREATE OR REPLACE FUNCTION public.audit_event_settings_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'event_settings.created', 'event_settings', NEW.id, NULL, to_jsonb(NEW), jsonb_build_object('event_id', NEW.event_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'event_settings.updated', 'event_settings', NEW.id, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('event_id', NEW.event_id));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_event_settings
  AFTER INSERT OR UPDATE ON public.event_settings
  FOR EACH ROW EXECUTE FUNCTION audit_event_settings_changes();
