CREATE TABLE public.settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  brand_name text NOT NULL DEFAULT 'Formbhro',
  logo_url text,
  contact_email text NOT NULL DEFAULT '',
  support_email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  max_upload_mb integer NOT NULL DEFAULT 25,
  allowed_file_types text NOT NULL DEFAULT 'pdf,jpg,png,doc,docx,zip',
  notify_email boolean NOT NULL DEFAULT true,
  notify_push boolean NOT NULL DEFAULT true,
  theme text NOT NULL DEFAULT 'dark',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings read" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER settings_touch BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.settings (id) VALUES (true) ON CONFLICT DO NOTHING;

GRANT UPDATE, INSERT ON public.settings TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news;