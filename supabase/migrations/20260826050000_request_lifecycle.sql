-- Migration: Request Lifecycle State Machine

-- 1. Add `closed` status if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'request_status' AND e.enumlabel = 'closed') THEN
    ALTER TYPE public.request_status ADD VALUE 'closed' AFTER 'completed';
  END IF;
END $$;

-- 2. State Machine Trigger Function
CREATE OR REPLACE FUNCTION public.validate_request_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_uid uuid;
BEGIN
  -- If status hasn't changed, nothing to validate
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- 1. Identity / Assignment checks
  IF auth.role() != 'service_role' THEN
    v_uid := auth.uid();
    
    -- Find if caller is admin
    SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_uid LIMIT 1;

    IF v_role != 'admin' THEN
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

-- 3. Attach Trigger
DROP TRIGGER IF EXISTS requests_status_lifecycle ON public.requests;
CREATE TRIGGER requests_status_lifecycle
  BEFORE UPDATE OF status ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_request_transition();
