
-- Add allow_negative column
ALTER TABLE public.stock_balances
  ADD COLUMN allow_negative boolean NOT NULL DEFAULT false;

-- Update apply_stock_entry trigger to respect allow_negative
CREATE OR REPLACE FUNCTION public.apply_stock_entry()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _current_qty integer;
  _new_qty integer;
  _allow_negative boolean;
BEGIN
  -- Upsert stock_balances if not exists
  INSERT INTO stock_balances (client_id, product_id, quantity_available)
  VALUES (NEW.client_id, NEW.product_id, 0)
  ON CONFLICT (client_id, product_id) DO NOTHING;

  -- Get current quantity and allow_negative
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
