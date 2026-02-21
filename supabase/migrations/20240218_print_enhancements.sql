-- =============================================
-- Fix: Add missing columns to existing print_orders table
-- & insert print pricing into store_settings
-- =============================================

-- 1. Add orientation column if missing
ALTER TABLE print_orders
ADD COLUMN IF NOT EXISTS orientation TEXT DEFAULT 'portrait';

-- 2. Add copies column if missing
ALTER TABLE print_orders
ADD COLUMN IF NOT EXISTS copies INTEGER DEFAULT 1;

-- 3. Insert print pricing settings
INSERT INTO store_settings (key, value)
VALUES
    ('bw_price', '3'),
    ('color_price', '10')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
