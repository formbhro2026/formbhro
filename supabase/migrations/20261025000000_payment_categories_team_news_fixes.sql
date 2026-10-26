-- Migration: 20261025000000_payment_categories_team_news_fixes.sql
-- Description: Add payment_status to requests, allow direct completion in request transition trigger,
--              grant category delete permissions for admins, and grant news management for team & admins.

-- 1. Add payment_status to requests table
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'paid', 'unpaid', 'waived', 'failed'));

CREATE INDEX IF NOT EXISTS idx_requests_payment_status ON public.requests(payment_status);

-- 2. Update Request Transition Trigger to permit direct transition to 'completed'
--    from assigned, in_progress, waiting_documents, and under_review.
CREATE OR REPLACE FUNCTION public.validate_request_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- If status is not changing, skip validation
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- 1. Identify Actor Role
  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- 2. Terminal State Protections
  IF OLD.status IN ('cancelled', 'closed') AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Status % is terminal and cannot be changed.', OLD.status;
  END IF;

  -- 3. Matrix Validation for Active Workflow
  -- Operational statuses: assigned, in_progress, waiting_documents, under_review, completed
  IF OLD.status = 'pending' AND NEW.status NOT IN ('assigned', 'in_progress', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'assigned' AND NEW.status NOT IN ('in_progress', 'waiting_documents', 'under_review', 'completed', 'pending', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('waiting_documents', 'under_review', 'completed', 'assigned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'waiting_documents' AND NEW.status NOT IN ('in_progress', 'under_review', 'completed', 'assigned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'under_review' AND NEW.status NOT IN ('in_progress', 'waiting_documents', 'completed', 'assigned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'completed' AND NEW.status NOT IN ('closed', 'under_review', 'in_progress') THEN
    -- Admin or team reopening completed request to under_review/in_progress or marking closed
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  END IF;

  -- Auto-set completed_at and progress when marking completed
  IF NEW.status = 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.progress := 100;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Permissions on Categories (Enable Admin Delete)
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

DROP POLICY IF EXISTS "categories admin delete" ON public.categories;
CREATE POLICY "categories admin delete"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Permissions on News (Enable Team & Admin Management)
GRANT ALL ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;

DROP POLICY IF EXISTS "news admin write" ON public.news;
DROP POLICY IF EXISTS "news team write" ON public.news;
CREATE POLICY "news team write"
  ON public.news
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_team())
  WITH CHECK (public.is_admin() OR public.is_team());
