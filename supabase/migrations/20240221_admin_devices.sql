-- ============================================================
-- Admin Devices Table for FCM Push Notifications
-- Run in Supabase SQL Editor → New Query → Paste → Run
-- ============================================================

-- 1. Create admin_devices table to store FCM tokens
CREATE TABLE IF NOT EXISTS public.admin_devices (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    fcm_token   text NOT NULL UNIQUE,
    device_name text,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- 2. Enable RLS but allow all operations (no auth needed for admin app)
ALTER TABLE public.admin_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin device registration" ON public.admin_devices;
CREATE POLICY "Allow admin device registration"
  ON public.admin_devices
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Index on fcm_token for fast upsert lookups
CREATE INDEX IF NOT EXISTS idx_admin_devices_token
  ON public.admin_devices (fcm_token);

-- ============================================================
-- ✅ After running this:
--   • admin_devices table created
--   • Admin app can INSERT/UPDATE FCM tokens on login
--   • Edge function can SELECT all tokens to send notifications
-- ============================================================
