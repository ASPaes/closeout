
CREATE TABLE IF NOT EXISTS public.product_image_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name text NOT NULL UNIQUE,
  image_path text NOT NULL,
  image_hash text NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_image_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_image_library FORCE ROW LEVEL SECURITY;

CREATE POLICY "pil_select_authenticated" ON public.product_image_library
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pil_all_super" ON public.product_image_library
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
