
-- ================================================
-- Catalogs
-- ================================================
CREATE TABLE public.catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogs FORCE ROW LEVEL SECURITY;

CREATE INDEX idx_catalogs_client_id ON public.catalogs(client_id);

CREATE TRIGGER trg_catalogs_updated_at BEFORE UPDATE ON public.catalogs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
CREATE POLICY cat_log_all_super ON public.catalogs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY cat_log_select_client_admin ON public.catalogs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cat_log_insert_client_admin ON public.catalogs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cat_log_update_client_admin ON public.catalogs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cat_log_delete_client_admin ON public.catalogs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- ================================================
-- Catalog Items
-- ================================================
CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  item_type text NOT NULL,
  product_id uuid REFERENCES public.products(id),
  combo_id uuid REFERENCES public.combos(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(catalog_id, item_type, product_id, combo_id)
);

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items FORCE ROW LEVEL SECURITY;

CREATE INDEX idx_catalog_items_catalog_id ON public.catalog_items(catalog_id);

CREATE TRIGGER trg_catalog_items_updated_at BEFORE UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_catalog_item()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.item_type NOT IN ('product', 'combo') THEN
    RAISE EXCEPTION 'item_type must be product or combo';
  END IF;
  IF NEW.item_type = 'product' THEN
    IF NEW.product_id IS NULL THEN RAISE EXCEPTION 'product_id is required for product items'; END IF;
    IF NEW.combo_id IS NOT NULL THEN RAISE EXCEPTION 'combo_id must be null for product items'; END IF;
  ELSIF NEW.item_type = 'combo' THEN
    IF NEW.combo_id IS NULL THEN RAISE EXCEPTION 'combo_id is required for combo items'; END IF;
    IF NEW.product_id IS NOT NULL THEN RAISE EXCEPTION 'product_id must be null for combo items'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_catalog_item BEFORE INSERT OR UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION validate_catalog_item();

-- RLS
CREATE POLICY cli_all_super ON public.catalog_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY cli_select_client_admin ON public.catalog_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cli_insert_client_admin ON public.catalog_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cli_update_client_admin ON public.catalog_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cli_delete_client_admin ON public.catalog_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- ================================================
-- Event Catalogs
-- ================================================
CREATE TABLE public.event_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  catalog_id uuid NOT NULL REFERENCES public.catalogs(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, catalog_id)
);

ALTER TABLE public.event_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_catalogs FORCE ROW LEVEL SECURITY;

CREATE INDEX idx_event_catalogs_event_id ON public.event_catalogs(event_id);
CREATE INDEX idx_event_catalogs_catalog_id ON public.event_catalogs(catalog_id);

-- RLS
CREATE POLICY ec_all_super ON public.event_catalogs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY ec_select_client_admin ON public.event_catalogs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY ec_insert_client_admin ON public.event_catalogs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY ec_update_client_admin ON public.event_catalogs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY ec_delete_client_admin ON public.event_catalogs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- ================================================
-- Audit triggers
-- ================================================
CREATE OR REPLACE FUNCTION public.audit_catalog_changes()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'catalog.created', 'catalog', NEW.id, NULL, to_jsonb(NEW), NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'catalog.updated', 'catalog', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_audit_catalog AFTER INSERT OR UPDATE ON public.catalogs FOR EACH ROW EXECUTE FUNCTION audit_catalog_changes();

CREATE OR REPLACE FUNCTION public.audit_catalog_item_changes()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'catalog_item.added', 'catalog_item', NEW.id, NULL, to_jsonb(NEW), jsonb_build_object('catalog_id', NEW.catalog_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'catalog_item.updated', 'catalog_item', NEW.id, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('catalog_id', NEW.catalog_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(auth.uid(), 'catalog_item.removed', 'catalog_item', OLD.id, to_jsonb(OLD), NULL, jsonb_build_object('catalog_id', OLD.catalog_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_audit_catalog_item AFTER INSERT OR UPDATE OR DELETE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION audit_catalog_item_changes();

CREATE OR REPLACE FUNCTION public.audit_event_catalog_changes()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'event_catalog.linked', 'event_catalog', NEW.id, NULL, to_jsonb(NEW), jsonb_build_object('event_id', NEW.event_id, 'catalog_id', NEW.catalog_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(auth.uid(), 'event_catalog.unlinked', 'event_catalog', OLD.id, to_jsonb(OLD), NULL, jsonb_build_object('event_id', OLD.event_id, 'catalog_id', OLD.catalog_id));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'event_catalog.linked', 'event_catalog', NEW.id, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('event_id', NEW.event_id));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_audit_event_catalog AFTER INSERT OR UPDATE OR DELETE ON public.event_catalogs FOR EACH ROW EXECUTE FUNCTION audit_event_catalog_changes();
