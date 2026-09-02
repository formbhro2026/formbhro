-- Migration: 20260902000003_add_record_call_log_rpc.sql
-- Description: Adds idempotent call log recording RPC with database-level race protection

CREATE OR REPLACE FUNCTION public.record_call_log(
  p_chat_room_id uuid,
  p_request_id uuid,
  p_call_session_id text,
  p_call_type text,
  p_status text,
  p_caller_id uuid,
  p_receiver_id uuid,
  p_duration_seconds integer DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
  v_summary_text text;
  v_duration_label text;
  v_minutes integer;
  v_seconds integer;
BEGIN
  -- Idempotency check: If call_session_id already exists in this chat room, return existing message id
  SELECT id INTO v_message_id
  FROM public.messages
  WHERE chat_room_id = p_chat_room_id
    AND reactions->'call_log'->>'call_session_id' = p_call_session_id
  LIMIT 1;

  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;

  -- Format duration label
  IF p_duration_seconds > 0 THEN
    v_minutes := p_duration_seconds / 60;
    v_seconds := p_duration_seconds % 60;
    v_duration_label := to_char(v_minutes, 'FM990') || ':' || to_char(v_seconds, 'FM00');
  ELSE
    v_duration_label := '0:00';
  END IF;

  -- Create human readable summary text
  IF p_status = 'completed' THEN
    v_summary_text := (CASE WHEN p_call_type = 'video' THEN 'Video Call' ELSE 'Voice Call' END) || ' • ' || v_duration_label;
  ELSIF p_status = 'missed' THEN
    v_summary_text := 'Missed ' || (CASE WHEN p_call_type = 'video' THEN 'Video Call' ELSE 'Voice Call' END);
  ELSIF p_status = 'declined' THEN
    v_summary_text := 'Declined ' || (CASE WHEN p_call_type = 'video' THEN 'Video Call' ELSE 'Voice Call' END);
  ELSE
    v_summary_text := 'Cancelled ' || (CASE WHEN p_call_type = 'video' THEN 'Video Call' ELSE 'Voice Call' END);
  END IF;

  -- Insert call-log message
  INSERT INTO public.messages (
    chat_room_id,
    request_id,
    sender_id,
    sender_role,
    body,
    is_system,
    reactions
  ) VALUES (
    p_chat_room_id,
    p_request_id,
    p_caller_id,
    'system',
    v_summary_text,
    true,
    jsonb_build_object(
      'call_log', jsonb_build_object(
        'call_session_id', p_call_session_id,
        'call_type', p_call_type,
        'status', p_status,
        'caller_id', p_caller_id,
        'receiver_id', p_receiver_id,
        'duration_seconds', p_duration_seconds,
        'created_at', now()
      )
    )
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_call_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_call_log TO service_role;
