-- ============================================================
-- FCM Device Tokens Table
-- Stores FCM push notification tokens per user per device.
-- Used by the send-fcm-notification Edge Function to target
-- specific devices when notifications are inserted.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     text        NOT NULL,
  platform      text        NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
  fcm_token     text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

-- RLS: users can only manage their own tokens
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own device tokens"
  ON public.device_tokens
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all tokens (needed for sending push to all admins)
CREATE POLICY "Admins read all device tokens"
  ON public.device_tokens
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_device_tokens_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_device_tokens_updated_at();
