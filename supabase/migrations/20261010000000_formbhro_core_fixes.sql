-- Migration: Formbhro Complete Bug Fixes, Features, and Lifecycle Upgrades
-- Date: 2026-10-10

-- ============================================================================
-- 1. FIX REQUEST LIFECYCLE STATE MACHINE & WAITING FOR DOCUMENT TRANSITIONS
-- ============================================================================

-- Ensure `waiting_documents` is properly supported in the enum and matrix
CREATE OR REPLACE FUNCTION public.validate_request_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_uid uuid;
BEGIN
  -- If status hasn't changed, nothing to validate
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- 1. Identity / Assignment checks
  IF auth.role() != 'service_role' THEN
    v_uid := auth.uid();
    
    -- Find if caller is admin
    SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_uid LIMIT 1;

    IF v_role != 'admin' THEN
      -- If they are the user who created it, they can only cancel pending requests
      IF NEW.user_id = v_uid THEN
        IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
          -- Allowed
        ELSE
          RAISE EXCEPTION 'Users can only cancel pending requests.';
        END IF;
      -- If they are a team member assigned to the request
      ELSIF OLD.assigned_team_id IS NOT NULL AND OLD.assigned_team_id = v_uid THEN
        -- Allowed to change status among active operational statuses
      -- If it's a claim (assigning self to pending request)
      ELSIF OLD.status = 'pending' AND NEW.status = 'assigned' AND NEW.assigned_team_id = v_uid THEN
        -- Allowed, continue to state rules
      ELSE
        RAISE EXCEPTION 'You are not authorized to change the status of this request.';
      END IF;
    END IF;
  END IF;

  -- 2. Terminal State Protections
  IF OLD.status IN ('cancelled', 'closed') AND v_role != 'admin' THEN
    RAISE EXCEPTION 'Status % is terminal and cannot be changed.', OLD.status;
  END IF;

  -- 3. Matrix Validation for Active Workflow
  -- Operational statuses: assigned, in_progress, waiting_documents, under_review, completed
  IF OLD.status = 'pending' AND NEW.status NOT IN ('assigned', 'in_progress', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'assigned' AND NEW.status NOT IN ('in_progress', 'waiting_documents', 'under_review', 'pending', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'in_progress' AND NEW.status NOT IN ('waiting_documents', 'under_review', 'completed', 'assigned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'waiting_documents' AND NEW.status NOT IN ('in_progress', 'under_review', 'completed', 'assigned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'under_review' AND NEW.status NOT IN ('in_progress', 'waiting_documents', 'completed', 'assigned', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  ELSIF OLD.status = 'completed' AND NEW.status NOT IN ('closed', 'under_review', 'in_progress') THEN
    -- Admin or team reopening completed request to under_review/in_progress or marking closed
    RAISE EXCEPTION 'Invalid transition from % to %.', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requests_status_lifecycle ON public.requests;
CREATE TRIGGER requests_status_lifecycle
  BEFORE UPDATE OF status ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_request_transition();

-- ============================================================================
-- 2. CHAT ESCALATIONS TABLE AND WORKFLOW
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  chat_room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  escalated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'reopened')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text
);

ALTER TABLE public.chat_escalations ENABLE ROW LEVEL SECURITY;

-- Add escalation metadata columns on requests if not present
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- Escalation RLS policies
DROP POLICY IF EXISTS "Admins can view all escalations" ON public.chat_escalations;
CREATE POLICY "Admins can view all escalations"
  ON public.chat_escalations FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Team members can view assigned or open escalations" ON public.chat_escalations;
CREATE POLICY "Team members can view assigned or open escalations"
  ON public.chat_escalations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Team members can insert escalations" ON public.chat_escalations;
CREATE POLICY "Team members can insert escalations"
  ON public.chat_escalations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND is_active = true)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins and assignees can update escalations" ON public.chat_escalations;
CREATE POLICY "Admins and assignees can update escalations"
  ON public.chat_escalations FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR escalated_by = auth.uid()
  );

-- Function to record or update escalation
CREATE OR REPLACE FUNCTION public.escalate_conversation(
  p_request_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests;
  v_room_id uuid;
  v_esc_id uuid;
BEGIN
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  SELECT id INTO v_room_id FROM public.chat_rooms WHERE request_id = p_request_id LIMIT 1;

  -- Update request is_escalated flag and details
  UPDATE public.requests
  SET
    is_escalated = TRUE,
    escalation_reason = p_reason,
    escalated_at = now(),
    last_activity_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  -- Create record in chat_escalations
  INSERT INTO public.chat_escalations (
    request_id,
    chat_room_id,
    user_id,
    escalated_by,
    reason,
    status
  ) VALUES (
    p_request_id,
    v_room_id,
    v_req.user_id,
    auth.uid(),
    p_reason,
    'open'
  )
  RETURNING id INTO v_esc_id;

  -- Log to activity logs
  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label, meta)
  VALUES (
    p_request_id,
    auth.uid(),
    CASE WHEN public.is_admin() THEN 'admin' ELSE 'team' END,
    'request_escalated',
    'Escalated to Admin',
    jsonb_build_object('reason', p_reason, 'escalation_id', v_esc_id)
  );

  RETURN jsonb_build_object('success', true, 'escalation_id', v_esc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalate_conversation(uuid, text) TO authenticated;

-- Function to resolve/close escalation
CREATE OR REPLACE FUNCTION public.resolve_escalation(
  p_request_id uuid,
  p_status text DEFAULT 'resolved',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.chat_escalations
  SET
    status = p_status,
    resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END,
    resolved_by = CASE WHEN p_status = 'resolved' THEN auth.uid() ELSE NULL END,
    resolution_notes = COALESCE(p_notes, resolution_notes),
    updated_at = now()
  WHERE request_id = p_request_id;

  IF p_status = 'resolved' THEN
    UPDATE public.requests
    SET is_escalated = FALSE, updated_at = now()
    WHERE id = p_request_id;
  ELSIF p_status = 'reopened' THEN
    UPDATE public.requests
    SET is_escalated = TRUE, updated_at = now()
    WHERE id = p_request_id;
  END IF;

  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label, meta)
  VALUES (
    p_request_id,
    auth.uid(),
    CASE WHEN public.is_admin() THEN 'admin' ELSE 'team' END,
    'escalation_' || p_status,
    'Escalation status changed to ' || p_status,
    jsonb_build_object('status', p_status, 'notes', p_notes)
  );

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_escalation(uuid, text, text) TO authenticated;

-- ============================================================================
-- 3. INTERNAL NEWS TABLE AND RLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.internal_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_news ENABLE ROW LEVEL SECURITY;

-- Team and Admins can view internal news (NOT regular users)
DROP POLICY IF EXISTS "Team and Admin can view internal news" ON public.internal_news;
CREATE POLICY "Team and Admin can view internal news"
  ON public.internal_news FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Admins and authorized team can insert internal news" ON public.internal_news;
CREATE POLICY "Admins and authorized team can insert internal news"
  ON public.internal_news FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Admins and authors can update internal news" ON public.internal_news;
CREATE POLICY "Admins and authors can update internal news"
  ON public.internal_news FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR author_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can delete internal news" ON public.internal_news;
CREATE POLICY "Admins can delete internal news"
  ON public.internal_news FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 4. VACANCY STRUCTURED FIELDS & ADMIN CONFIGURABLE CUSTOM FIELDS
-- ============================================================================

-- Add structured vacancy columns to public.news table
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS responsibilities text,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS min_age integer,
  ADD COLUMN IF NOT EXISTS max_age integer,
  ADD COLUMN IF NOT EXISTS application_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS application_last_date timestamptz,
  ADD COLUMN IF NOT EXISTS vacancies_count integer,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS application_url text,
  ADD COLUMN IF NOT EXISTS notification_doc_url text,
  ADD COLUMN IF NOT EXISTS vacancy_status text DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

-- Custom field definitions configured by Admin
CREATE TABLE IF NOT EXISTS public.vacancy_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'boolean')),
  options jsonb DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  is_filter boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vacancy_custom_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view active custom fields" ON public.vacancy_custom_fields;
CREATE POLICY "Anyone authenticated can view active custom fields"
  ON public.vacancy_custom_fields FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage custom fields" ON public.vacancy_custom_fields;
CREATE POLICY "Admins manage custom fields"
  ON public.vacancy_custom_fields FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. SECURE MESSAGE DELETION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_chat_message(p_message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.messages;
  v_perms jsonb;
  v_can_delete boolean := false;
BEGIN
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Admin check
  IF public.is_admin() THEN
    v_can_delete := true;
  ELSE
    -- Check team member permissions
    SELECT permissions INTO v_perms FROM public.team_members WHERE id = auth.uid() AND is_active = true;
    IF v_perms IS NOT NULL AND (v_perms->>'can_delete_messages')::boolean = true THEN
      v_can_delete := true;
    END IF;
  END IF;

  IF NOT v_can_delete THEN
    RAISE EXCEPTION 'Forbidden: You do not have permission to delete messages.';
  END IF;

  -- Soft delete
  UPDATE public.messages
  SET deleted = TRUE, body = '[Message deleted]'
  WHERE id = p_message_id;

  INSERT INTO public.activity_logs (request_id, actor_id, actor_role, action, label, meta)
  VALUES (
    v_msg.request_id,
    auth.uid(),
    CASE WHEN public.is_admin() THEN 'admin' ELSE 'team' END,
    'message_deleted',
    'Deleted message ' || p_message_id,
    jsonb_build_object('message_id', p_message_id, 'chat_room_id', v_msg.chat_room_id)
  );

  RETURN jsonb_build_object('success', true, 'message_id', p_message_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_chat_message(uuid) TO authenticated;

-- ============================================================================
-- 6. TEAM MEMBER PRESENCE SYSTEM
-- ============================================================================

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_team_presence(p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid()) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not a team member or admin';
  END IF;

  UPDATE public.team_members
  SET
    availability_status = p_status,
    last_seen_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'status', p_status, 'last_seen_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_team_presence(text) TO authenticated;

-- Ensure Realtime publications include these tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_escalations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_escalations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'internal_news'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_news;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;
END $$;
