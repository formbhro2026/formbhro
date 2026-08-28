-- Allow Admin users to claim requests, not just active team members
CREATE OR REPLACE FUNCTION public.claim_request(req_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.requests;
BEGIN
  -- Validate caller is an active team member OR an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE id = auth.uid() AND is_active = true
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not an active team member or admin';
  END IF;

  -- Lock the row for update to prevent race conditions
  SELECT * INTO v_request
  FROM public.requests
  WHERE id = req_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- Check if already assigned
  IF v_request.assigned_team_id IS NOT NULL THEN
    RAISE EXCEPTION 'Request is already assigned';
  END IF;

  -- Cannot claim completed or cancelled requests
  IF v_request.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot claim a completed or cancelled request';
  END IF;

  -- Atomically update
  UPDATE public.requests
  SET 
    assigned_team_id = auth.uid(),
    assigned_at = now(),
    status = CASE WHEN status = 'pending' THEN 'assigned'::public.request_status ELSE status END
  WHERE id = req_id
  RETURNING * INTO v_request;

  RETURN jsonb_build_object('success', true, 'request_id', v_request.id);
END;
$$;

-- Restore EXECUTE permissions
REVOKE EXECUTE ON FUNCTION public.claim_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_request(uuid) TO authenticated;
