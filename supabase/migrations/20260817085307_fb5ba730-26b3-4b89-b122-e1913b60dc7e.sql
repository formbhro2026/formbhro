-- RLS for requests table
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins see all requests" ON public.requests;
CREATE POLICY "Admins see all requests"
ON public.requests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Team members see assigned requests" ON public.requests;
CREATE POLICY "Team members see assigned requests"
ON public.requests
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'team') 
  AND (assigned_team_id = auth.uid() OR assigned_team_id IS NULL)
);

DROP POLICY IF EXISTS "Team members update assigned requests" ON public.requests;
CREATE POLICY "Team members update assigned requests"
ON public.requests
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'team') 
  AND assigned_team_id = auth.uid()
);

-- Ensure chat_rooms and messages are accessible to the assigned team member
DROP POLICY IF EXISTS "Team members see assigned chat rooms" ON public.chat_rooms;
CREATE POLICY "Team members see assigned chat rooms"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.requests
    WHERE requests.id = chat_rooms.request_id
    AND (requests.assigned_team_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
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
    AND (requests.assigned_team_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "Team members send messages to assigned" ON public.messages;
CREATE POLICY "Team members send messages to assigned"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.requests
    WHERE requests.id = messages.request_id
    AND (requests.assigned_team_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
