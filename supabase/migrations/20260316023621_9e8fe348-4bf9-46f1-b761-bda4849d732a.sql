-- Allow expires_at to be NULL for lifetime invites
ALTER TABLE public.user_invites ALTER COLUMN expires_at DROP NOT NULL;