-- Fix 1: Mutable search path for trigger function
ALTER FUNCTION public.update_device_tokens_updated_at() SET search_path = '';

-- Fix 2: Drop the overly permissive SELECT policy on avatars that allows bucket listing
-- Since the 'avatars' bucket is public, files can still be accessed via /storage/v1/object/public/avatars/file.png
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

-- Fix 3: Revoke EXECUTE from PUBLIC for all SECURITY DEFINER functions to prevent unauthorized access

-- 3a: Triggers (Restricted to service_role / internal)
REVOKE EXECUTE ON FUNCTION public.messages_created_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_single_active_policy() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_document_rate_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_message_rate_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_storage_rate_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_request_category() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_request_transition() FROM PUBLIC;

-- 3b: RPC Endpoints (Granted to authenticated)
REVOKE EXECUTE ON FUNCTION public.can_access_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_request_ref(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_request_ref(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_storage_folder(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_storage_folder(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_new_request_with_limit(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_new_request_with_limit(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.de_escalate_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.de_escalate_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_rate_limit(text, integer, interval, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, integer, interval, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.escalate_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_users(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users(text, text, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_team_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_team_member() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_user_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_active() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.takeover_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.takeover_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transfer_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_request(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_role_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role_name() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.request_of_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_of_room(uuid) TO authenticated;
