INSERT INTO public.categories (name, description, is_active)
VALUES 
  ('Government Form', 'Various government and administrative forms', true),
  ('Student Scholarship', 'Educational scholarships and student forms', true),
  ('Job Application', 'Employment and job related forms', true),
  ('Other', 'Other general requests', true)
ON CONFLICT (name) DO NOTHING;
