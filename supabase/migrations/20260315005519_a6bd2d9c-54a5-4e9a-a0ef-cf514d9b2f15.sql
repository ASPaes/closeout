
-- 1) categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

CREATE INDEX idx_categories_client_id ON public.categories(client_id);

-- 2) products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  category_id uuid REFERENCES public.categories(id),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

CREATE INDEX idx_products_client_id ON public.products(client_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);

-- 3) updated_at triggers
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4) RLS policies for categories
CREATE POLICY cat_all_super ON public.categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY cat_select_client_admin ON public.categories
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cat_insert_client_admin ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cat_update_client_admin ON public.categories
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY cat_delete_client_admin ON public.categories
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

-- 5) RLS policies for products
CREATE POLICY prod_all_super ON public.products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY prod_select_client_admin ON public.products
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY prod_insert_client_admin ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY prod_update_client_admin ON public.products
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));

CREATE POLICY prod_delete_client_admin ON public.products
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'client_admin'::app_role)
    AND client_id IN (SELECT get_user_client_ids(auth.uid())));
