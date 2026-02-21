-- ============================================================
-- Fix print_orders table: Remove user_id foreign key
-- Run this in Supabase SQL Editor → New Query → Paste → Run
-- ============================================================

-- 1. Drop the user_id column (it references auth.users which we don't use)
ALTER TABLE public.print_orders DROP COLUMN IF EXISTS user_id;

-- 2. Create the print-docs storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('print-docs', 'print-docs', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies (drop first if they already exist, then recreate)
DROP POLICY IF EXISTS "Allow public uploads to print-docs" ON storage.objects;
CREATE POLICY "Allow public uploads to print-docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'print-docs');

DROP POLICY IF EXISTS "Allow public reads from print-docs" ON storage.objects;
CREATE POLICY "Allow public reads from print-docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'print-docs');

-- 4. Ensure realtime is enabled for print_orders (ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.print_orders;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================
-- ✅ After running this:
--   • print_orders no longer requires user_id
--   • print-docs storage bucket is created with public access
--   • Uploads from the Customer App should now work
-- ============================================================
