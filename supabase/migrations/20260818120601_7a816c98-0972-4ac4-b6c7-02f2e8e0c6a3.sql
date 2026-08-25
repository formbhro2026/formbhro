ALTER TABLE public.documents ALTER COLUMN request_id DROP NOT NULL;

DROP POLICY IF EXISTS "documents read" ON public.documents;
DROP POLICY IF EXISTS "documents insert" ON public.documents;

CREATE POLICY "documents read" ON public.documents FOR SELECT TO authenticated
USING (
  (request_id IS NOT NULL AND public.can_access_request(request_id))
  OR (request_id IS NULL AND (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin')))
);

CREATE POLICY "documents insert" ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (request_id IS NULL OR public.can_access_request(request_id))
);

CREATE OR REPLACE FUNCTION public.can_access_request_ref(_ref text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _ref = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id::text = _ref
        AND (r.user_id = auth.uid() OR r.assigned_team_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
    )
$$;

REVOKE ALL ON FUNCTION public.can_access_request_ref(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_request_ref(text) TO authenticated, service_role;