-- Add RPC function to securely create a request with a 24-hour rate limit

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
  v_req public.requests;
BEGIN
  -- 1. Identify the authenticated user securely
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Acquire a transaction-level advisory lock on the user_id to completely eliminate race conditions.
  -- This ensures that if the same user attempts multiple rapid-fire concurrent creations, 
  -- they are executed serially, and the count logic is robust.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- 3. Check the rolling 24-hour limit
  -- A "chat" is any record in public.requests, regardless of status.
  SELECT count(*) INTO v_count
  FROM public.requests
  WHERE user_id = v_user_id
    AND created_at >= now() - interval '24 hours';
    
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'CHAT_LIMIT_EXCEEDED';
  END IF;

  -- 4. Perform the insert
  -- The unique partial index on `requests(user_id) WHERE status NOT IN ('completed','cancelled')`
  -- will naturally throw error 23505 if an active request already exists.
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
