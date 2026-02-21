-- ============================================
-- MRN MULLA KIRANA - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- ─── Products Table ───
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  mrp NUMERIC,
  pack_size TEXT,
  unit TEXT DEFAULT 'g',
  stock INT DEFAULT 0,
  image_url TEXT,
  images JSONB DEFAULT '[]',
  barcode TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast barcode lookup
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ─── Orders Table ───
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  customer_json JSONB NOT NULL,
  cart_json JSONB NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'COD',
  payment_status TEXT DEFAULT 'Unpaid',
  status TEXT DEFAULT 'Received',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  rider_location JSONB,
  estimated_delivery_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  delivery_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ─── Analytics Table ───
CREATE TABLE IF NOT EXISTS analytics (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  total_orders INT DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  unique_customers INT DEFAULT 0,
  avg_order_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);

-- ─── User Preferences Table ───
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  favorite_products JSONB DEFAULT '[]',
  recent_searches JSONB DEFAULT '[]',
  saved_addresses JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Enable Realtime for orders table
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Products: Anyone can read, only service role can write
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone" ON products
  FOR SELECT USING (true);

CREATE POLICY "Products are insertable by service role" ON products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Products are updatable by service role" ON products
  FOR UPDATE USING (true);

CREATE POLICY "Products are deletable by service role" ON products
  FOR DELETE USING (true);

-- Orders: Anyone can insert, only service role can read/update
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create orders" ON orders
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert orders" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update orders" ON orders
  FOR UPDATE USING (true);

-- ============================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
