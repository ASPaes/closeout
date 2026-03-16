
-- 1) Create private bucket for client logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', false)
ON CONFLICT (id) DO NOTHING;

-- 2) RLS policies for storage.objects on client-logos bucket
-- super_admin can upload (INSERT)
CREATE POLICY "sa_insert_client_logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-logos'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- super_admin can update
CREATE POLICY "sa_update_client_logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-logos'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'client-logos'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- super_admin can delete
CREATE POLICY "sa_delete_client_logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-logos'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- super_admin can read
CREATE POLICY "sa_select_client_logos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-logos'
  AND public.has_role(auth.uid(), 'super_admin'::public.app_role)
);
