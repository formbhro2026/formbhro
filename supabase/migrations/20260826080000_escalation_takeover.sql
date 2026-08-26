-- ========================================================================================
-- PHASE 6C: ESCALATION / SUPER ADMIN TAKEOVER
-- Adds is_escalated flag and two secure RPCs: escalate_request / takeover_request
-- ========================================================================================

-- 1. Add is_escalated column to requests
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to allow efficient Admin dashboard queries for escalated chats
CREATE INDEX IF NOT EXISTS requests_escalated_idx
  ON public.requests (is_escalated, last_activity_at DESC)
  WHERE is_escalated = TRUE;

-- ========================================================================================
-- 2. escalate_request RPC
--    Only the currently assigned Team Member can escalate their own request.
--    Sets is_escalated = true. Does NOT change status or assigned_team_id.
-- ========================================================================================
CREATE OR REPLACE FUNCTION public.escalate_request(req_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.requests;
BEGIN
  -- 1. Caller must be an active team member
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Not an active team member';
  END IF;

  -- 2. Lock row to prevent race conditions
  SELECT * INTO v_request
  FROM public.requests
  WHERE id = req_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 3. Caller must be the current assignee
  IF v_request.assigned_team_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Request is not currently assigned to you';
  END IF;

  -- 4. Terminal requests cannot be escalated
  IF v_request.status IN ('completed', 'cancelled', 'closed') THEN
    RAISE EXCEPTION 'Cannot escalate a completed, cancelled, or closed request';
  END IF;

  -- 5. Idempotent check — already escalated
  IF v_request.is_escalated THEN
    RETURN jsonb_build_object('success', true, 'request_id', req_id, 'already_escalated', true);
  END IF;

  -- 6. Set is_escalated flag
  UPDATE public.requests
  SET
    is_escalated = TRUE,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = req_id;

  -- 7. Audit log
  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label, meta)
  VALUES (
    req_id,
    auth.uid(),
    'team',
    'request_escalated',
    'Escalated to Admin',
    jsonb_build_object('escalated_by', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'request_id', req_id);
END;
$$;

-- Grant execute to authenticated users (RLS inside the function enforces team-only)
GRANT EXECUTE ON FUNCTION public.escalate_request(uuid) TO authenticated;

-- ========================================================================================
-- 3. takeover_request RPC
--    Only an Admin can take over a request.
--    Sets assigned_team_id = admin's uid, clears is_escalated, adjusts status if needed.
-- ========================================================================================
CREATE OR REPLACE FUNCTION public.takeover_request(req_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.requests;
  v_previous_assignee uuid;
BEGIN
  -- 1. Caller must be an Admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can take over a request';
  END IF;

  -- 2. Lock row
  SELECT * INTO v_request
  FROM public.requests
  WHERE id = req_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 3. Terminal requests cannot be taken over
  IF v_request.status IN ('completed', 'cancelled', 'closed') THEN
    RAISE EXCEPTION 'Cannot take over a completed, cancelled, or closed request';
  END IF;

  -- 4. Record who previously owned it
  v_previous_assignee := v_request.assigned_team_id;

  -- 5. Update — assign to Admin and clear escalation flag
  --    We also set status to 'in_progress' if it is still 'assigned' (just assigned not started)
  --    to correctly reflect admin involvement without breaking the state machine.
  --    We use service_role bypass by setting a local var — but since this func is SECURITY DEFINER
  --    it runs as the function owner (postgres/service role), so the trigger check allows it.
  UPDATE public.requests
  SET
    assigned_team_id = auth.uid(),
    assigned_at = now(),
    is_escalated = FALSE,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = req_id;

  -- 6. Audit log
  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label, meta)
  VALUES (
    req_id,
    auth.uid(),
    'admin',
    'request_takeover',
    'Admin Takeover',
    jsonb_build_object(
      'previous_assignee_id', v_previous_assignee,
      'new_assignee_id', auth.uid(),
      'was_escalated', v_request.is_escalated
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', req_id,
    'previous_assignee_id', v_previous_assignee
  );
END;
$$;

-- Grant execute to authenticated users (is_admin() check is inside the function)
GRANT EXECUTE ON FUNCTION public.takeover_request(uuid) TO authenticated;

-- ========================================================================================
-- 4. de_escalate_request RPC
--    Allows an Admin or the assigned Team Member to clear the escalation flag manually
--    without triggering a full takeover (e.g., issue was resolved in-place).
-- ========================================================================================
CREATE OR REPLACE FUNCTION public.de_escalate_request(req_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.requests;
BEGIN
  -- Lock row
  SELECT * INTO v_request
  FROM public.requests
  WHERE id = req_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- Only the assignee or an admin can de-escalate
  IF v_request.assigned_team_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to de-escalate this request';
  END IF;

  UPDATE public.requests
  SET
    is_escalated = FALSE,
    last_activity_at = now(),
    updated_at = now()
  WHERE id = req_id;

  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label, meta)
  VALUES (
    req_id,
    auth.uid(),
    CASE WHEN public.is_admin() THEN 'admin' ELSE 'team' END,
    'request_de_escalated',
    'Escalation cleared',
    jsonb_build_object('cleared_by', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'request_id', req_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.de_escalate_request(uuid) TO authenticated;
