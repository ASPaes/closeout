
-- ============================================================
-- 1. FIX: event-images storage cross-tenant write
-- Scope INSERT/DELETE to events belonging to the user's client
-- Path convention: events/{event_id}/{filename}
-- ============================================================

DROP POLICY IF EXISTS "event_images_storage_insert" ON storage.objects;
CREATE POLICY "event_images_storage_insert" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      -- Extract event_id from path (events/{event_id}/...)
      -- and verify it belongs to the user's client
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id::text = (storage.foldername(name))[2]
          AND e.client_id IN (SELECT get_user_client_ids(auth.uid()))
      )
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('client_admin', 'client_manager', 'venue_manager', 'event_manager')
      )
    )
  )
);

DROP POLICY IF EXISTS "event_images_storage_delete" ON storage.objects;
CREATE POLICY "event_images_storage_delete" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (
  bucket_id = 'event-images'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id::text = (storage.foldername(name))[2]
          AND e.client_id IN (SELECT get_user_client_ids(auth.uid()))
      )
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('client_admin', 'client_manager', 'venue_manager', 'event_manager')
      )
    )
  )
);

-- ============================================================
-- 2. FIX: waiter_calls insert - add consumer_id ownership check
-- ============================================================
DROP POLICY IF EXISTS "wc_insert_authenticated" ON public.waiter_calls;
CREATE POLICY "wc_insert_consumer" ON public.waiter_calls
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  consumer_id = auth.uid()
  AND event_id IN (
    SELECT event_id FROM public.event_checkins
    WHERE user_id = auth.uid() AND checked_out_at IS NULL
  )
);
