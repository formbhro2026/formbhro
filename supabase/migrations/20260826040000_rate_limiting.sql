-- Rate Limiting System

CREATE TABLE IF NOT EXISTS public.rate_limits (
  identity text NOT NULL,
  operation text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  PRIMARY KEY (identity, operation, window_start)
);

-- Completely lock down the rate_limits table so clients cannot view or modify it
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies added, so access is strictly denied to all normal roles.

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_operation text,
  p_limit int,
  p_window interval,
  p_identity text DEFAULT auth.uid()::text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count int;
BEGIN
  IF p_identity IS NULL THEN
    -- Fallback for unauthenticated requests if needed, but primarily driven by auth.uid()
    p_identity := coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown_ip');
  END IF;
  
  -- Calculate window start (tumbling window based on interval, simplified to minute truncation for our bounds)
  v_window_start := date_trunc('minute', now());

  -- Atomic Upsert
  INSERT INTO public.rate_limits (identity, operation, window_start, request_count)
  VALUES (p_identity, p_operation, v_window_start, 1)
  ON CONFLICT (identity, operation, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  IF v_count > p_limit THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
  END IF;

  -- Garbage collection: ~1% chance to cleanup old records to keep table bounded
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
  END IF;

  RETURN true;
END;
$$;

-- Trigger function for messages
CREATE OR REPLACE FUNCTION public.trigger_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 20 messages per minute per user
  PERFORM public.enforce_rate_limit('send_message', 20, '1 minute', NEW.sender_id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_messages_rate_limit ON public.messages;
CREATE TRIGGER tr_messages_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_message_rate_limit();

-- Trigger function for documents
CREATE OR REPLACE FUNCTION public.trigger_document_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 10 documents per minute per user
  -- For documents, the user_id might be implicitly auth.uid(), or the uploader.
  PERFORM public.enforce_rate_limit('upload_document', 10, '1 minute', auth.uid()::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_documents_rate_limit ON public.documents;
CREATE TRIGGER tr_documents_rate_limit
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_document_rate_limit();

-- Update create_new_request_with_limit to include the generic rate limiter
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- 1. Short-term burst protection (Phase 4B)
  -- Allow max 5 chat creations per minute
  PERFORM public.enforce_rate_limit('create_request', 5, '1 minute', v_user_id::text);

  -- 2. Rolling 24-hour business rule (Phase 4A)
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

-- Trigger function for storage objects to prevent bypass of rate limits
CREATE OR REPLACE FUNCTION public.trigger_storage_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We only care about protecting our specific buckets against abuse
  IF NEW.bucket_id = 'request-documents' THEN
    PERFORM public.enforce_rate_limit('upload_document', 10, '1 minute', auth.uid()::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_storage_rate_limit ON storage.objects;
CREATE TRIGGER tr_storage_rate_limit
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_storage_rate_limit();
