-- Migration for Phase 6E: Policies and Categories

-- 1. Policies Table
CREATE TABLE IF NOT EXISTS public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('terms', 'privacy', 'delivery', 'other')),
  version text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

GRANT SELECT ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies read" ON public.policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "policies admin write" ON public.policies FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. Policy Acknowledgments Table
CREATE TABLE IF NOT EXISTS public.policy_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, policy_id)
);

GRANT SELECT, INSERT ON public.policy_acknowledgments TO authenticated;
GRANT ALL ON public.policy_acknowledgments TO service_role;
ALTER TABLE public.policy_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ack read" ON public.policy_acknowledgments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ack insert" ON public.policy_acknowledgments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories read" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Insert default categories
INSERT INTO public.categories (name, description) VALUES
  ('Government Form', 'General government form requests'),
  ('Tax Query', 'Questions related to taxes and filings'),
  ('Visa / Immigration', 'Visa applications and immigration forms'),
  ('General Inquiry', 'Other miscellaneous questions')
ON CONFLICT (name) DO NOTHING;

-- Expose to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.policies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
