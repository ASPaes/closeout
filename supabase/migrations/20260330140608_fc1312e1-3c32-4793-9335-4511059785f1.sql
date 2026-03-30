CREATE OR REPLACE FUNCTION public.create_waiter_order(params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_event_id uuid;
  v_client_id uuid;
  v_consumer_id uuid;
  v_payment_method text;
  v_items jsonb;

  v_order_id uuid;
  v_qr_token text;
  v_total numeric := 0;
  v_order_number int;

  rec jsonb;
  v_qty int;
  v_product_id uuid;
  v_combo_id uuid;
  v_unit_price numeric;
  v_item_total numeric;
  v_order_item_id uuid;

  v_stock_enabled boolean := true;
  v_cash_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_event_id := (params->>'event_id')::uuid;
  v_payment_method := coalesce(params->>'payment_method','');
  v_items := params->'items';
  v_consumer_id := nullif(params->>'consumer_id','')::uuid;

  if v_event_id is null then
    raise exception 'event_id is required';
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items)=0 then
    raise exception 'items[] is required';
  end if;

  if not public.is_waiter_for_event(v_event_id) then
    raise exception 'User is not a waiter for this event';
  end if;

  if v_payment_method not in ('cash','pix','pos','credit_card','debit_card') then
    raise exception 'Invalid payment_method';
  end if;

  select e.client_id,
         coalesce(es.stock_control_enabled, e.stock_control_enabled, true)
    into v_client_id, v_stock_enabled
  from public.events e
  left join public.event_settings es on es.event_id = e.id
  where e.id = v_event_id;

  if v_client_id is null then
    raise exception 'Event not found';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_event_id::text));
  select coalesce(max(order_number),0) + 1 into v_order_number
  from public.orders
  where event_id = v_event_id;

  insert into public.orders(
    client_id, event_id, origin, consumer_id, waiter_id, order_number, status, total, payment_method
  ) values (
    v_client_id, v_event_id, 'waiter_app'::order_origin,
    v_consumer_id, auth.uid(), v_order_number,
    'pending'::order_status, 0, v_payment_method
  ) returning id into v_order_id;

  for rec in select * from jsonb_array_elements(v_items)
  loop
    v_qty := coalesce((rec->>'quantity')::int, 0);
    if v_qty <= 0 then raise exception 'Invalid quantity'; end if;

    v_product_id := null;
    v_combo_id := null;
    v_unit_price := null;

    if rec ? 'product_id' then
      v_product_id := (rec->>'product_id')::uuid;
      select p.price into v_unit_price
      from public.products p
      where p.id = v_product_id and p.is_active = true;

      if v_unit_price is null then raise exception 'Product not found/active'; end if;

    elsif rec ? 'combo_id' then
      v_combo_id := (rec->>'combo_id')::uuid;
      select c.price into v_unit_price
      from public.combos c
      where c.id = v_combo_id and c.is_active = true;

      if v_unit_price is null then raise exception 'Combo not found/active'; end if;
    else
      raise exception 'Each item must include product_id or combo_id';
    end if;

    v_item_total := (v_unit_price * v_qty);
    v_total := v_total + v_item_total;

    insert into public.order_items(
      order_id, product_id, combo_id, name, quantity, unit_price, total, notes
    ) values (
      v_order_id,
      v_product_id,
      v_combo_id,
      coalesce(
        (select p.name from public.products p where p.id=v_product_id),
        (select c.name from public.combos c where c.id=v_combo_id),
        'Item'
      ),
      v_qty, v_unit_price, v_item_total,
      nullif(rec->>'notes','')
    ) returning id into v_order_item_id;

    if v_stock_enabled and v_product_id is not null then
      insert into public.stock_reservations(
        client_id, event_id, order_id, order_item_id, product_id, quantity, status
      ) values (
        v_client_id, v_event_id, v_order_id, v_order_item_id, v_product_id, v_qty, 'reserved'
      );
    end if;
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  v_qr_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.qr_tokens(order_id, token) values (v_order_id, v_qr_token);

  if v_payment_method = 'cash' then
    update public.orders
      set paid_at = now()
    where id = v_order_id;

    begin
      insert into public.payments(order_id, consumer_id, client_id, event_id, amount, payment_method, status, paid_at)
      values (
        v_order_id,
        coalesce(v_consumer_id, auth.uid()),
        v_client_id,
        v_event_id,
        v_total,
        'cash',
        'approved'::payment_status,
        now()
      );
    exception when others then
      null;
    end;

    update public.waiter_sessions
      set cash_collected = cash_collected + v_total
    where waiter_id = auth.uid()
      and event_id = v_event_id
      and status = 'active'::waiter_session_status;

  else
    insert into public.payments(order_id, consumer_id, client_id, event_id, amount, payment_method, status)
    values (
      v_order_id,
      coalesce(v_consumer_id, auth.uid()),
      v_client_id,
      v_event_id,
      v_total,
      case when v_payment_method='pos' then 'debit_card' else v_payment_method end,
      'created'::payment_status
    );
  end if;

  return jsonb_build_object('ok', true, 'order_id', v_order_id, 'qr_token', v_qr_token);
end;
$function$;