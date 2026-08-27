-- ============ BAN ENFORCEMENT & ADMIN USERS ============
-- Addresses Phase 7 forensic findings by enforcing is_active in RLS core
-- and providing an efficient RPC for the Admin Users dashboard.

CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
$$;

-- Note: is_active_team_member() was already added in fix_requests_recursion.sql
-- We redefine it here just to be certain it exists and is correct.
CREATE OR REPLACE FUNCTION public.is_active_team_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE id = auth.uid() AND is_active = true)
$$;

-- Replace the central can_access_request helper to strictly enforce active status
-- for end users, immediately cutting off access to chat_rooms, messages, documents, etc.
CREATE OR REPLACE FUNCTION public.can_access_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
      AND (
        (r.user_id = auth.uid() AND public.is_user_active())
        OR (r.assigned_team_id = auth.uid() AND public.is_active_team_member())
        OR public.has_role(auth.uid(),'admin')
      )
  )
$$;

-- Update Requests policies to enforce is_active
DROP POLICY IF EXISTS "requests read" ON public.requests;
CREATE POLICY "requests read" ON public.requests FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_user_active())
    OR (assigned_team_id = auth.uid() AND public.is_active_team_member())
    OR public.has_role(auth.uid(),'admin')
  );

DROP POLICY IF EXISTS "requests user create" ON public.requests;
CREATE POLICY "requests user create" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND assigned_team_id IS NULL 
    AND public.is_user_active()
  );

-- Note: "requests staff update" already implicitly checks team_member validity via other means, 
-- but we should be robust.
DROP POLICY IF EXISTS "requests staff update" ON public.requests;
CREATE POLICY "requests staff update" ON public.requests FOR UPDATE TO authenticated
  USING (
    (assigned_team_id = auth.uid() AND public.is_active_team_member()) 
    OR public.is_admin()
  )
  WITH CHECK (
    (assigned_team_id = auth.uid() AND public.is_active_team_member()) 
    OR public.is_admin()
  );

-- ============ ADMIN RPC FOR PAGINATED USERS ============
CREATE OR REPLACE FUNCTION public.get_admin_users(
  _search text DEFAULT NULL,
  _status text DEFAULT 'all',
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  is_active boolean,
  created_at timestamptz,
  total_count bigint,
  requests_count bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT p.*, count(*) over() as total
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'user'
      AND (_status = 'all' OR (_status = 'active' AND p.is_active = true) OR (_status = 'suspended' AND p.is_active = false))
      AND (_search IS NULL OR _search = '' OR p.full_name ILIKE '%' || _search || '%' OR p.email ILIKE '%' || _search || '%' OR p.phone ILIKE '%' || _search || '%')
  )
  SELECT 
    f.id, f.full_name, f.email, f.phone, f.avatar_url, f.is_active, f.created_at, f.total,
    (SELECT count(*)::bigint FROM public.requests r WHERE r.user_id = f.id) as requests_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT _limit OFFSET _offset;
END; $$;
