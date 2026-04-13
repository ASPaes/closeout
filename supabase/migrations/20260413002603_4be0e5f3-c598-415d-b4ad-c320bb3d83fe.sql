
CREATE OR REPLACE FUNCTION public.create_consumer_split_order(params jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_client_id uuid;
  v_items jsonb;
  v_payments_arr jsonb;
  v_consumer_id uuid;
  v_order_id uuid;
  v_order_number int;
  v_total numeric := 0;
  v_item jsonb;
  v_payment jsonb;
  v_product_row record;
  v_combo_row record;
  v_unit_price numeric;
  v_item_name text;
  v_item_total numeric;
  v_qr_token text;
  v_payment_count int;
  v_payments_total numeric := 0;
  v_has_cash boolean := false;
  v_non_cash_paid numeric := 0;
  v_split_idx int := 0;
  v_order_item_id uuid;
  v_stock_enabled boolean := true;
  v_cash_count int := 0;
  v_methods text[] := '{}';
  v_has_digital boolean := false;
  v_order_status text;
BEGIN
  v_consumer_id := auth.uid();
  IF v_consumer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_event_id := (params->>'event_id')::uuid;
  v_items := params->'items';
  v_payments_arr := params->'payments';

  IF v_event_id IS NULL THEN RAISE EXCEPTION 'event_id is required'; END IF;
  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'items required'; END IF;
  IF v_payments_arr IS NULL OR jsonb_array_length(v_payments_arr) = 0 THEN RAISE EXCEPTION 'payments required'; END IF;

  v_payment_count := jsonb_array_length(v_payments_arr);
  IF v_payment_count > 2 THEN RAISE EXCEPTION 'Maximum 2 payment methods'; END IF;

  -- Validar pagamentos: sem repetição de método, max 1 cash
  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments_arr)
  LOOP
    IF (v_payment->>'amount')::numeric <= 0 THEN
      RAISE EXCEPTION 'Payment amount must be positive';
    END IF;
    IF v_payment->>'method' = ANY(v_methods) THEN
      RAISE EXCEPTION 'Cannot use same method twice';
    END IF;
    v_methods := array_append(v_methods, v_payment->>'method');
    v_payments_total := v_payments_total + (v_payment->>'amount')::numeric;
    IF v_payment->>'method' = 'cash' THEN 
      v_has_cash := true; 
      v_cash_count := v_cash_count + 1;
    ELSE
      v_has_digital := true;
      v_non_cash_paid := v_non_cash_paid + (v_payment->>'amount')::numeric;
    END IF;
  END LOOP;

  -- Buscar client e stock config
  SELECT e.client_id, coalesce(es.stock_control_enabled, e.stock_control_enabled, true)
  INTO v_client_id, v_stock_enabled
  FROM events e LEFT JOIN event_settings es ON es.event_id = e.id
  WHERE e.id = v_event_id AND e.status = 'active';

  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Event not found or not active'; END IF;

  -- Calcular total
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'product_id' IS NOT NULL THEN
      SELECT price, name INTO v_product_row FROM products WHERE id = (v_item->>'product_id')::uuid AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or inactive'; END IF;
      v_unit_price := v_product_row.price; v_item_name := v_product_row.name;
    ELSIF v_item->>'combo_id' IS NOT NULL THEN
      SELECT price, name INTO v_combo_row FROM combos WHERE id = (v_item->>'combo_id')::uuid AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Combo not found or inactive'; END IF;
      v_unit_price := v_combo_row.price; v_item_name := v_combo_row.name;
    ELSE CONTINUE;
    END IF;
    v_total := v_total + (v_unit_price * COALESCE((v_item->>'quantity')::int, 1));
  END LOOP;

  IF abs(v_payments_total - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Payments total (%) != order total (%)', v_payments_total, v_total;
  END IF;

  -- Determinar status do pedido:
  -- 100% cash → partially_paid (garçom confirma)
  -- cash + digital → partially_paid (digital aguarda Asaas, cash aguarda garçom)
  -- 100% digital → pending (aguarda confirmação do Asaas)
  IF v_has_cash THEN
    v_order_status := 'partially_paid';
  ELSE
    v_order_status := 'pending';
  END IF;

  -- Order number
  INSERT INTO cash_order_counters (event_id, next_number) VALUES (v_event_id, 2)
  ON CONFLICT (event_id) DO UPDATE SET next_number = cash_order_counters.next_number + 1, updated_at = now()
  RETURNING next_number - 1 INTO v_order_number;

  -- Criar order
  INSERT INTO orders (
    id, client_id, event_id, consumer_id, origin, order_number,
    status, total, payment_method, is_split_payment, split_paid_amount, paid_at
  ) VALUES (
    gen_random_uuid(), v_client_id, v_event_id, v_consumer_id,
    'consumer_app', v_order_number,
    v_order_status::order_status,
    v_total,
    CASE WHEN v_payment_count = 1 THEN v_methods[1] ELSE 'split' END,
    v_payment_count > 1,
    v_non_cash_paid,
    NULL -- paid_at é sempre NULL agora; o webhook ou garçom setam depois
  ) RETURNING id INTO v_order_id;

  -- Inserir itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF v_item->>'product_id' IS NOT NULL THEN
      SELECT price, name INTO v_product_row FROM products WHERE id = (v_item->>'product_id')::uuid;
      v_unit_price := v_product_row.price; v_item_name := v_product_row.name;
    ELSIF v_item->>'combo_id' IS NOT NULL THEN
      SELECT price, name INTO v_combo_row FROM combos WHERE id = (v_item->>'combo_id')::uuid;
      v_unit_price := v_combo_row.price; v_item_name := v_combo_row.name;
    ELSE CONTINUE;
    END IF;
    v_item_total := v_unit_price * COALESCE((v_item->>'quantity')::int, 1);

    INSERT INTO order_items (order_id, product_id, combo_id, name, quantity, unit_price, total)
    VALUES (
      v_order_id,
      CASE WHEN v_item->>'product_id' IS NOT NULL THEN (v_item->>'product_id')::uuid ELSE NULL END,
      CASE WHEN v_item->>'combo_id' IS NOT NULL THEN (v_item->>'combo_id')::uuid ELSE NULL END,
      v_item_name, COALESCE((v_item->>'quantity')::int, 1), v_unit_price, v_item_total
    );

    -- ESTOQUE: reserva só quando não tem cash (estoque será reservado quando pagamento confirmar para digital)
    IF v_stock_enabled AND NOT v_has_cash AND NOT v_has_digital AND v_item->>'product_id' IS NOT NULL THEN
      -- Cenário impossível (sem cash e sem digital), mantém lógica original
      INSERT INTO stock_reservations(client_id, event_id, order_id, order_item_id, product_id, quantity, status)
      VALUES (v_client_id, v_event_id, v_order_id, 
              (SELECT id FROM order_items WHERE order_id = v_order_id AND product_id = (v_item->>'product_id')::uuid LIMIT 1),
              (v_item->>'product_id')::uuid, COALESCE((v_item->>'quantity')::int, 1), 'reserved');
    END IF;
  END LOOP;

  -- Inserir payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments_arr)
  LOOP
    v_split_idx := v_split_idx + 1;
    INSERT INTO payments (
      client_id, consumer_id, event_id, order_id,
      amount, payment_method, status, paid_at, split_index, split_total
    ) VALUES (
      v_client_id, v_consumer_id, v_event_id, v_order_id,
      (v_payment->>'amount')::numeric, v_payment->>'method',
      CASE WHEN v_payment->>'method' = 'cash' THEN 'created'::payment_status
           ELSE 'processing'::payment_status END,
      NULL, -- paid_at é sempre NULL; o webhook ou garçom setam depois
      v_split_idx, v_total
    );
  END LOOP;

  -- QR token
  v_qr_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO qr_tokens (order_id, token, status) VALUES (v_order_id, v_qr_token, 'valid');

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_number,
    'qr_token', v_qr_token, 'total', v_total,
    'has_cash_pending', v_has_cash,
    'has_digital_pending', v_has_digital AND NOT v_has_cash,
    'status', v_order_status
  );
END;
$function$;
