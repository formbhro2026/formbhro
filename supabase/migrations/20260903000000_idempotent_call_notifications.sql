-- Migration: 20260903000000_idempotent_call_notifications.sql
-- Description: Adds call_session_id to notifications and enforces single call notification authority

-- 1. Add call_session_id column to notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS call_session_id text;

-- 2. Create partial unique index on call_session_id for call notifications
-- This ensures that only ONE notification row can ever exist for a given call session,
-- while leaving all message and system notifications completely unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_call_session_unique_idx 
ON public.notifications (call_session_id) 
WHERE type = 'call' AND call_session_id IS NOT NULL;

-- 3. Update trigger_call_notification RPC with call_session_id parameter and idempotency check
CREATE OR REPLACE FUNCTION public.trigger_call_notification(
  p_request_id text, 
  p_type text,
  p_call_session_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req requests%ROWTYPE;
  _receiver uuid;
  _receiver_role app_role;
  _room_id uuid;
BEGIN
  -- 1. Idempotency check: If call_session_id already has a notification, exit immediately
  IF p_call_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE type = 'call' AND call_session_id = p_call_session_id
    ) THEN
      RETURN;
    END IF;
  END IF;

  -- 2. Look up the request by UUID or reference string
  SELECT * INTO _req FROM requests WHERE id::text = p_request_id OR reference = p_request_id LIMIT 1;
  IF NOT FOUND THEN 
    RETURN; 
  END IF;

  -- 3. Determine receiver
  IF auth.uid() = _req.user_id THEN
    _receiver := _req.assigned_team_id;
    _receiver_role := 'team';
  ELSE
    _receiver := _req.user_id;
    _receiver_role := 'user';
  END IF;

  -- 4. Security check
  IF auth.uid() != _req.user_id AND auth.uid() != _req.assigned_team_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized to initiate a call for this request';
  END IF;

  -- 5. Insert notification with ON CONFLICT DO NOTHING
  IF _receiver IS NOT NULL THEN
    SELECT id INTO _room_id FROM chat_rooms WHERE request_id = _req.id LIMIT 1;

    INSERT INTO public.notifications (
      receiver_id, 
      role, 
      type, 
      title, 
      body, 
      request_id, 
      chat_room_id, 
      call_session_id
    )
    VALUES (
      _receiver,
      _receiver_role,
      'call',
      'Incoming ' || initcap(p_type) || ' Call',
      'Tap here to join the call',
      _req.id,
      _room_id,
      p_call_session_id
    )
    ON CONFLICT (call_session_id) WHERE type = 'call' AND call_session_id IS NOT NULL DO NOTHING;
  END IF;
END;
$$;
