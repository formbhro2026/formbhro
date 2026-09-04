-- Fix storage folder access helper to allow Team Members to access documents of unassigned requests in the pool
CREATE OR REPLACE FUNCTION public.can_access_storage_folder(_folder text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _folder = auth.uid()::text OR EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id::text = _folder
      AND (
        r.user_id = auth.uid() 
        OR r.assigned_team_id = auth.uid() 
        OR public.has_role(auth.uid(), 'admin')
        OR (public.is_team() AND r.assigned_team_id IS NULL)
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_access_storage_folder(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_storage_folder(text) TO service_role;
