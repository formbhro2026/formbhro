-- Fix security issues found by linter
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;

-- Explicitly allow only postgres to run it (service_role will have it by default as owner)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Re-grant SELECT on public.profiles and public.user_roles for the Admin Panel
-- This is necessary after the REVOKE ALL in the previous migrations.
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO service_role;
