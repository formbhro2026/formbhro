-- Migration: 20261026000000_allow_team_announcements_and_notes.sql
-- Description: Ensure team members have full access to manage news/announcements,
--              add payment_notes and escalation_reason columns,
--              and enhance is_team() check.

-- 1. Ensure columns exist on requests table
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_notes text,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- 2. Enhanced is_team() function to check both user_roles and active team_members
CREATE OR REPLACE FUNCTION public.is_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('team', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.team_members WHERE id = auth.uid() AND is_active = true
  );
$$;

-- 3. Permissions and RLS on public.news
GRANT ALL ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;

DROP POLICY IF EXISTS "news admin write" ON public.news;
DROP POLICY IF EXISTS "news team write" ON public.news;
DROP POLICY IF EXISTS "news authenticated insert" ON public.news;

CREATE POLICY "news team write"
  ON public.news
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_team())
  WITH CHECK (public.is_admin() OR public.is_team());
