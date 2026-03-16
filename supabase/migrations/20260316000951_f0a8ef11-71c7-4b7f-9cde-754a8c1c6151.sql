
-- Function to delete a stock entry and reverse its balance effect
CREATE OR REPLACE FUNCTION public.delete_stock_entry(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entry record;
  _current_qty integer;
  _new_qty integer;
  _allow_negative boolean;
BEGIN
  -- Get the entry
  SELECT * INTO _entry FROM stock_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock entry not found';
  END IF;

  -- Get current balance
  SELECT quantity_available, allow_negative
  INTO _current_qty, _allow_negative
  FROM stock_balances
  WHERE client_id = _entry.client_id AND product_id = _entry.product_id
  FOR UPDATE;

  -- Reverse the effect
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

  -- Update balance
  UPDATE stock_balances
  SET quantity_available = _new_qty, updated_at = now()
  WHERE client_id = _entry.client_id AND product_id = _entry.product_id;

  -- Audit
  PERFORM log_audit(
    auth.uid(),
    'stock.entry_deleted',
    'stock_entry',
    p_entry_id,
    to_jsonb(_entry),
    NULL,
    jsonb_build_object('reversed_qty', _entry.quantity, 'new_balance', _new_qty)
  );

  -- Delete entry
  DELETE FROM stock_entries WHERE id = p_entry_id;
END;
$$;

-- Function to update a stock entry (quantity and reason) reversing old effect and applying new
CREATE OR REPLACE FUNCTION public.update_stock_entry(p_entry_id uuid, p_new_quantity integer, p_new_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entry record;
  _current_qty integer;
  _reversed_qty integer;
  _new_qty integer;
  _allow_negative boolean;
BEGIN
  IF p_new_quantity < 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser não-negativa';
  END IF;

  -- Get the entry
  SELECT * INTO _entry FROM stock_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock entry not found';
  END IF;

  -- Get current balance
  SELECT quantity_available, allow_negative
  INTO _current_qty, _allow_negative
  FROM stock_balances
  WHERE client_id = _entry.client_id AND product_id = _entry.product_id
  FOR UPDATE;

  -- Reverse old effect
  IF _entry.entry_type = 'add' THEN
    _reversed_qty := _current_qty - _entry.quantity;
  ELSIF _entry.entry_type = 'remove' THEN
    _reversed_qty := _current_qty + _entry.quantity;
  ELSIF _entry.entry_type = 'adjust' THEN
    RAISE EXCEPTION 'Não é possível editar ajustes de inventário. Crie uma nova movimentação para corrigir.';
  END IF;

  -- Apply new effect
  IF _entry.entry_type = 'add' THEN
    _new_qty := _reversed_qty + p_new_quantity;
  ELSIF _entry.entry_type = 'remove' THEN
    _new_qty := _reversed_qty - p_new_quantity;
    IF NOT _allow_negative AND _new_qty < 0 THEN
      RAISE EXCEPTION 'Não é permitido saldo negativo para este produto. Disponível após reversão: %', _reversed_qty;
    END IF;
  END IF;

  -- Update balance
  UPDATE stock_balances
  SET quantity_available = _new_qty, updated_at = now()
  WHERE client_id = _entry.client_id AND product_id = _entry.product_id;

  -- Audit
  PERFORM log_audit(
    auth.uid(),
    'stock.entry_updated',
    'stock_entry',
    p_entry_id,
    to_jsonb(_entry),
    jsonb_build_object('quantity', p_new_quantity, 'reason', p_new_reason),
    jsonb_build_object('old_balance', _current_qty, 'new_balance', _new_qty)
  );

  -- Update entry
  UPDATE stock_entries
  SET quantity = p_new_quantity, reason = p_new_reason
  WHERE id = p_entry_id;
END;
$$;
