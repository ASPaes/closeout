
-- 1. Replace handle_new_user() with expanded fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, status, language, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email, 'Usuário'),
    NEW.phone,
    'active',
    'pt-BR',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill missing profiles
INSERT INTO public.profiles (id, name, phone, status, language, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', u.email, 'Usuário'),
  u.phone,
  'active',
  'pt-BR',
  now(),
  now()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
