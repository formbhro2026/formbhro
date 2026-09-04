-- Allow both user and team members to delete documents and storage objects
DROP POLICY IF EXISTS "documents delete" ON public.documents;
CREATE POLICY "documents delete" ON public.documents FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team')
    OR (request_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = documents.request_id
        AND r.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "request docs delete" ON storage.objects;
CREATE POLICY "request docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'request-documents'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'team')
      OR public.can_access_storage_folder((storage.foldername(name))[1])
    )
  );
