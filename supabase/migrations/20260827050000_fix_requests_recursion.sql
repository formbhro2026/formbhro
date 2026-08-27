-- Fix infinite recursion in requests read policy
-- Caused by team members read policy querying requests, and requests querying team members.
-- We use a SECURITY DEFINER function to break the loop.

CREATE OR REPLACE FUNCTION public.is_active_team_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND is_active = true);
$$;

DROP POLICY IF EXISTS "requests read" ON public.requests;
CREATE POLICY "requests read" ON public.requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR assigned_team_id = auth.uid() 
    OR public.is_admin()
    OR (
        public.is_team() 
        AND assigned_team_id IS NULL
        AND public.is_active_team_member()
    )
  );
