-- ========================================================================================
-- PHASE 6B: TEAM-TO-TEAM CHAT TRANSFER
-- Secure PostgreSQL RPC to allow Team Members to transfer their assigned chats
-- ========================================================================================

CREATE OR REPLACE FUNCTION public.transfer_request(req_id uuid, new_assignee_id uuid)
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  v_request public.requests;
  v_target_name text;
BEGIN
  -- 1. Validate caller is an active team member
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Not an active team member';
  END IF;

  -- 2. Validate target is an active team member and not the caller
  IF new_assignee_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot transfer a request to yourself';
  END IF;

  SELECT full_name INTO v_target_name
  FROM public.profiles 
  INNER JOIN public.team_members tm ON tm.id = profiles.id
  WHERE profiles.id = new_assignee_id AND tm.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target is not an active team member';
  END IF;

  -- 3. Lock the row for update to prevent race conditions
  SELECT * INTO v_request
  FROM public.requests
  WHERE id = req_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 4. Verify the caller is the CURRENT assignee
  IF v_request.assigned_team_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Request is not currently assigned to you';
  END IF;

  -- 5. Reject terminal requests
  IF v_request.status IN ('completed', 'cancelled', 'closed') THEN
    RAISE EXCEPTION 'Cannot transfer a completed, cancelled, or closed request';
  END IF;

  -- 6. Atomically update the assignment
  -- We deliberately DO NOT change the status here, allowing the state machine
  -- to process it. If it is 'in_progress', it stays 'in_progress', etc.
  UPDATE public.requests
  SET 
    assigned_team_id = new_assignee_id,
    assigned_at = now(),
    last_activity_at = now()
  WHERE id = req_id
  RETURNING * INTO v_request;

  -- 7. Record the transfer in activity_logs
  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label, meta)
  VALUES (
    req_id, 
    auth.uid(), 
    'team', 
    'request_transferred', 
    'Transferred to ' || COALESCE(v_target_name, 'team member'),
    jsonb_build_object('previous_assignee_id', auth.uid(), 'new_assignee_id', new_assignee_id)
  );

  RETURN jsonb_build_object('success', true, 'request_id', v_request.id, 'new_assignee_id', new_assignee_id);
END;
$$;
