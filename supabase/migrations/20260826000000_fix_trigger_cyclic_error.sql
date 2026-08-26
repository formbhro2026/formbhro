-- Fix for "tuple to be updated was already modified" error
-- This prevents the messages trigger from recursively updating the requests table 
-- when the status is updated, breaking the infinite loop.

CREATE OR REPLACE FUNCTION public.handle_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  _req public.requests%ROWTYPE; 
  _preview text; 
  _receiver uuid; 
  _receiver_role public.app_role;
BEGIN
  SELECT * INTO _req FROM public.requests WHERE id = NEW.request_id;
  _preview := COALESCE(NULLIF(NEW.body,''), 'Attachment');

  -- Always update the chat room
  UPDATE public.chat_rooms SET last_message = _preview, last_message_at = NEW.created_at WHERE id = NEW.chat_room_id;
  
  -- Prevent cyclic trigger loop: Only update the requests table if this message
  -- was NOT inserted by another trigger (like the request status update trigger).
  IF pg_trigger_depth() <= 1 THEN
    UPDATE public.requests SET last_message = _preview, last_activity_at = NEW.created_at WHERE id = NEW.request_id;
  END IF;

  IF NOT NEW.is_system THEN
    INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label)
    VALUES (NEW.request_id, NEW.sender_id, NEW.sender_role::text::public.app_role, 'message_sent', 'Message sent');

    IF NEW.sender_role = 'user' THEN
      _receiver := _req.assigned_team_id; _receiver_role := 'team';
    ELSE
      _receiver := _req.user_id; _receiver_role := 'user';
    END IF;

    IF _receiver IS NOT NULL THEN
      INSERT INTO public.notifications (receiver_id, role, type, title, body, request_id, chat_room_id)
      VALUES (_receiver, _receiver_role, 'message', 'New message', _preview, NEW.request_id, NEW.chat_room_id);
      PERFORM public.notify_push(_receiver, 'New message', _preview, jsonb_build_object('url', '/app/chats/' || NEW.request_id));
    END IF;
  END IF;

  RETURN NEW;
END; $$;
