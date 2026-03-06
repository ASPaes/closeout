
-- ============================================
-- Close Out Foundation: Database Schema
-- ============================================

-- 1. Enum for roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'client_admin', 'venue_manager', 'event_manager', 'staff');

-- 2. Enum for event status
CREATE TYPE public.event_status AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- 3. Clients table (tenant root)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Venues table
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  capacity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status public.event_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, client_id, venue_id, event_id)
);

-- 8. Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Functions
-- ============================================

-- has_role: check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- get_user_client_ids: returns client IDs user can access
CREATE OR REPLACE FUNCTION public.get_user_client_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT client_id FROM public.user_roles
  WHERE user_id = _user_id AND client_id IS NOT NULL
$$;

-- get_user_venue_ids: returns venue IDs user can access
CREATE OR REPLACE FUNCTION public.get_user_venue_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT venue_id FROM public.user_roles
  WHERE user_id = _user_id AND venue_id IS NOT NULL
$$;

-- get_user_event_ids: returns event IDs user can access
CREATE OR REPLACE FUNCTION public.get_user_event_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT event_id FROM public.user_roles
  WHERE user_id = _user_id AND event_id IS NOT NULL
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- RLS Policies
-- ============================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- User Roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Client admins can view roles in their client" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'client_admin')
    AND client_id IN (SELECT public.get_user_client_ids(auth.uid()))
  );

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their clients" ON public.clients
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_client_ids(auth.uid())));

-- Venues
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all venues" ON public.venues
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Client admins can manage their venues" ON public.venues
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'client_admin')
    AND client_id IN (SELECT public.get_user_client_ids(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'client_admin')
    AND client_id IN (SELECT public.get_user_client_ids(auth.uid()))
  );

CREATE POLICY "Users can view their venues" ON public.venues
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT public.get_user_client_ids(auth.uid()))
    OR id IN (SELECT public.get_user_venue_ids(auth.uid()))
  );

-- Events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all events" ON public.events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Client admins can manage events in their venues" ON public.events
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'client_admin')
    AND venue_id IN (
      SELECT v.id FROM public.venues v
      WHERE v.client_id IN (SELECT public.get_user_client_ids(auth.uid()))
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'client_admin')
    AND venue_id IN (
      SELECT v.id FROM public.venues v
      WHERE v.client_id IN (SELECT public.get_user_client_ids(auth.uid()))
    )
  );

CREATE POLICY "Venue managers can manage events in their venues" ON public.events
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'venue_manager')
    AND venue_id IN (SELECT public.get_user_venue_ids(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'venue_manager')
    AND venue_id IN (SELECT public.get_user_venue_ids(auth.uid()))
  );

CREATE POLICY "Users can view their events" ON public.events
  FOR SELECT TO authenticated
  USING (
    venue_id IN (SELECT public.get_user_venue_ids(auth.uid()))
    OR id IN (SELECT public.get_user_event_ids(auth.uid()))
    OR venue_id IN (
      SELECT v.id FROM public.venues v
      WHERE v.client_id IN (SELECT public.get_user_client_ids(auth.uid()))
    )
  );

-- Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_venues_client_id ON public.venues(client_id);
CREATE INDEX idx_events_venue_id ON public.events(venue_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_client_id ON public.user_roles(client_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
