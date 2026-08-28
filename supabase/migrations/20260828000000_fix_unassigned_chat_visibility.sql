-- Fix RLS policies so Team Members can read unassigned chat rooms, messages, and documents

DROP POLICY IF EXISTS "Team members see assigned chat rooms" ON public.chat_rooms;
CREATE POLICY "Team members see assigned chat rooms"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.requests
    WHERE requests.id = chat_rooms.request_id
    AND (
      requests.assigned_team_id = auth.uid() 
      OR public.is_admin()
      OR (public.is_team() AND requests.assigned_team_id IS NULL)
    )
  )
);

DROP POLICY IF EXISTS "Team members see assigned messages" ON public.messages;
CREATE POLICY "Team members see assigned messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.requests
    WHERE requests.id = messages.request_id
    AND (
      requests.assigned_team_id = auth.uid() 
      OR public.is_admin()
      OR (public.is_team() AND requests.assigned_team_id IS NULL)
    )
  )
);

DROP POLICY IF EXISTS "Team members see assigned documents" ON public.documents;
CREATE POLICY "Team members see assigned documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.requests
    WHERE requests.id = documents.request_id
    AND (
      requests.assigned_team_id = auth.uid() 
      OR public.is_admin()
      OR (public.is_team() AND requests.assigned_team_id IS NULL)
    )
  )
);
