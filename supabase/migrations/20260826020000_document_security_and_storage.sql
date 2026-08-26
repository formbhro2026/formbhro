-- Set bucket parameters for request-documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'request-documents',
  'request-documents',
  false,
  26214400,
  '{image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed}'
)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Helper function to correctly resolve storage access for requests vs personal folders
CREATE OR REPLACE FUNCTION public.can_access_storage_folder(_folder text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _folder = auth.uid()::text OR EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id::text = _folder
      AND (r.user_id = auth.uid() OR r.assigned_team_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_access_storage_folder(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_storage_folder(text) TO service_role;

-- Update Storage Objects Policies
DROP POLICY IF EXISTS "request docs read" ON storage.objects;
CREATE POLICY "request docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'request-documents' AND public.can_access_storage_folder((storage.foldername(name))[1]));

DROP POLICY IF EXISTS "request docs upload" ON storage.objects;
CREATE POLICY "request docs upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'request-documents' AND public.can_access_storage_folder((storage.foldername(name))[1]));

DROP POLICY IF EXISTS "request docs delete" ON storage.objects;
CREATE POLICY "request docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'request-documents' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));

-- Documents Table DELETE Policy
DROP POLICY IF EXISTS "documents delete" ON public.documents;
CREATE POLICY "documents delete" ON public.documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
