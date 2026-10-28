-- Fix Admin User Search by adding user ID (p.id::text) matching in get_admin_users RPC

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
      AND (
        _search IS NULL 
        OR _search = '' 
        OR p.id::text ILIKE '%' || _search || '%'
        OR p.full_name ILIKE '%' || _search || '%' 
        OR p.email ILIKE '%' || _search || '%' 
        OR p.phone ILIKE '%' || _search || '%'
      )
  )
  SELECT 
    f.id, f.full_name, f.email, f.phone, f.avatar_url, f.is_active, f.created_at, f.total,
    (SELECT count(*)::bigint FROM public.requests r WHERE r.user_id = f.id) as requests_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT _limit OFFSET _offset;
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_admin_users(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users(text, text, integer, integer) TO authenticated;
