
CREATE OR REPLACE FUNCTION public.can_access_request_ref(_ref text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id::text = _ref
      AND (r.user_id = auth.uid() OR r.assigned_team_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_request_ref(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_request_ref(text) TO authenticated, service_role;

CREATE POLICY "request docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'request-documents' AND public.can_access_request_ref((storage.foldername(name))[1]));

CREATE POLICY "request docs upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'request-documents' AND public.can_access_request_ref((storage.foldername(name))[1]));
