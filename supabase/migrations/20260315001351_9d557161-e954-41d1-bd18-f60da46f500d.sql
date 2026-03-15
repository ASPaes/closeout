
-- Create user_invites table
CREATE TABLE public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  email text,
  role app_role NOT NULL,
  client_id uuid REFERENCES public.clients(id),
  venue_id uuid REFERENCES public.venues(id),
  event_id uuid REFERENCES public.events(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites FORCE ROW LEVEL SECURITY;

-- super_admin full access
CREATE POLICY "ui_all_super" ON public.user_invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
