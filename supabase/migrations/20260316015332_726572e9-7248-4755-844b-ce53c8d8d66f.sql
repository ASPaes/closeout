
-- 1) billing_rules table
CREATE TABLE public.billing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  rule_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  fee_percent numeric,
  monthly_amount numeric,
  billing_day integer,
  activation_amount numeric,
  currency text NOT NULL DEFAULT 'BRL',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_billing_rules_client_id ON public.billing_rules(client_id);
CREATE INDEX idx_billing_rules_rule_type ON public.billing_rules(rule_type);

-- updated_at trigger
CREATE TRIGGER trg_billing_rules_updated_at
  BEFORE UPDATE ON public.billing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_billing_rule()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rule_type NOT IN ('transaction_fee', 'monthly_saas', 'activation_fee') THEN
    RAISE EXCEPTION 'rule_type must be transaction_fee, monthly_saas, or activation_fee';
  END IF;

  IF NEW.rule_type = 'transaction_fee' THEN
    IF NEW.fee_percent IS NULL THEN
      RAISE EXCEPTION 'fee_percent is required for transaction_fee';
    END IF;
    IF NEW.fee_percent < 0 OR NEW.fee_percent > 100 THEN
      RAISE EXCEPTION 'fee_percent must be between 0 and 100';
    END IF;
  END IF;

  IF NEW.rule_type = 'monthly_saas' THEN
    IF NEW.monthly_amount IS NULL OR NEW.monthly_amount <= 0 THEN
      RAISE EXCEPTION 'monthly_amount must be greater than 0 for monthly_saas';
    END IF;
    IF NEW.billing_day IS NOT NULL AND (NEW.billing_day < 1 OR NEW.billing_day > 28) THEN
      RAISE EXCEPTION 'billing_day must be between 1 and 28';
    END IF;
  END IF;

  IF NEW.rule_type = 'activation_fee' THEN
    IF NEW.activation_amount IS NULL OR NEW.activation_amount <= 0 THEN
      RAISE EXCEPTION 'activation_amount must be greater than 0 for activation_fee';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_billing_rule
  BEFORE INSERT OR UPDATE ON public.billing_rules
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_rule();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_billing_rule_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'billing_rule.created', 'billing_rule', NEW.id, NULL, to_jsonb(NEW), jsonb_build_object('client_id', NEW.client_id, 'rule_type', NEW.rule_type));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'billing_rule.updated', 'billing_rule', NEW.id, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('client_id', NEW.client_id, 'rule_type', NEW.rule_type));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_billing_rule
  AFTER INSERT OR UPDATE ON public.billing_rules
  FOR EACH ROW EXECUTE FUNCTION public.audit_billing_rule_changes();

-- RLS
ALTER TABLE public.billing_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY "br_all_super" ON public.billing_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "br_select_client_admin" ON public.billing_rules
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));


-- 2) event_billing_overrides table
CREATE TABLE public.event_billing_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  billing_rule_id uuid NOT NULL REFERENCES public.billing_rules(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  fee_percent numeric,
  monthly_amount numeric,
  activation_amount numeric,
  currency text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, billing_rule_id)
);

-- Indexes
CREATE INDEX idx_ebo_event_id ON public.event_billing_overrides(event_id);
CREATE INDEX idx_ebo_client_id ON public.event_billing_overrides(client_id);

-- updated_at trigger
CREATE TRIGGER trg_ebo_updated_at
  BEFORE UPDATE ON public.event_billing_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_event_billing_override()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.fee_percent IS NOT NULL AND (NEW.fee_percent < 0 OR NEW.fee_percent > 100) THEN
    RAISE EXCEPTION 'fee_percent must be between 0 and 100';
  END IF;
  IF NEW.monthly_amount IS NOT NULL AND NEW.monthly_amount <= 0 THEN
    RAISE EXCEPTION 'monthly_amount must be greater than 0';
  END IF;
  IF NEW.activation_amount IS NOT NULL AND NEW.activation_amount <= 0 THEN
    RAISE EXCEPTION 'activation_amount must be greater than 0';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ebo
  BEFORE INSERT OR UPDATE ON public.event_billing_overrides
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_billing_override();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_event_billing_override_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'event_billing_override.created', 'event_billing_override', NEW.id, NULL, to_jsonb(NEW), jsonb_build_object('event_id', NEW.event_id, 'billing_rule_id', NEW.billing_rule_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'event_billing_override.updated', 'event_billing_override', NEW.id, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('event_id', NEW.event_id, 'billing_rule_id', NEW.billing_rule_id));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_ebo
  AFTER INSERT OR UPDATE ON public.event_billing_overrides
  FOR EACH ROW EXECUTE FUNCTION public.audit_event_billing_override_changes();

-- RLS
ALTER TABLE public.event_billing_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY "ebo_all_super" ON public.event_billing_overrides
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "ebo_select_client_admin" ON public.event_billing_overrides
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));
