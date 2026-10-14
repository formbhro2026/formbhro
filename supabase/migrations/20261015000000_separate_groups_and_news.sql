-- Migration: 20261015000000_separate_groups_and_news.sql
-- Description: Strictly separate Groups posts from Jobs Updates at backend & data level

-- 1. Index custom_fields target and group_id on public.news
CREATE INDEX IF NOT EXISTS idx_news_target ON public.news ((custom_fields->>'target'));
CREATE INDEX IF NOT EXISTS idx_news_group_id ON public.news ((custom_fields->>'group_id'));

-- 2. Backfill existing records to ensure data-level separation
-- Items categorized under hidden jobs update get tagged strictly to hidden-jobs-update group
UPDATE public.news
SET custom_fields = jsonb_set(
  jsonb_set(COALESCE(custom_fields, '{}'::jsonb), '{target}', '"group"'),
  '{group_id}', '"hidden-jobs-update"'
),
category = 'Group: hidden-jobs-update'
WHERE category ILIKE '%hidden%' OR category ILIKE '%special%' OR category ILIKE '%off-campus%';

-- Items explicitly categorized under group updates get tagged strictly to jobs-update group
UPDATE public.news
SET custom_fields = jsonb_set(
  jsonb_set(COALESCE(custom_fields, '{}'::jsonb), '{target}', '"group"'),
  '{group_id}', '"jobs-update"'
),
category = 'Group: jobs-update'
WHERE category ILIKE 'group:%jobs%' OR category ILIKE 'jobs update group';

-- All other public vacancy news get tagged strictly as jobs_updates
UPDATE public.news
SET custom_fields = jsonb_set(COALESCE(custom_fields, '{}'::jsonb), '{target}', '"jobs_updates"')
WHERE custom_fields->>'target' IS NULL OR (custom_fields->>'target' != 'group' AND category NOT ILIKE 'group:%');

-- 3. Dedicated Backend RPC Function: fetch Jobs Updates feed only (Excludes all groups)
CREATE OR REPLACE FUNCTION public.get_public_job_updates(p_limit int DEFAULT 100)
RETURNS SETOF public.news
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.news
  WHERE published = true
    AND (custom_fields->>'target' IS NULL OR custom_fields->>'target' = 'jobs_updates')
    AND category NOT ILIKE 'group:%'
    AND (custom_fields->>'group_id' IS NULL)
  ORDER BY published_at DESC
  LIMIT p_limit;
$$;

-- 4. Dedicated Backend RPC Function: fetch Group feed only (Isolates strictly to requested group_id)
CREATE OR REPLACE FUNCTION public.get_group_feed(p_group_id text, p_limit int DEFAULT 100)
RETURNS SETOF public.news
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.news
  WHERE published = true
    AND (
      (custom_fields->>'target' = 'group' AND custom_fields->>'group_id' = p_group_id)
      OR category ILIKE ('Group: ' || p_group_id)
      OR category ILIKE ('%' || replace(p_group_id, '-', ' ') || '%')
    )
  ORDER BY published_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_job_updates(int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_group_feed(text, int) TO authenticated, anon;
