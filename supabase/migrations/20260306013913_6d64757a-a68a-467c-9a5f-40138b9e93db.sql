
-- Create roles table for RBAC
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;

-- Create RLS policies
-- Super admins can manage all roles
CREATE POLICY "Super admins can manage all roles"
ON public.roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Authenticated users can view roles
CREATE POLICY "Authenticated users can view roles"
ON public.roles
FOR SELECT
USING (auth.role() = 'authenticated');

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Full system access and administration'),
  ('client_manager', 'Manages clients and their venues'),
  ('cashier', 'Manages payments and transactions'),
  ('bar_staff', 'Prepares and serves drinks'),
  ('waiter', 'Serves customers and takes orders'),
  ('consumer', 'Customer/end-user access');
