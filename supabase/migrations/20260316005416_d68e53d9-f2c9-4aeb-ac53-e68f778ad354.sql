
-- Update delete_stock_entry to handle numeric quantity
CREATE OR REPLACE FUNCTION public.delete_stock_entry(p_entry_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry record;
  _current_qty numeric(12,4);
  _new_qty numeric(12,4);
  _allow_negative boolean;
BEGIN
  SELECT * INTO _entry FROM stock_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock entry not found';
  END IF;

  SELECT quantity_available, allow_negative
  INTO _current_qty, _allow_negative
  FROM stock_balances
  WHERE client_id = _entry.client_id AND product_id = _entry.product_id
  FOR UPDATE;

  IF _entry.entry_type = 'add' THEN
    _new_qty := _current_qty - _entry.quantity;
    IF NOT _allow_negative AND _new_qty < 0 THEN
      RAISE EXCEPTION 'Não é possível excluir: reverter esta entrada resultaria em saldo negativo. Disponível: %', _current_qty;
    END IF;
  ELSIF _entry.entry_type = 'remove' THEN
    _new_qty := _current_qty + _entry.quantity;
  ELSIF _entry.entry_type = 'adjust' THEN
    RAISE EXCEPTION 'Não é possível excluir ajustes de inventário. Crie uma nova movimentação para corrigir.';
  END IF;

  UPDATE stock_balances
  SET quantity_available = _new_qty, updated_at = now()
  WHERE client_id = _entry.client_id AND product_id = _entry.product_id;

  PERFORM log_audit(
    auth.uid(),
    'stock.entry_deleted',
    'stock_entry',
    p_entry_id,
    to_jsonb(_entry),
    NULL,
    jsonb_build_object('reversed_qty', _entry.quantity, 'new_balance', _new_qty)
  );

  DELETE FROM stock_entries WHERE id = p_entry_id;
END;
$function$;

-- Update update_stock_entry to handle numeric quantity
CREATE OR REPLACE FUNCTION public.update_stock_entry(p_entry_id uuid, p_new_quantity numeric, p_new_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry record;
  _current_qty numeric(12,4);
  _reversed_qty numeric(12,4);
  _new_qty numeric(12,4);
  _allow_negative boolean;
BEGIN
  IF p_new_quantity < 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser não-negativa';
  END IF;

  SELECT * INTO _entry FROM stock_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock entry not found';
  END IF;

  SELECT quantity_available, allow_negative
  INTO _current_qty, _allow_negative
  FROM stock_balances
  WHERE client_id = _entry.client_id AND product_id = _entry.product_id
  FOR UPDATE;

  IF _entry.entry_type = 'add' THEN
    _reversed_qty := _current_qty - _entry.quantity;
  ELSIF _entry.entry_type = 'remove' THEN
    _reversed_qty := _current_qty + _entry.quantity;
  ELSIF _entry.entry_type = 'adjust' THEN
    RAISE EXCEPTION 'Não é possível editar ajustes de inventário. Crie uma nova movimentação para corrigir.';
  END IF;

  IF _entry.entry_type = 'add' THEN
    _new_qty := _reversed_qty + p_new_quantity;
  ELSIF _entry.entry_type = 'remove' THEN
    _new_qty := _reversed_qty - p_new_quantity;
    IF NOT _allow_negative AND _new_qty < 0 THEN
      RAISE EXCEPTION 'Não é permitido saldo negativo para este produto. Disponível após reversão: %', _reversed_qty;
    END IF;
  END IF;

  UPDATE stock_balances
  SET quantity_available = _new_qty, updated_at = now()
  WHERE client_id = _entry.client_id AND product_id = _entry.product_id;

  PERFORM log_audit(
    auth.uid(),
    'stock.entry_updated',
    'stock_entry',
    p_entry_id,
    to_jsonb(_entry),
    jsonb_build_object('quantity', p_new_quantity, 'reason', p_new_reason),
    jsonb_build_object('old_balance', _current_qty, 'new_balance', _new_qty)
  );

  UPDATE stock_entries
  SET quantity = p_new_quantity, reason = p_new_reason
  WHERE id = p_entry_id;
END;
$function$;

-- Update apply_stock_entry to use numeric types
CREATE OR REPLACE FUNCTION public.apply_stock_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_qty numeric(12,4);
  _new_qty numeric(12,4);
  _allow_negative boolean;
BEGIN
  INSERT INTO stock_balances (client_id, product_id, quantity_available)
  VALUES (NEW.client_id, NEW.product_id, 0)
  ON CONFLICT (client_id, product_id) DO NOTHING;

  SELECT quantity_available, allow_negative
  INTO _current_qty, _allow_negative
  FROM stock_balances
  WHERE client_id = NEW.client_id AND product_id = NEW.product_id
  FOR UPDATE;

  IF NEW.entry_type = 'add' THEN
    _new_qty := _current_qty + NEW.quantity;
  ELSIF NEW.entry_type = 'remove' THEN
    _new_qty := _current_qty - NEW.quantity;
    IF NOT _allow_negative AND _new_qty < 0 THEN
      RAISE EXCEPTION 'Não é permitido saldo negativo para este produto. Disponível: %', _current_qty;
    END IF;
  ELSIF NEW.entry_type = 'adjust' THEN
    _new_qty := NEW.quantity;
  END IF;

  UPDATE stock_balances
  SET quantity_available = _new_qty, updated_at = now()
  WHERE client_id = NEW.client_id AND product_id = NEW.product_id;

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
$function$;
