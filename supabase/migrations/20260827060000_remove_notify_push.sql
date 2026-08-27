-- Drop the trigger and update the function to remove notify_push
CREATE OR REPLACE FUNCTION public.messages_created_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.requests;
  _receiver uuid;
  _receiver_role public.app_role;
  _preview text;
BEGIN
  SELECT * INTO _req FROM public.requests WHERE id = NEW.request_id;
  
  _preview := coalesce(NEW.body, '');
  IF NEW.attachment_id IS NOT NULL THEN
    _preview := 'Sent an attachment';
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
    END IF;
  END IF;

  RETURN NEW;
END; $$;
