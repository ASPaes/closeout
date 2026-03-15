
-- 1) Create campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  name text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Create campaign_items table
CREATE TABLE public.campaign_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  product_id uuid REFERENCES public.products(id),
  combo_id uuid REFERENCES public.combos(id),
  promo_price numeric,
  discount_percent numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes
CREATE INDEX idx_campaigns_client_id ON public.campaigns(client_id);
CREATE INDEX idx_campaigns_starts_at ON public.campaigns(starts_at);
CREATE INDEX idx_campaigns_ends_at ON public.campaigns(ends_at);
CREATE INDEX idx_campaign_items_campaign_id ON public.campaign_items(campaign_id);
CREATE INDEX idx_campaign_items_product_id ON public.campaign_items(product_id);
CREATE INDEX idx_campaign_items_combo_id ON public.campaign_items(combo_id);

-- 4) updated_at triggers
CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_campaign_items_updated_at
  BEFORE UPDATE ON public.campaign_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5) Validation: ends_at > starts_at
CREATE OR REPLACE FUNCTION public.validate_campaign_dates()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'ends_at must be after starts_at';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_campaign_dates
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_dates();

-- 6) Validation: item_type + target consistency + at least one pricing
CREATE OR REPLACE FUNCTION public.validate_campaign_item()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.item_type NOT IN ('product', 'combo') THEN
    RAISE EXCEPTION 'item_type must be product or combo';
  END IF;

  IF NEW.item_type = 'product' THEN
    IF NEW.product_id IS NULL THEN
      RAISE EXCEPTION 'product_id is required when item_type is product';
    END IF;
    IF NEW.combo_id IS NOT NULL THEN
      RAISE EXCEPTION 'combo_id must be null when item_type is product';
    END IF;
  END IF;

  IF NEW.item_type = 'combo' THEN
    IF NEW.combo_id IS NULL THEN
      RAISE EXCEPTION 'combo_id is required when item_type is combo';
    END IF;
    IF NEW.product_id IS NOT NULL THEN
      RAISE EXCEPTION 'product_id must be null when item_type is combo';
    END IF;
  END IF;

  IF NEW.promo_price IS NULL AND NEW.discount_percent IS NULL THEN
    RAISE EXCEPTION 'At least one of promo_price or discount_percent is required';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_campaign_item
  BEFORE INSERT OR UPDATE ON public.campaign_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_item();

-- 7) FORCE RLS
ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_items FORCE ROW LEVEL SECURITY;

-- 8) RLS policies for campaigns
CREATE POLICY camp_all_super ON public.campaigns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY camp_select_client_admin ON public.campaigns
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY camp_insert_client_admin ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY camp_update_client_admin ON public.campaigns
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY camp_delete_client_admin ON public.campaigns
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- 9) RLS policies for campaign_items (inherit via campaign join)
CREATE POLICY ci_camp_all_super ON public.campaign_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY ci_camp_select_client_admin ON public.campaign_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ));

CREATE POLICY ci_camp_insert_client_admin ON public.campaign_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ));

CREATE POLICY ci_camp_update_client_admin ON public.campaign_items
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ));

CREATE POLICY ci_camp_delete_client_admin ON public.campaign_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      WHERE c.client_id IN (SELECT get_user_client_ids(auth.uid()))
    ));

-- 10) Audit triggers for campaigns
CREATE OR REPLACE FUNCTION public.audit_campaign_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'campaign.created', 'campaign', NEW.id, NULL, to_jsonb(NEW), NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'campaign.updated', 'campaign', NEW.id, to_jsonb(OLD), to_jsonb(NEW), NULL);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_campaign
  AFTER INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.audit_campaign_changes();

-- 11) Audit triggers for campaign_items
CREATE OR REPLACE FUNCTION public.audit_campaign_item_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'campaign_item.added', 'campaign_item', NEW.id, NULL, to_jsonb(NEW), jsonb_build_object('campaign_id', NEW.campaign_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'campaign_item.updated', 'campaign_item', NEW.id, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('campaign_id', NEW.campaign_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(auth.uid(), 'campaign_item.removed', 'campaign_item', OLD.id, to_jsonb(OLD), NULL, jsonb_build_object('campaign_id', OLD.campaign_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_campaign_item
  AFTER INSERT OR UPDATE OR DELETE ON public.campaign_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_campaign_item_changes();
