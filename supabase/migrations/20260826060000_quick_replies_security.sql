-- Fix Quick Replies security
DROP POLICY IF EXISTS "quick replies own write" ON public.quick_replies;
CREATE POLICY "quick replies admin write" ON public.quick_replies FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "quick replies read" ON public.quick_replies;
CREATE POLICY "quick replies read" ON public.quick_replies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'team') OR public.is_admin() OR is_global = true);
