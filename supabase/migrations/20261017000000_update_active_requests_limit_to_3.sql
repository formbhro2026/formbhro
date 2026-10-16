-- Migration: 20261017000000_update_active_requests_limit_to_3.sql
-- Description: Increase permitted active requests limit from 1 to 3 per user

-- 1. Drop the legacy unique index that restricted users to exactly 1 active request
DROP INDEX IF EXISTS public.requests_one_active_per_user;

-- 2. Create a standard index for fast user active requests lookups
CREATE INDEX IF NOT EXISTS idx_requests_user_active_lookup
ON public.requests (user_id, created_at DESC)
WHERE status NOT IN ('completed', 'cancelled');

-- 3. Trigger function to enforce a maximum of 3 concurrent active requests per user
CREATE OR REPLACE FUNCTION public.check_max_active_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count int;
BEGIN
  -- Only validate when the request is active
  IF NEW.status NOT IN ('completed', 'cancelled') THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.requests
    WHERE user_id = NEW.user_id
      AND status NOT IN ('completed', 'cancelled')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_active_count >= 3 THEN
      RAISE EXCEPTION 'ACTIVE_REQUEST_LIMIT_EXCEEDED: Maximum 3 active requests allowed at a time.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_max_active_requests ON public.requests;
CREATE TRIGGER trigger_check_max_active_requests
BEFORE INSERT OR UPDATE OF status, user_id
ON public.requests
FOR EACH ROW
EXECUTE FUNCTION public.check_max_active_requests();

-- 4. Update create_new_request_with_limit RPC to enforce max 3 active requests and 3 requests per 24 hours
CREATE OR REPLACE FUNCTION public.create_new_request_with_limit(
  p_title text,
  p_category text,
  p_priority text
)
RETURNS public.requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count int;
  v_active_count int;
  v_req public.requests;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- 1. Short-term burst protection
  PERFORM public.enforce_rate_limit('create_request', 5, '1 minute', v_user_id::text);

  -- 2. Check active requests limit (3 max concurrent active requests)
  SELECT count(*) INTO v_active_count
  FROM public.requests
  WHERE user_id = v_user_id
    AND status NOT IN ('completed', 'cancelled');

  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'ACTIVE_REQUEST_LIMIT_EXCEEDED';
  END IF;

  -- 3. Rolling 24-hour business rule (allows up to 3)
  SELECT count(*) INTO v_count
  FROM public.requests
  WHERE user_id = v_user_id
    AND created_at >= now() - interval '24 hours';
    
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'CHAT_LIMIT_EXCEEDED';
  END IF;

  INSERT INTO public.requests (
    user_id, 
    title, 
    category, 
    priority, 
    reference
  )
  VALUES (
    v_user_id, 
    p_title, 
    COALESCE(p_category, 'Government Form'), 
    COALESCE(p_priority::public.request_priority, 'medium'::public.request_priority), 
    'FRM-' || upper(substr(md5(random()::text), 1, 7))
  )
  RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_new_request_with_limit(text, text, text) TO authenticated;
