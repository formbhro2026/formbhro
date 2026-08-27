-- Fix the request lifecycle trigger to properly use has_role() instead of LIMIT 1 
-- which can randomly fetch the 'user' role for an admin.

CREATE OR REPLACE FUNCTION public.validate_request_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_uid uuid;
BEGIN
  -- If status hasn't changed, nothing to validate
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- 1. Identity / Assignment checks
  IF auth.role() != 'service_role' THEN
    v_uid := auth.uid();
    
    -- Properly check if caller is admin
    v_is_admin := public.has_role(v_uid, 'admin');

    IF NOT v_is_admin THEN
      -- If they are the user who created it, they can only cancel
      IF NEW.user_id = v_uid THEN
        IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
          -- Allowed
        ELSE
          RAISE EXCEPTION 'Users can only cancel pending requests.';
        END IF;
      -- If they are a team member assigned to the request
      ELSIF OLD.assigned_team_id IS NOT NULL AND OLD.assigned_team_id = v_uid THEN
        -- Allowed to change if assigned to them, continue to state rules
      -- If it's a claim (assigning self to pending request)
      ELSIF OLD.status = 'pending' AND NEW.status = 'assigned' AND NEW.assigned_team_id = v_uid THEN
        -- Allowed, continue to state rules
      ELSE
        RAISE EXCEPTION 'You are not authorized to change the status of this request.';
      END IF;
    END IF;
  END IF;

  -- 2. Terminal State Protections
  IF OLD.status IN ('cancelled', 'closed') THEN
    RAISE EXCEPTION 'Status % is terminal and cannot be changed.', OLD.status;
  END IF;

  -- 3. Matrix Validation
  IF OLD.status = 'pending' AND NEW.status NOT IN ('assigned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'assigned' AND NEW.status NOT IN ('in_progress') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('waiting_documents', 'under_review', 'completed', 'assigned') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'waiting_documents' AND NEW.status NOT IN ('in_progress', 'assigned') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'under_review' AND NEW.status NOT IN ('in_progress', 'completed', 'assigned') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'completed' AND NEW.status NOT IN ('closed') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;
