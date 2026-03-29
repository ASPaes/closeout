
-- 1. Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- 2. Unique index on lowercase username (partial, only non-null)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- 3. Validation trigger for username format
CREATE OR REPLACE FUNCTION public.validate_profile_username()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.username IS NOT NULL AND NEW.username !~ '^[a-z0-9._]{3,30}$' THEN
    RAISE EXCEPTION 'Invalid username: must be 3-30 chars, lowercase letters, numbers, dots and underscores only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_username ON public.profiles;
CREATE TRIGGER trg_validate_profile_username
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_username();

-- 4. Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS policies for avatars
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- 6. RPC: check_username_available
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(p_username)
      AND id != auth.uid()
  );
$$;

-- 7. RPC: set_checkin_visibility
CREATE OR REPLACE FUNCTION public.set_checkin_visibility(p_visible boolean)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.event_checkins
  SET is_visible = p_visible
  WHERE user_id = auth.uid()
    AND checked_out_at IS NULL;
END;
$$;

-- 8. RPC: get_consumer_profile_stats
CREATE OR REPLACE FUNCTION public.get_consumer_profile_stats()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_orders', (
      SELECT count(*) FROM public.orders
      WHERE consumer_id = auth.uid()
        AND status IN ('paid', 'preparing', 'ready', 'delivered')
    ),
    'total_spent', (
      SELECT coalesce(sum(total), 0) FROM public.orders
      WHERE consumer_id = auth.uid()
        AND status IN ('paid', 'preparing', 'ready', 'delivered')
    ),
    'total_events', (
      SELECT count(DISTINCT event_id) FROM public.event_checkins
      WHERE user_id = auth.uid()
    )
  );
$$;
