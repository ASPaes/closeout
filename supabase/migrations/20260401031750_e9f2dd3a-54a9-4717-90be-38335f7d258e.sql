
-- Fix consumer_event_stats_secure view (still security_barrier, not security_invoker)
ALTER VIEW public.consumer_event_stats_secure SET (security_invoker = true);

-- Fix close_cash_register overload (2 params) - preserve exact logic
CREATE OR REPLACE FUNCTION public.close_cash_register(p_register_id uuid, p_closing_balance numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_reg public.cash_registers%rowtype;
  v_cash_sales numeric(12,2);
  v_mov_in numeric(12,2);
  v_mov_out numeric(12,2);
  v_refunds numeric(12,2);
  v_expected numeric(12,2);
  v_diff numeric(12,2);
begin
  if p_closing_balance is null then
    raise exception 'closing_balance_required';
  end if;

  select * into v_reg
  from public.cash_registers
  where id = p_register_id;

  if not found then
    raise exception 'cash_register_not_found';
  end if;

  if not (
    public.is_super_admin()
    or public.is_client_manager(v_reg.client_id)
    or v_reg.operator_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  if v_reg.status = 'closed' then
    raise exception 'already_closed';
  end if;

  select coalesce(sum(total), 0)::numeric(12,2)
    into v_cash_sales
  from public.cash_orders
  where cash_register_id = v_reg.id
    and status = 'completed'
    and payment_method = 'cash';

  select coalesce(sum(amount), 0)::numeric(12,2)
    into v_mov_in
  from public.cash_movements
  where cash_register_id = v_reg.id
    and direction = 'in';

  select coalesce(sum(amount), 0)::numeric(12,2)
    into v_mov_out
  from public.cash_movements
  where cash_register_id = v_reg.id
    and direction = 'out';

  select coalesce(sum(refund_amount), 0)::numeric(12,2)
    into v_refunds
  from public.returns
  where cash_register_id = v_reg.id;

  v_expected := (v_reg.opening_balance + v_cash_sales + v_mov_in - v_mov_out - v_refunds)::numeric(12,2);
  v_diff := (p_closing_balance - v_expected)::numeric(12,2);

  update public.cash_registers
     set status = 'closed',
         closed_at = now(),
         closing_balance = p_closing_balance
   where id = v_reg.id;

  return jsonb_build_object(
    'data', jsonb_build_object(
      'cash_register_id', v_reg.id,
      'client_id', v_reg.client_id,
      'event_id', v_reg.event_id,
      'operator_id', v_reg.operator_id,
      'opened_at', v_reg.opened_at,
      'closed_at', now(),
      'opening_balance', v_reg.opening_balance,
      'cash_sales', v_cash_sales,
      'movements_in', v_mov_in,
      'movements_out', v_mov_out,
      'refunds', v_refunds,
      'expected_balance', v_expected,
      'closing_balance', p_closing_balance,
      'difference', v_diff
    )
  );
end;
$$;

-- Fix has_role overload (1 param)
CREATE OR REPLACE FUNCTION public.has_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text = p_role
  );
$$;

-- Fix has_role_in_client overload (2 params)
CREATE OR REPLACE FUNCTION public.has_role_in_client(p_role text, p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.client_id = p_client_id
      and ur.role::text = p_role
  );
$$;
