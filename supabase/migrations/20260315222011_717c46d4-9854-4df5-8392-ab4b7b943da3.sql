
-- 1) Create combos table
CREATE TABLE public.combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Create combo_items table
CREATE TABLE public.combo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes
CREATE INDEX idx_combos_client_id ON public.combos(client_id);
CREATE INDEX idx_combo_items_combo_id ON public.combo_items(combo_id);
CREATE INDEX idx_combo_items_product_id ON public.combo_items(product_id);

-- 4) updated_at triggers
CREATE TRIGGER set_combos_updated_at
  BEFORE UPDATE ON public.combos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_combo_items_updated_at
  BEFORE UPDATE ON public.combo_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5) Validate combo_items client_id matches combo client_id
CREATE OR REPLACE FUNCTION public.validate_combo_item_client()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
DECLARE
  _combo_client_id uuid;
  _product_client_id uuid;
BEGIN
  SELECT client_id INTO _combo_client_id FROM combos WHERE id = NEW.combo_id;
  SELECT client_id INTO _product_client_id FROM products WHERE id = NEW.product_id;

  IF _combo_client_id IS DISTINCT FROM _product_client_id THEN
    RAISE EXCEPTION 'Product client_id does not match combo client_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_combo_item_client
  BEFORE INSERT OR UPDATE ON public.combo_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_combo_item_client();

-- 6) FORCE RLS
ALTER TABLE public.combos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items FORCE ROW LEVEL SECURITY;

-- 7) RLS policies for combos
-- super_admin: full access
CREATE POLICY combo_all_super ON public.combos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- client_admin: CRUD scoped to own clients
CREATE POLICY combo_select_client_admin ON public.combos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY combo_insert_client_admin ON public.combos
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY combo_update_client_admin ON public.combos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY combo_delete_client_admin ON public.combos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- 8) RLS policies for combo_items (inherit access via combo join)
CREATE POLICY ci_all_super ON public.combo_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY ci_select_client_admin ON public.combo_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND combo_id IN (
      SELECT c.id FROM combos c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ));

CREATE POLICY ci_insert_client_admin ON public.combo_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND combo_id IN (
      SELECT c.id FROM combos c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ));

CREATE POLICY ci_update_client_admin ON public.combo_items
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND combo_id IN (
      SELECT c.id FROM combos c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND combo_id IN (
      SELECT c.id FROM combos c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ));

CREATE POLICY ci_delete_client_admin ON public.combo_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND combo_id IN (
      SELECT c.id FROM combos c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ));

-- 9) Audit triggers for combos
CREATE OR REPLACE FUNCTION public.audit_combo_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'combo.created', 'combo', NEW.id, NULL, to_jsonb(NEW), NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'combo.updated', 'combo', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_combo
  AFTER INSERT OR UPDATE ON public.combos
  FOR EACH ROW EXECUTE FUNCTION public.audit_combo_changes();

-- 10) Audit triggers for combo_items
CREATE OR REPLACE FUNCTION public.audit_combo_item_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'combo_item.added', 'combo_item', NEW.id, NULL, to_jsonb(NEW), jsonb_build_object('combo_id', NEW.combo_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'combo_item.updated', 'combo_item', NEW.id, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('combo_id', NEW.combo_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(auth.uid(), 'combo_item.removed', 'combo_item', OLD.id, to_jsonb(OLD), NULL, jsonb_build_object('combo_id', OLD.combo_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_combo_item
  AFTER INSERT OR UPDATE OR DELETE ON public.combo_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_combo_item_changes();
