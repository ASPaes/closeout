
-- ============================
-- 1. event_images table
-- ============================
CREATE TABLE public.event_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  storage_path text NOT NULL,
  public_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_event_images_event_id ON public.event_images(event_id);
CREATE INDEX idx_event_images_client_id ON public.event_images(client_id);
CREATE INDEX idx_event_images_event_sort ON public.event_images(event_id, sort_order);

-- ============================
-- 2. RLS
-- ============================
ALTER TABLE public.event_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_images FORCE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "event_images_all_super_admin"
ON public.event_images FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Client managers: access own client images
CREATE POLICY "event_images_all_client_manager"
ON public.event_images FOR ALL
TO authenticated
USING (
  client_id IN (SELECT public.get_user_client_ids(auth.uid()))
)
WITH CHECK (
  client_id IN (SELECT public.get_user_client_ids(auth.uid()))
);

-- Consumer/public: read only for active events
CREATE POLICY "event_images_select_public"
ON public.event_images FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_images.event_id
      AND e.status = 'active'
  )
);

-- ============================
-- 3. Constraint: max 5 images per event (trigger)
-- ============================
CREATE OR REPLACE FUNCTION public.validate_event_images_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.event_images
  WHERE event_id = NEW.event_id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 images per event';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_event_images_limit
BEFORE INSERT ON public.event_images
FOR EACH ROW
EXECUTE FUNCTION public.validate_event_images_limit();

-- ============================
-- 4. Storage bucket
-- ============================
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "event_images_storage_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'event-images');

CREATE POLICY "event_images_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('client_admin', 'client_manager', 'venue_manager', 'event_manager')
    )
  )
);

CREATE POLICY "event_images_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-images'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('client_admin', 'client_manager', 'venue_manager', 'event_manager')
    )
  )
);

-- Public/anon read for public bucket
CREATE POLICY "event_images_storage_public_select"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'event-images');
