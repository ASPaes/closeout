
CREATE OR REPLACE FUNCTION public.get_client_managers(p_client_id uuid)
RETURNS TABLE(user_id uuid, user_name text, user_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT DISTINCT ur.user_id, p.name, u.email::text
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  JOIN auth.users u ON u.id = ur.user_id
  WHERE (
    ur.role IN ('super_admin', 'client_admin', 'client_manager')
    AND (ur.client_id = p_client_id OR ur.client_id IS NULL)
  )
  ORDER BY p.name;
$$;
