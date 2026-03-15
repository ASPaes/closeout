
-- ================================================
-- Stock Balances
-- ================================================
CREATE TABLE public.stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity_available integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, product_id)
);

ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances FORCE ROW LEVEL SECURITY;

CREATE INDEX idx_stock_balances_client_id ON public.stock_balances(client_id);
CREATE INDEX idx_stock_balances_product_id ON public.stock_balances(product_id);

-- RLS: super_admin full access
CREATE POLICY sb_all_super ON public.stock_balances FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS: client_admin scoped
CREATE POLICY sb_select_client_admin ON public.stock_balances FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY sb_insert_client_admin ON public.stock_balances FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY sb_update_client_admin ON public.stock_balances FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY sb_delete_client_admin ON public.stock_balances FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- updated_at trigger
CREATE TRIGGER trg_stock_balances_updated_at
  BEFORE UPDATE ON public.stock_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================
-- Stock Entries
-- ================================================
CREATE TABLE public.stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  entry_type text NOT NULL,
  quantity integer NOT NULL,
  reason text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entries FORCE ROW LEVEL SECURITY;

CREATE INDEX idx_stock_entries_client_id ON public.stock_entries(client_id);
CREATE INDEX idx_stock_entries_product_id ON public.stock_entries(product_id);
CREATE INDEX idx_stock_entries_created_at ON public.stock_entries(created_at DESC);

-- RLS: super_admin full access
CREATE POLICY se_all_super ON public.stock_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS: client_admin scoped
CREATE POLICY se_select_client_admin ON public.stock_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY se_insert_client_admin ON public.stock_entries FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- ================================================
-- Validation trigger: entry_type must be add/remove/adjust
-- ================================================
CREATE OR REPLACE FUNCTION public.validate_stock_entry()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.entry_type NOT IN ('add', 'remove', 'adjust') THEN
    RAISE EXCEPTION 'entry_type must be add, remove, or adjust';
  END IF;
  IF NEW.quantity < 0 THEN
    RAISE EXCEPTION 'quantity must be non-negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_stock_entry
  BEFORE INSERT ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION validate_stock_entry();

-- ================================================
-- Auto-update stock_balances on insert to stock_entries
-- ================================================
CREATE OR REPLACE FUNCTION public.apply_stock_entry()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _current_qty integer;
  _new_qty integer;
BEGIN
  -- Upsert stock_balances if not exists
  INSERT INTO stock_balances (client_id, product_id, quantity_available)
  VALUES (NEW.client_id, NEW.product_id, 0)
  ON CONFLICT (client_id, product_id) DO NOTHING;

  -- Get current quantity
  SELECT quantity_available INTO _current_qty
  FROM stock_balances
  WHERE client_id = NEW.client_id AND product_id = NEW.product_id
  FOR UPDATE;

  IF NEW.entry_type = 'add' THEN
    _new_qty := _current_qty + NEW.quantity;
  ELSIF NEW.entry_type = 'remove' THEN
    _new_qty := _current_qty - NEW.quantity;
    IF _new_qty < 0 THEN
      RAISE EXCEPTION 'Cannot remove % units. Only % available.', NEW.quantity, _current_qty;
    END IF;
  ELSIF NEW.entry_type = 'adjust' THEN
    _new_qty := NEW.quantity;
  END IF;

  UPDATE stock_balances
  SET quantity_available = _new_qty, updated_at = now()
  WHERE client_id = NEW.client_id AND product_id = NEW.product_id;

  -- Audit: stock_balance_updated
  PERFORM log_audit(
    auth.uid(),
    'stock.balance_updated',
    'stock_balance',
    (SELECT id FROM stock_balances WHERE client_id = NEW.client_id AND product_id = NEW.product_id),
    jsonb_build_object('quantity_available', _current_qty),
    jsonb_build_object('quantity_available', _new_qty),
    jsonb_build_object('entry_id', NEW.id, 'entry_type', NEW.entry_type, 'quantity', NEW.quantity)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_entry
  AFTER INSERT ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION apply_stock_entry();

-- ================================================
-- Audit trigger for stock_entries
-- ================================================
CREATE OR REPLACE FUNCTION public.audit_stock_entry()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM log_audit(
    auth.uid(),
    'stock.entry_created',
    'stock_entry',
    NEW.id,
    NULL,
    to_jsonb(NEW),
    jsonb_build_object('product_id', NEW.product_id, 'entry_type', NEW.entry_type)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_stock_entry
  AFTER INSERT ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION audit_stock_entry();
