-- Re-grant SELECT on public.profiles and public.user_roles for the Admin Panel
-- This is necessary after the REVOKE ALL in the previous migrations.
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO service_role;
