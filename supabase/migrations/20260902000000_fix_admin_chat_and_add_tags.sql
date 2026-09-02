-- Migration: Fix Admin Team Chat connection & Add Chat Tags
-- 1. Create secure get_or_create_admin_team_chat function
CREATE OR REPLACE FUNCTION public.get_or_create_admin_team_chat(
  p_team_member_id uuid,
  p_team_member_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.requests%ROWTYPE;
  v_room_id uuid;
  v_title text;
  v_ref text;
BEGIN
  -- Security check: caller must be an admin, or the specific team member
  IF NOT (public.is_admin() OR auth.uid() = p_team_member_id) THEN
    RAISE EXCEPTION 'Not authorized to access direct admin chat for this team member';
  END IF;

  -- 1. Check if direct chat request already exists for this team member
  SELECT * INTO v_req
    FROM public.requests
   WHERE category = 'Team Direct Report'
     AND (user_id = p_team_member_id OR assigned_team_id = p_team_member_id)
   ORDER BY created_at DESC
   LIMIT 1;

  -- 2. If not found, create a new direct chat request
  IF v_req.id IS NULL THEN
    v_title := 'Direct Chat · ' || COALESCE(NULLIF(p_team_member_name, ''), 'Admin Support');
    v_ref := 'ADM-TM-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0');

    INSERT INTO public.requests (
      user_id,
      title,
      category,
      priority,
      status,
      reference,
      assigned_team_id,
      assigned_at
    ) VALUES (
      p_team_member_id,
      v_title,
      'Team Direct Report',
      'high',
      'in_progress',
      v_ref,
      p_team_member_id,
      now()
    )
    RETURNING * INTO v_req;
  ELSIF v_req.assigned_team_id IS NULL THEN
    UPDATE public.requests
       SET assigned_team_id = p_team_member_id,
           assigned_at = COALESCE(v_req.assigned_at, now())
     WHERE id = v_req.id
    RETURNING * INTO v_req;
  END IF;

  -- 3. Ensure corresponding chat room exists
  SELECT id INTO v_room_id
    FROM public.chat_rooms
   WHERE request_id = v_req.id
   LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO public.chat_rooms (request_id)
    VALUES (v_req.id)
    RETURNING id INTO v_room_id;
  END IF;

  RETURN jsonb_build_object(
    'request', to_jsonb(v_req),
    'room', jsonb_build_object('id', v_room_id, 'request_id', v_req.id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_admin_team_chat(uuid, text) TO authenticated;

-- 2. Add tags column to requests for WhatsApp Business style chat tags
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS requests_tags_idx ON public.requests USING GIN (tags);

-- 3. Secure update_request_tags RPC
CREATE OR REPLACE FUNCTION public.update_request_tags(p_request_id uuid, p_tags text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR EXISTS (SELECT 1 FROM public.requests WHERE id = p_request_id AND (assigned_team_id = auth.uid() OR user_id = auth.uid()))) THEN
    RAISE EXCEPTION 'Not authorized to modify tags for this request';
  END IF;

  UPDATE public.requests
     SET tags = p_tags,
         updated_at = now()
   WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_request_tags(uuid, text[]) TO authenticated;
