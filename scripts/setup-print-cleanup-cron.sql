-- 1. Enable necessary extensions (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule the cleanup function to run every 1 hour
SELECT cron.schedule(
  'cleanup-print-files-every-hour',   -- Job name
  '0 * * * *',                        -- Every hour at :00
  $$
    SELECT net.http_post(
      url:='https://vkbhvzgcnagxyhoiuaoj.supabase.co/functions/v1/cleanup-print-files',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_secret_RArbNCltgsRdjeePeSo55Q_hS7L3gg5'
      )
    ) as request_id;
  $$
);

/*
--- HELPFUL COMMANDS (Run these separately if you ever need them) ---

-- To check if the cron job successfully scheduled:
SELECT * FROM cron.job;

-- To delete this job later if needed:
SELECT cron.unschedule('cleanup-print-files-every-hour');
*/
