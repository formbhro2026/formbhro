-- Fix the id vs user_id bug in get_admin_analytics security check
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_total int;
  v_completed int;
  v_avg_completion float;
  v_avg_response float;
  v_daily int;
  v_weekly int;
  v_monthly int;
  v_users int;
  v_team int;
  v_docs int;
  v_per_team json;
  v_top_users json;
  v_time_series json;
BEGIN
  -- 1. Security Check: Only admins can access this analytics payload
  -- FIXED: use user_id = auth.uid() instead of id = auth.uid()
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = auth.uid();
  IF v_role IS NULL OR v_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. Aggregate Overall Metrics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COALESCE(AVG(EXTRACT(epoch FROM (completed_at - created_at))/3600), 0),
    COALESCE(AVG(EXTRACT(epoch FROM (assigned_at - created_at))/3600), 0),
    COUNT(*) FILTER (WHERE created_at >= now() - interval '1 day'),
    COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')
  INTO v_total, v_completed, v_avg_completion, v_avg_response, v_daily, v_weekly, v_monthly
  FROM public.requests;

  -- Counts for other things
  SELECT COUNT(*) INTO v_users FROM public.user_roles WHERE role = 'user';
  SELECT COUNT(*) INTO v_team FROM public.team_members;
  SELECT COUNT(*) INTO v_docs FROM public.documents;

  -- 3. Per Team Stats
  SELECT json_agg(
    json_build_object(
      'id', t.id,
      'name', COALESCE(p.full_name, t.team_code),
      'total', COALESCE(r.total, 0),
      'done', COALESCE(r.done, 0),
      'isOnline', t.availability_status = 'online' OR COALESCE(r.last_act, '1970-01-01'::timestamp) > now() - interval '30 minutes'
    )
  ) INTO v_per_team
  FROM public.team_members t
  LEFT JOIN public.profiles p ON p.id = t.id
  LEFT JOIN (
    SELECT assigned_team_id, 
           COUNT(*) as total, 
           COUNT(*) FILTER (WHERE status = 'completed') as done,
           MAX(last_activity_at) as last_act
    FROM public.requests 
    WHERE assigned_team_id IS NOT NULL 
    GROUP BY assigned_team_id
  ) r ON r.assigned_team_id = t.id;

  -- 4. Top Users
  SELECT json_agg(
    json_build_object('id', user_id, 'count', cnt)
  ) INTO v_top_users
  FROM (
    SELECT user_id, COUNT(*) as cnt 
    FROM public.requests 
    WHERE user_id IS NOT NULL 
    GROUP BY user_id 
    ORDER BY cnt DESC 
    LIMIT 5
  ) sub;

  -- 5. Time Series (Last 30 Days)
  SELECT json_agg(
    json_build_object(
      'date', date_day,
      'count', cnt
    )
  ) INTO v_time_series
  FROM (
    SELECT date_trunc('day', created_at)::date AS date_day, COUNT(*) AS cnt
    FROM public.requests
    WHERE created_at >= now() - interval '30 days'
    GROUP BY date_day
    ORDER BY date_day ASC
  ) ts;

  -- 6. Return matched payload for UI
  RETURN json_build_object(
    'total', v_total,
    'completed', v_completed,
    'avgCompletion', v_avg_completion,
    'avgResponse', v_avg_response,
    'daily', v_daily,
    'weekly', v_weekly,
    'monthly', v_monthly,
    'users', v_users,
    'teamCount', v_team,
    'docsCount', v_docs,
    'perTeam', COALESCE(v_per_team, '[]'::json),
    'topUsers', COALESCE(v_top_users, '[]'::json),
    'topDocs', '[]'::json,
    'timeSeries', COALESCE(v_time_series, '[]'::json)
  );
END;
$$;
