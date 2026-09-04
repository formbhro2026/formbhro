-- Migration: 20260904170500_add_notifications_fcm_trigger.sql
-- Enables pg_net and triggers send-fcm-notification automatically whenever a notification is created

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_send_fcm_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net AS $$
DECLARE
  _payload jsonb;
BEGIN
  -- Build webhook payload matching what send-fcm-notification Edge Function expects
  _payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', jsonb_build_object(
      'id', NEW.id,
      'receiver_id', NEW.receiver_id,
      'title', NEW.title,
      'body', NEW.body,
      'type', NEW.type,
      'request_id', NEW.request_id,
      'chat_room_id', NEW.chat_room_id,
      'role', NEW.role,
      'created_at', NEW.created_at
    )
  );

  PERFORM net.http_post(
    url := 'https://ogjhvmucklbxcewpkiai.supabase.co/functions/v1/send-fcm-notification',
    body := _payload,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never abort the original transaction if notification push dispatch encounters an error
  RAISE WARNING '[FCM_TRIGGER] Error dispatching FCM notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_created_send_fcm ON public.notifications;
CREATE TRIGGER on_notification_created_send_fcm
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trigger_send_fcm_notification();
