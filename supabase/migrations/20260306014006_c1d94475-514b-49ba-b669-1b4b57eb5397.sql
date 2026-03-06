
-- Create user_roles table (new schema, separate from existing user_roles enum-based system)
CREATE TABLE public.user_roles_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id, venue_id, event_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_roles_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles_new FORCE ROW LEVEL SECURITY;

-- Create RLS policies
-- Super admins can manage all user role assignments
CREATE POLICY "Super admins can manage all user roles"
ON public.user_roles_new
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Users can view their own role assignments
CREATE POLICY "Users can view own role assignments"
ON public.user_roles_new
FOR SELECT
USING (user_id = auth.uid());

-- Client admins can view and manage roles within their client's venues
CREATE POLICY "Client admins can manage roles in their venues"
ON public.user_roles_new
FOR ALL
USING (
  public.has_role(auth.uid(), 'client_admin'::app_role) AND
  (venue_id IN (
    SELECT id FROM public.venues
    WHERE client_id IN (SELECT public.get_user_client_ids(auth.uid()))
  ) OR venue_id IS NULL)
)
WITH CHECK (
  public.has_role(auth.uid(), 'client_admin'::app_role) AND
  (venue_id IN (
    SELECT id FROM public.venues
    WHERE client_id IN (SELECT public.get_user_client_ids(auth.uid()))
  ) OR venue_id IS NULL)
);

-- Venue managers can manage roles within their venues
CREATE POLICY "Venue managers can manage roles in their venues"
ON public.user_roles_new
FOR ALL
USING (
  public.has_role(auth.uid(), 'venue_manager'::app_role) AND
  (venue_id IN (SELECT public.get_user_venue_ids(auth.uid())))
)
WITH CHECK (
  public.has_role(auth.uid(), 'venue_manager'::app_role) AND
  (venue_id IN (SELECT public.get_user_venue_ids(auth.uid())))
);
