-- Explicitly deny all client access to rate_limits to resolve Security Advisor warning
-- while maintaining the intended security model (backend-only access).
CREATE POLICY "Reject all client access" ON public.rate_limits FOR ALL USING (false);
