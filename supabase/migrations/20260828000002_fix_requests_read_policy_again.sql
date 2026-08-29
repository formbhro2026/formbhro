-- Restore team visibility of unassigned requests which was lost in phase7_ban_enforcement

DROP POLICY IF EXISTS "requests read" ON public.requests;
CREATE POLICY "requests read" ON public.requests FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_user_active())
    OR (assigned_team_id = auth.uid() AND public.is_active_team_member())
    OR public.has_role(auth.uid(),'admin')
    OR (
        public.is_team() 
        AND assigned_team_id IS NULL
        AND public.is_active_team_member()
    )
  );
