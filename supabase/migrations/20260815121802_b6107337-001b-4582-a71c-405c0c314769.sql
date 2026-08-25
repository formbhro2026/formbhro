DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['activity_logs','chat_rooms','documents','messages','news','notifications','profiles','quick_replies','request_status_history','requests','settings','team_members','user_roles','user_settings']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;