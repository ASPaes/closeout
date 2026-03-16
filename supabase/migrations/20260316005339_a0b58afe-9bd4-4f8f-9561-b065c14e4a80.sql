
-- 1) PRODUCTS: add unit/ingredient fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_sellable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_stock_tracked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_ingredient boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_unit text,
  ADD COLUMN IF NOT EXISTS base_unit text,
  ADD COLUMN IF NOT EXISTS base_per_stock_unit numeric;

-- Validation trigger for products unit fields
CREATE OR REPLACE FUNCTION public.validate_product_units()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_stock_tracked = true THEN
    IF NEW.stock_unit IS NULL OR NEW.base_unit IS NULL OR NEW.base_per_stock_unit IS NULL THEN
      RAISE EXCEPTION 'stock_unit, base_unit and base_per_stock_unit are required when is_stock_tracked is true';
    END IF;
    IF NEW.base_per_stock_unit <= 0 THEN
      RAISE EXCEPTION 'base_per_stock_unit must be greater than 0';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_units ON public.products;
CREATE TRIGGER trg_validate_product_units
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_units();

-- 2) STOCK: fractional balances
ALTER TABLE public.stock_balances
  ALTER COLUMN quantity_available TYPE numeric(12,4) USING quantity_available::numeric(12,4);

ALTER TABLE public.stock_balances
  ALTER COLUMN low_stock_threshold TYPE numeric(12,4) USING low_stock_threshold::numeric(12,4);

-- Also update stock_entries quantity to support fractional
ALTER TABLE public.stock_entries
  ALTER COLUMN quantity TYPE numeric(12,4) USING quantity::numeric(12,4);

-- 3) RECIPES (BOM) table
CREATE TABLE public.product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_base numeric NOT NULL,
  base_unit text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_product_id)
);

-- Validation trigger: quantity_base > 0 and product != ingredient
CREATE OR REPLACE FUNCTION public.validate_product_recipe()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.quantity_base <= 0 THEN
    RAISE EXCEPTION 'quantity_base must be greater than 0';
  END IF;
  IF NEW.product_id = NEW.ingredient_product_id THEN
    RAISE EXCEPTION 'product_id and ingredient_product_id must be different';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_product_recipe
  BEFORE INSERT OR UPDATE ON public.product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_recipe();

-- updated_at trigger
CREATE TRIGGER trg_product_recipes_updated_at
  BEFORE UPDATE ON public.product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX idx_product_recipes_client_id ON public.product_recipes(client_id);
CREATE INDEX idx_product_recipes_product_id ON public.product_recipes(product_id);
CREATE INDEX idx_product_recipes_ingredient_product_id ON public.product_recipes(ingredient_product_id);

-- RLS
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipes FORCE ROW LEVEL SECURITY;

CREATE POLICY pr_all_super ON public.product_recipes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY pr_select_client_admin ON public.product_recipes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY pr_insert_client_admin ON public.product_recipes
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY pr_update_client_admin ON public.product_recipes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY pr_delete_client_admin ON public.product_recipes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- Audit trigger for product_recipes
CREATE OR REPLACE FUNCTION public.audit_product_recipe_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit(auth.uid(), 'recipe.created', 'product_recipe', NEW.id, NULL, to_jsonb(NEW), jsonb_build_object('product_id', NEW.product_id, 'ingredient_id', NEW.ingredient_product_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit(auth.uid(), 'recipe.updated', 'product_recipe', NEW.id, to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('product_id', NEW.product_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit(auth.uid(), 'recipe.removed', 'product_recipe', OLD.id, to_jsonb(OLD), NULL, jsonb_build_object('product_id', OLD.product_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_product_recipe
  AFTER INSERT OR UPDATE OR DELETE ON public.product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.audit_product_recipe_changes();
