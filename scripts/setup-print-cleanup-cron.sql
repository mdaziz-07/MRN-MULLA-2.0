-- 1. Enable necessary extensions (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule the cleanup function to run every 30 minutes
-- IMPORTANT: Replace 'YOUR_anon_OR_service_role_KEY' below with your actual Project API Key!
SELECT cron.schedule(
  'cleanup-print-files-every-30-minutes', -- Unique name for the cron job
  '*/30 * * * *',                         -- Cron syntax: Run every 30 minutes
  $$
    SELECT net.http_post(
      url:='https://vkbhvzgcnagxyhoiuaoj.supabase.co/functions/v1/cleanup-print-files',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_anon_OR_service_role_KEY'
      )
    ) as request_id;
  $$
);

/*
--- HELPFUL COMMANDS (Run these separately if you ever need them) ---

-- To check if the cron job successfully scheduled:
SELECT * FROM cron.job;

-- To pause/delete this specific job later:
SELECT cron.unschedule('cleanup-print-files-every-30-minutes');
*/
