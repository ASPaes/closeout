-- Create a SECURITY DEFINER function to safely ensure consumer role exists
CREATE OR REPLACE FUNCTION public.ensure_consumer_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'consumer')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_consumer_role() TO authenticated;

-- Also add a direct RLS policy allowing users to self-assign ONLY the consumer role
CREATE POLICY "ur_insert_own_consumer"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'consumer'::app_role
  AND client_id IS NULL
  AND venue_id IS NULL
  AND event_id IS NULL
);