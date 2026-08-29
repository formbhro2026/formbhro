-- Migration: Add RPC to trigger WebRTC call notifications

-- This function is executed as SECURITY DEFINER to bypass RLS on notifications, 
-- but checks authorization explicitly inside.
CREATE OR REPLACE FUNCTION public.trigger_call_notification(p_request_id uuid, p_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req requests%ROWTYPE;
  _receiver uuid;
  _receiver_role app_role;
BEGIN
  -- Look up the request
  SELECT * INTO _req FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN 
    RETURN; 
  END IF;

  -- Determine who is calling and who should receive the notification
  -- If the caller is the user, the receiver is the assigned team member
  -- If the caller is a team member or admin, the receiver is the user
  IF auth.uid() = _req.user_id THEN
    -- User is calling, so team is receiving
    _receiver := _req.assigned_team_id;
    _receiver_role := 'team';
  ELSE
    -- Team/Admin is calling, so user is receiving
    _receiver := _req.user_id;
    _receiver_role := 'user';
  END IF;

  -- Security check: Ensure the caller is either the user, the assigned team member, or an admin
  IF auth.uid() != _req.user_id AND auth.uid() != _req.assigned_team_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized to initiate a call for this request';
  END IF;

  -- Insert the notification. The trigger on the notifications table / edge function
  -- will pick this up and send the actual FCM push notification.
  IF _receiver IS NOT NULL THEN
    -- Determine chat room ID
    DECLARE
      _room_id uuid;
    BEGIN
      SELECT id INTO _room_id FROM chat_rooms WHERE request_id = p_request_id LIMIT 1;

      INSERT INTO notifications (receiver_id, role, type, title, body, request_id, chat_room_id)
      VALUES (
        _receiver,
        _receiver_role,
        'call',
        'Incoming ' || initcap(p_type) || ' Call',
        'Tap here to join the call',
        p_request_id,
        _room_id
      );
    END;
  END IF;
END;
$$;
