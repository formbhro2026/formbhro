-- Allow team members and users to read all relevant documents
DROP POLICY IF EXISTS "documents read" ON public.documents;
DROP POLICY IF EXISTS "Team members see assigned documents" ON public.documents;
CREATE POLICY "documents read" ON public.documents FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team')
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.id = auth.uid())
    OR (request_id IS NOT NULL AND public.can_access_request(request_id))
  );

-- Allow both user and team members to delete documents and storage objects
DROP POLICY IF EXISTS "documents delete" ON public.documents;
CREATE POLICY "documents delete" ON public.documents FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team')
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.id = auth.uid())
    OR (request_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = documents.request_id
        AND r.user_id = auth.uid()
    ))
  );

-- Storage folder access helper
CREATE OR REPLACE FUNCTION public.can_access_storage_folder(_folder text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _folder = auth.uid()::text 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team')
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id::text = _folder
        AND (
          r.user_id = auth.uid() 
          OR r.assigned_team_id = auth.uid() 
          OR (public.is_team() AND r.assigned_team_id IS NULL)
        )
    );
$$;

DROP POLICY IF EXISTS "request docs read" ON storage.objects;
CREATE POLICY "request docs read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'request-documents'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'team')
      OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.id = auth.uid())
      OR public.can_access_storage_folder((storage.foldername(name))[1])
    )
  );

DROP POLICY IF EXISTS "request docs delete" ON storage.objects;
CREATE POLICY "request docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'request-documents'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'team')
      OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.id = auth.uid())
      OR public.can_access_storage_folder((storage.foldername(name))[1])
    )
  );

