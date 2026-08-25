-- 1. Ensure a trigger exists to create a profile and default 'user' role for every new auth user.
-- This ensures they appear in the Admin Panel immediately after signing up.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, auth_provider)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    new.raw_app_meta_data->>'provider'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Assign default 'user' role if no role exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$$;

-- Apply the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill profiles and user_roles for any existing auth users who might be missing them.
INSERT INTO public.profiles (id, email, full_name, auth_provider)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'User'), raw_app_meta_data->>'provider'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Ensure the 'authenticated' and 'service_role' have SELECT access to these tables for the Admin Panel.
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO service_role;
