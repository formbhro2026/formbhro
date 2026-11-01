-- Fix: Allow admins and team members to create and manage quick replies
-- Previously, RLS had "quick replies admin write" which only allowed public.is_admin()
-- Or failed when is_admin() wasn't evaluating true for authenticated team members

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- 1. Read policy: Team, Admin, or Global
DROP POLICY IF EXISTS "quick replies read" ON public.quick_replies;
CREATE POLICY "quick replies read" ON public.quick_replies FOR SELECT TO authenticated
  USING (
    is_global = true 
    OR owner_id = auth.uid() 
    OR public.is_admin() 
    OR public.has_role(auth.uid(), 'team')
  );

-- 2. Insert policy: Admins and Team members can insert
DROP POLICY IF EXISTS "quick replies admin write" ON public.quick_replies;
DROP POLICY IF EXISTS "quick replies own write" ON public.quick_replies;
DROP POLICY IF EXISTS "quick replies insert" ON public.quick_replies;
DROP POLICY IF EXISTS "quick replies update" ON public.quick_replies;
DROP POLICY IF EXISTS "quick replies delete" ON public.quick_replies;

CREATE POLICY "quick replies insert" ON public.quick_replies FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid() 
    OR public.is_admin() 
    OR public.has_role(auth.uid(), 'team')
  );

CREATE POLICY "quick replies update" ON public.quick_replies FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid() 
    OR public.is_admin() 
    OR public.has_role(auth.uid(), 'team')
  )
  WITH CHECK (
    owner_id = auth.uid() 
    OR public.is_admin() 
    OR public.has_role(auth.uid(), 'team')
  );

CREATE POLICY "quick replies delete" ON public.quick_replies FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid() 
    OR public.is_admin() 
    OR public.has_role(auth.uid(), 'team')
  );

-- Also allow quick_replies image uploads to avatars bucket
DROP POLICY IF EXISTS "quick replies storage insert" ON storage.objects;
CREATE POLICY "quick replies storage insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (
      (storage.foldername(name))[1] = 'quick_replies'
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "quick replies storage select" ON storage.objects;
CREATE POLICY "quick replies storage select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
