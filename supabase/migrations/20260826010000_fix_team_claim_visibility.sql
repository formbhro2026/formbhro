-- ========================================================================================
-- PHASE 2: TEAM VISIBILITY & ATOMIC CLAIMING
-- Fixes visibility of unassigned chats for team members and introduces an atomic claim RPC
-- ========================================================================================

-- 1. Update the 'requests read' policy so active Team Members can see unassigned requests.
DROP POLICY IF EXISTS "requests read" ON public.requests;
CREATE POLICY "requests read" ON public.requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR assigned_team_id = auth.uid() 
    OR public.is_admin()
    OR (
        public.is_team() 
        AND assigned_team_id IS NULL
        -- Optional: Only allow reading if the team member is active, although is_team() is usually sufficient. 
        -- To be extra strict per audit:
        AND EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.id = auth.uid() AND tm.is_active = true)
    )
  );

-- 2. Create the secure atomic claim function
CREATE OR REPLACE FUNCTION public.claim_request(req_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.requests;
BEGIN
  -- Validate caller is an active team member
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Not an active team member';
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
