
-- RPC: create_consumer_order
-- Creates order, order_items, payment, qr_token in one transaction
-- Returns order_id, order_number, qr_token

CREATE OR REPLACE FUNCTION public.create_consumer_order(params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_client_id uuid;
  v_payment_method text;
  v_items jsonb;
  v_consumer_id uuid;
  v_order_id uuid;
  v_order_number int;
  v_total numeric := 0;
  v_item jsonb;
  v_product_row record;
  v_combo_row record;
  v_unit_price numeric;
  v_item_name text;
  v_item_total numeric;
  v_payment_id uuid;
  v_qr_token text;
BEGIN
  -- Extract params
  v_event_id := (params->>'event_id')::uuid;
  v_payment_method := params->>'payment_method';
  v_items := params->'items';
  v_consumer_id := auth.uid();

  IF v_consumer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get client_id from event
  SELECT client_id INTO v_client_id FROM events WHERE id = v_event_id;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Get next order number (upsert counter)
  INSERT INTO cash_order_counters (event_id, next_number)
  VALUES (v_event_id, 2)
  ON CONFLICT (event_id) DO UPDATE SET
    next_number = cash_order_counters.next_number + 1,
    updated_at = now()
  RETURNING next_number - 1 INTO v_order_number;

  -- Calculate total from DB prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'product_id' IS NOT NULL THEN
      SELECT price, name INTO v_product_row FROM products WHERE id = (v_item->>'product_id')::uuid;
      v_unit_price := v_product_row.price;
      v_item_name := v_product_row.name;
    ELSIF v_item->>'combo_id' IS NOT NULL THEN
      SELECT price, name INTO v_combo_row FROM combos WHERE id = (v_item->>'combo_id')::uuid;
      v_unit_price := v_combo_row.price;
      v_item_name := v_combo_row.name;
    ELSE
      CONTINUE;
    END IF;

    v_total := v_total + (v_unit_price * COALESCE((v_item->>'quantity')::int, 1));
  END LOOP;

  -- Create order
  INSERT INTO orders (
    id, client_id, event_id, consumer_id, origin, order_number,
    status, total, payment_method, paid_at
  ) VALUES (
    gen_random_uuid(), v_client_id, v_event_id, v_consumer_id,
    'consumer_app', v_order_number, 'paid', v_total, v_payment_method, now()
  ) RETURNING id INTO v_order_id;

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'product_id' IS NOT NULL THEN
      SELECT price, name INTO v_product_row FROM products WHERE id = (v_item->>'product_id')::uuid;
      v_unit_price := v_product_row.price;
      v_item_name := v_product_row.name;
    ELSIF v_item->>'combo_id' IS NOT NULL THEN
      SELECT price, name INTO v_combo_row FROM combos WHERE id = (v_item->>'combo_id')::uuid;
      v_unit_price := v_combo_row.price;
      v_item_name := v_combo_row.name;
    ELSE
      CONTINUE;
    END IF;

    v_item_total := v_unit_price * COALESCE((v_item->>'quantity')::int, 1);

    INSERT INTO order_items (order_id, product_id, combo_id, name, quantity, unit_price, total)
    VALUES (
      v_order_id,
      CASE WHEN v_item->>'product_id' IS NOT NULL THEN (v_item->>'product_id')::uuid ELSE NULL END,
      CASE WHEN v_item->>'combo_id' IS NOT NULL THEN (v_item->>'combo_id')::uuid ELSE NULL END,
      v_item_name,
      COALESCE((v_item->>'quantity')::int, 1),
      v_unit_price,
      v_item_total
    );
  END LOOP;

  -- Create payment record
  INSERT INTO payments (
    client_id, consumer_id, event_id, order_id,
    amount, payment_method, status, paid_at
  ) VALUES (
    v_client_id, v_consumer_id, v_event_id, v_order_id,
    v_total, v_payment_method, 'approved', now()
  ) RETURNING id INTO v_payment_id;

  -- Generate unique QR token
  v_qr_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO qr_tokens (order_id, token, status)
  VALUES (v_order_id, v_qr_token, 'valid');

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'qr_token', v_qr_token,
    'total', v_total
  );
END;
$$;
