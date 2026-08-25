
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('user','team','admin');
CREATE TYPE public.request_status AS ENUM ('pending','assigned','waiting_documents','under_review','in_progress','completed','cancelled');
CREATE TYPE public.request_priority AS ENUM ('low','medium','high');
CREATE TYPE public.message_sender AS ENUM ('user','team','admin','system');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  auth_provider text NOT NULL DEFAULT 'password',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_team()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'team')
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'admin') THEN 'admin'::public.app_role
    WHEN public.has_role(auth.uid(),'team') THEN 'team'::public.app_role
    ELSE 'user'::public.app_role END
$$;

-- ============ TEAM MEMBERS ============
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title text NOT NULL DEFAULT 'Support Executive',
  team_code text NOT NULL UNIQUE DEFAULT ('FBH-TM-' || lpad((floor(random()*9999)::int)::text, 4, '0')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ============ REQUESTS ============
CREATE SEQUENCE public.request_reference_seq START 1000;

CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Government Form',
  status public.request_status NOT NULL DEFAULT 'pending',
  priority public.request_priority NOT NULL DEFAULT 'medium',
  assigned_team_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  progress smallint NOT NULL DEFAULT 0,
  last_message text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- one active request per user
CREATE UNIQUE INDEX requests_one_active_per_user
  ON public.requests (user_id)
  WHERE status NOT IN ('completed','cancelled');
CREATE INDEX requests_user_idx ON public.requests (user_id, created_at DESC);
CREATE INDEX requests_team_idx ON public.requests (assigned_team_id, last_activity_at DESC);
CREATE INDEX requests_status_idx ON public.requests (status);

-- ============ CHAT ROOMS ============
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.requests(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  chat_room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_role public.message_sender NOT NULL DEFAULT 'user',
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  kind text NOT NULL DEFAULT 'doc',
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX documents_request_idx ON public.documents (request_id, created_at DESC);

-- ============ MESSAGES ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role public.message_sender NOT NULL DEFAULT 'user',
  body text,
  attachment_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  edited boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  seen boolean NOT NULL DEFAULT false,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX messages_room_idx ON public.messages (chat_room_id, created_at);
CREATE INDEX messages_unseen_idx ON public.messages (request_id) WHERE seen = false;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  type text NOT NULL DEFAULT 'message',
  title text NOT NULL,
  body text,
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  chat_room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX notifications_receiver_idx ON public.notifications (receiver_id, is_read, created_at DESC);

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role public.app_role,
  action text NOT NULL,
  label text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX activity_logs_request_idx ON public.activity_logs (request_id, created_at DESC);

-- ============ STATUS HISTORY ============
CREATE TABLE public.request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  from_status public.request_status,
  to_status public.request_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.request_status_history TO authenticated;
GRANT ALL ON public.request_status_history TO service_role;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX status_history_request_idx ON public.request_status_history (request_id, created_at DESC);

-- ============ NEWS ============
CREATE TABLE public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Service Announcement',
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- ============ QUICK REPLIES ============
CREATE TABLE public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_replies TO authenticated;
GRANT ALL ON public.quick_replies TO service_role;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- ============ USER SETTINGS ============
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_notifications boolean NOT NULL DEFAULT true,
  email_notifications boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  language text NOT NULL DEFAULT 'en',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ============ ACCESS HELPERS ============
CREATE OR REPLACE FUNCTION public.can_access_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
      AND (
        r.user_id = auth.uid()
        OR r.assigned_team_id = auth.uid()
        OR public.has_role(auth.uid(),'admin')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.request_of_room(_room_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT request_id FROM public.chat_rooms WHERE id = _room_id
$$;

-- ============ POLICIES ============
-- profiles
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin() OR public.is_team()
    OR EXISTS (SELECT 1 FROM public.requests r WHERE (r.user_id = auth.uid() AND r.assigned_team_id = profiles.id)));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- user_roles (read own, admin reads all; writes only via service role / admin fns)
CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- team_members
CREATE POLICY "team members read" ON public.team_members FOR SELECT TO authenticated
  USING (public.is_admin() OR id = auth.uid() OR public.is_team()
    OR EXISTS (SELECT 1 FROM public.requests r WHERE r.user_id = auth.uid() AND r.assigned_team_id = team_members.id));

-- requests
CREATE POLICY "requests read" ON public.requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR assigned_team_id = auth.uid() OR public.is_admin());
CREATE POLICY "requests user create" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND assigned_team_id IS NULL);
CREATE POLICY "requests staff update" ON public.requests FOR UPDATE TO authenticated
  USING (assigned_team_id = auth.uid() OR public.is_admin())
  WITH CHECK (assigned_team_id = auth.uid() OR public.is_admin());

-- chat rooms
CREATE POLICY "chat rooms read" ON public.chat_rooms FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));

-- messages
CREATE POLICY "messages read" ON public.messages FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));
CREATE POLICY "messages insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_request(request_id) AND is_system = false);
CREATE POLICY "messages update" ON public.messages FOR UPDATE TO authenticated
  USING (public.can_access_request(request_id))
  WITH CHECK (public.can_access_request(request_id));

-- documents
CREATE POLICY "documents read" ON public.documents FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));
CREATE POLICY "documents insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.can_access_request(request_id));

-- notifications
CREATE POLICY "notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (receiver_id = auth.uid());
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());

-- activity logs
CREATE POLICY "activity read" ON public.activity_logs FOR SELECT TO authenticated
  USING (request_id IS NULL AND public.is_admin() OR public.can_access_request(request_id));

-- status history
CREATE POLICY "status history read" ON public.request_status_history FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));

-- news
CREATE POLICY "news read" ON public.news FOR SELECT TO authenticated USING (published OR public.is_admin());
CREATE POLICY "news admin write" ON public.news FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- quick replies
CREATE POLICY "quick replies read" ON public.quick_replies FOR SELECT TO authenticated
  USING (is_global OR owner_id = auth.uid());
CREATE POLICY "quick replies own write" ON public.quick_replies FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- user settings
CREATE POLICY "settings own" ON public.user_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ TRIGGERS / BUSINESS LOGIC ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER requests_touch BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- new auth user -> profile + role + settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'user');

  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url, auth_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''),'@',1)),
    COALESCE(NEW.email,''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider','password')
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  IF _role = 'team' THEN
    INSERT INTO public.team_members (id, job_title)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'job_title','Support Executive'))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- notify helper
CREATE OR REPLACE FUNCTION public.notify_admins(_type text, _title text, _body text, _request_id uuid, _room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (receiver_id, role, type, title, body, request_id, chat_room_id)
  SELECT ur.user_id, 'admin', _type, _title, _body, _request_id, _room_id
  FROM public.user_roles ur WHERE ur.role = 'admin';
END; $$;

-- request created -> reference, chat room, log, notify admins
CREATE OR REPLACE FUNCTION public.handle_request_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _room uuid;
BEGIN
  INSERT INTO public.chat_rooms (request_id) VALUES (NEW.id) RETURNING id INTO _room;

  INSERT INTO public.messages (chat_room_id, request_id, sender_role, body, is_system)
  VALUES (_room, NEW.id, 'system', 'Request ' || NEW.reference || ' created. Our team will be assigned shortly.', true);

  INSERT INTO public.request_status_history (request_id, to_status, changed_by)
  VALUES (NEW.id, NEW.status, NEW.user_id);

  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label)
  VALUES (NEW.id, NEW.user_id, 'user', 'request_created', 'Request Created');

  PERFORM public.notify_admins('new_request', 'New request ' || NEW.reference, NEW.title, NEW.id, _room);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_request_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'FBH-' || to_char(now(),'YYYY') || '-' || nextval('public.request_reference_seq')::text;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER requests_reference BEFORE INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_request_reference();
CREATE TRIGGER requests_created AFTER INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_request_created();

-- request updated -> status engine + assignment engine
CREATE OR REPLACE FUNCTION public.handle_request_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _room uuid; _team_name text;
BEGIN
  SELECT id INTO _room FROM public.chat_rooms WHERE request_id = NEW.id;

  IF NEW.assigned_team_id IS DISTINCT FROM OLD.assigned_team_id AND NEW.assigned_team_id IS NOT NULL THEN
    SELECT full_name INTO _team_name FROM public.profiles WHERE id = NEW.assigned_team_id;
    NEW.assigned_at := now();
    IF NEW.status = 'pending' THEN NEW.status := 'assigned'; END IF;

    INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label)
    VALUES (NEW.id, auth.uid(), 'admin', 'request_assigned', 'Assigned to ' || COALESCE(_team_name,'team member'));

    INSERT INTO public.messages (chat_room_id, request_id, sender_role, body, is_system)
    VALUES (_room, NEW.id, 'system', 'Your request has been assigned to ' || COALESCE(_team_name,'our team') || '.', true);

    INSERT INTO public.notifications (receiver_id, role, type, title, body, request_id, chat_room_id)
    VALUES
      (NEW.user_id, 'user', 'assignment', 'Your request has been assigned.', NEW.reference, NEW.id, _room),
      (NEW.assigned_team_id, 'team', 'assignment', 'New request assigned', NEW.title, NEW.id, _room);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.request_status_history (request_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());

    INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label)
    VALUES (NEW.id, auth.uid(), public.current_role_name(), 'status_changed', 'Status updated to ' || NEW.status::text);

    INSERT INTO public.messages (chat_room_id, request_id, sender_role, body, is_system)
    VALUES (_room, NEW.id, 'system', 'Status updated to ' || replace(NEW.status::text,'_',' ') || '.', true);

    INSERT INTO public.notifications (receiver_id, role, type, title, body, request_id, chat_room_id)
    VALUES (NEW.user_id, 'user', 'status', 'Status updated', replace(NEW.status::text,'_',' '), NEW.id, _room);

    IF NEW.status = 'completed' THEN
      NEW.completed_at := now();
      NEW.archived := true;
      NEW.progress := 100;
      PERFORM public.notify_admins('completed', 'Request completed', NEW.reference, NEW.id, _room);
    END IF;
  END IF;

  NEW.last_activity_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER requests_updated BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_request_updated();

-- message inserted -> last message, activity, notifications
CREATE OR REPLACE FUNCTION public.handle_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests%ROWTYPE; _preview text; _receiver uuid; _receiver_role public.app_role;
BEGIN
  SELECT * INTO _req FROM public.requests WHERE id = NEW.request_id;
  _preview := COALESCE(NULLIF(NEW.body,''), 'Attachment');

  UPDATE public.chat_rooms SET last_message = _preview, last_message_at = NEW.created_at WHERE id = NEW.chat_room_id;
  UPDATE public.requests SET last_message = _preview, last_activity_at = NEW.created_at WHERE id = NEW.request_id;

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
      VALUES (_receiver, _receiver_role, 'message', 'New message', left(_preview, 120), NEW.request_id, NEW.chat_room_id);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER messages_created AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_created();

-- document uploaded -> activity + notification
CREATE OR REPLACE FUNCTION public.handle_document_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.requests%ROWTYPE; _receiver uuid; _receiver_role public.app_role; _room uuid;
BEGIN
  SELECT * INTO _req FROM public.requests WHERE id = NEW.request_id;
  SELECT id INTO _room FROM public.chat_rooms WHERE request_id = NEW.request_id;

  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label)
  VALUES (NEW.request_id, NEW.uploaded_by, NEW.uploader_role::text::public.app_role, 'document_uploaded', 'Document uploaded: ' || NEW.file_name);

  IF NEW.uploader_role = 'user' THEN
    _receiver := _req.assigned_team_id; _receiver_role := 'team';
  ELSE
    _receiver := _req.user_id; _receiver_role := 'user';
  END IF;

  IF _receiver IS NOT NULL THEN
    INSERT INTO public.notifications (receiver_id, role, type, title, body, request_id, chat_room_id)
    VALUES (_receiver, _receiver_role, 'document', 'New document uploaded', NEW.file_name, NEW.request_id, _room);
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER documents_created AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_document_created();

-- news published -> notify everyone
CREATE OR REPLACE FUNCTION public.handle_news_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.published THEN
    INSERT INTO public.notifications (receiver_id, role, type, title, body)
    SELECT ur.user_id, 'user', 'announcement', NEW.title, NEW.description
    FROM public.user_roles ur WHERE ur.role = 'user';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER news_published AFTER INSERT ON public.news
  FOR EACH ROW EXECUTE FUNCTION public.handle_news_published();

-- ============ REALTIME ============
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.requests REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.chat_rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;

-- ============ SEED NEWS ============
INSERT INTO public.news (title, description, category, featured) VALUES
  ('Faster document verification is now live','Documents shared in your support conversations are now reviewed by our team within 4 working hours on business days.','Important Update', true),
  ('New form available: Passport Tatkal assistance','You can now start a request for Tatkal passport applications directly from Fill Now.','New Form Available', false),
  ('Support hours extended to 9 PM IST','Our support operators are now available from 9 AM to 9 PM, Monday to Saturday.','Service Announcement', false);
