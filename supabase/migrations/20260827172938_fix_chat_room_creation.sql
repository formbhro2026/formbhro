-- Fix "Chat room unavailable" error for team members.
-- Some older requests may have been created before the auto-create trigger was in place,
-- resulting in no corresponding chat_room row.
--
-- Solution: Create a SECURITY DEFINER function that team members can call to ensure
-- a chat_room exists for a request they are assigned to, then grant EXECUTE to authenticated.

CREATE OR REPLACE FUNCTION public.ensure_chat_room_exists(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_id uuid;
  v_assigned_to uuid;
BEGIN
  -- Verify the calling user is actually the assigned team member or an admin
  SELECT assigned_team_id INTO v_assigned_to
    FROM public.requests
   WHERE id = p_request_id;

  IF v_assigned_to IS NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to create chat room for this request';
  END IF;

  -- Return existing room if present
  SELECT id INTO v_room_id
    FROM public.chat_rooms
   WHERE request_id = p_request_id;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- Create a new chat room
  INSERT INTO public.chat_rooms (request_id)
  VALUES (p_request_id)
  RETURNING id INTO v_room_id;

  RETURN v_room_id;
END;
$$;

-- Grant EXECUTE to authenticated users (team members + users)
REVOKE EXECUTE ON FUNCTION public.ensure_chat_room_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_chat_room_exists(uuid) TO authenticated;
