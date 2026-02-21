-- ============================================================
-- MRN MULLA KIRANA — Complete Supabase SQL Schema
-- Run this entire script in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ─── 1. PRODUCTS TABLE ───
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    price NUMERIC NOT NULL DEFAULT 0,
    mrp NUMERIC DEFAULT 0,
    pack_size TEXT DEFAULT '',
    unit TEXT DEFAULT 'g',
    stock INTEGER DEFAULT 0,
    image_url TEXT DEFAULT '',
    barcode TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. ORDERS TABLE ───
CREATE TABLE IF NOT EXISTS public.orders (
    id BIGSERIAL PRIMARY KEY,
    customer_json JSONB DEFAULT '{}',
    cart_json JSONB DEFAULT '[]',
    total_amount NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'COD',
    payment_status TEXT DEFAULT 'Unpaid',
    status TEXT DEFAULT 'Received',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. DISABLE RLS (so the app can read/write without auth) ───
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow EVERYONE to read products (customers browsing the store)
CREATE POLICY "Allow public read products" ON public.products
    FOR SELECT USING (true);

-- Allow EVERYONE to insert/update/delete products (admin operations)
CREATE POLICY "Allow public insert products" ON public.products
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update products" ON public.products
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete products" ON public.products
    FOR DELETE USING (true);

-- Allow EVERYONE to read orders
CREATE POLICY "Allow public read orders" ON public.orders
    FOR SELECT USING (true);

-- Allow EVERYONE to insert orders (customers placing orders)
CREATE POLICY "Allow public insert orders" ON public.orders
    FOR INSERT WITH CHECK (true);

-- Allow EVERYONE to update orders (admin changing status)
CREATE POLICY "Allow public update orders" ON public.orders
    FOR UPDATE USING (true) WITH CHECK (true);

-- ─── 4. ENABLE REALTIME (for live order notifications) ───
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- ─── 5. SEED PRODUCTS DATA ───
-- This inserts all 106 products from your catalog

INSERT INTO public.products (id, name, category, price, mrp, pack_size, unit, stock, image_url, barcode) VALUES
-- Cooking Oil & Ghee
(1, 'Fortune Sunflower Oil', 'Cooking Oil & Ghee', 140, 160, '1', 'L', 25, 'https://m.media-amazon.com/images/I/61qx8K6SXNL._SL1500_.jpg', '8901058851427'),
(2, 'Saffola Gold Oil', 'Cooking Oil & Ghee', 189, 210, '1', 'L', 18, 'https://m.media-amazon.com/images/I/71sM2a3HYHL._SL1500_.jpg', '8904004400583'),
(3, 'Pyari Gold Mustard Oil', 'Cooking Oil & Ghee', 110, 125, '700', 'ml', 30, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901552001024'),
(4, 'Amul Ghee', 'Cooking Oil & Ghee', 290, 310, '500', 'ml', 12, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262150248'),
(5, 'Patanjali Ghee', 'Cooking Oil & Ghee', 270, 295, '500', 'ml', 15, 'https://m.media-amazon.com/images/I/51YGXGiCtxL._SL1100_.jpg', '8904109455124'),
(6, 'Freedom Refined Oil', 'Cooking Oil & Ghee', 125, 140, '1', 'L', 20, 'https://m.media-amazon.com/images/I/61w6HVWH7aL._SL1200_.jpg', '8901552007026'),
(7, 'Sundrop Heart Oil', 'Cooking Oil & Ghee', 155, 170, '1', 'L', 14, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901058000191'),
(8, 'Dalda Vanaspati', 'Cooking Oil & Ghee', 80, 90, '500', 'ml', 22, 'https://m.media-amazon.com/images/I/61qx8K6SXNL._SL1500_.jpg', '8901058851700'),
(9, 'Fortune Rice Bran Oil', 'Cooking Oil & Ghee', 165, 185, '1', 'L', 10, 'https://m.media-amazon.com/images/I/61qx8K6SXNL._SL1500_.jpg', '8901058002980'),
(10, 'Emami Healthy Oil', 'Cooking Oil & Ghee', 135, 150, '1', 'L', 16, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8902052100019'),
(11, 'Nandini Pure Ghee', 'Cooking Oil & Ghee', 260, 280, '500', 'ml', 8, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262150300'),
(12, 'Coconut Oil (Parachute)', 'Cooking Oil & Ghee', 95, 110, '250', 'ml', 35, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901088710015'),

-- Atta & Flour
(13, 'Aashirvaad Whole Wheat Atta', 'Atta & Flour', 275, 310, '5', 'kg', 20, 'https://m.media-amazon.com/images/I/71bz8v9W7-L._SL1500_.jpg', '8901063023123'),
(14, 'Pillsbury Chakki Atta', 'Atta & Flour', 260, 290, '5', 'kg', 15, 'https://m.media-amazon.com/images/I/71bz8v9W7-L._SL1500_.jpg', '8901725181598'),
(15, 'Fortune Chakki Fresh Atta', 'Atta & Flour', 255, 280, '5', 'kg', 18, 'https://m.media-amazon.com/images/I/71bz8v9W7-L._SL1500_.jpg', '8901058004380'),
(16, 'Rajdhani Besan', 'Atta & Flour', 75, 85, '500', 'g', 25, 'https://m.media-amazon.com/images/I/71z7GzGrJeL._SL1500_.jpg', '8904101702504'),
(17, 'Maida (Refined Flour)', 'Atta & Flour', 40, 45, '500', 'g', 30, 'https://m.media-amazon.com/images/I/71z7GzGrJeL._SL1500_.jpg', '8901063340916'),
(18, 'Rava (Suji/Sooji)', 'Atta & Flour', 45, 52, '500', 'g', 22, 'https://m.media-amazon.com/images/I/71z7GzGrJeL._SL1500_.jpg', '8901063341524'),
(19, 'Rice Flour', 'Atta & Flour', 42, 48, '500', 'g', 20, 'https://m.media-amazon.com/images/I/71z7GzGrJeL._SL1500_.jpg', '8901063341914'),
(20, 'Aashirvaad Multigrain Atta', 'Atta & Flour', 310, 345, '5', 'kg', 10, 'https://m.media-amazon.com/images/I/71bz8v9W7-L._SL1500_.jpg', '8901063023901'),
(21, 'Corn Flour', 'Atta & Flour', 35, 40, '200', 'g', 28, 'https://m.media-amazon.com/images/I/71z7GzGrJeL._SL1500_.jpg', '8901063043008'),
(22, 'Poha (Flattened Rice)', 'Atta & Flour', 38, 42, '500', 'g', 26, 'https://m.media-amazon.com/images/I/71z7GzGrJeL._SL1500_.jpg', '8904101700005'),

-- Rice & Dal
(23, 'India Gate Basmati Rice', 'Rice & Dal', 420, 470, '5', 'kg', 12, 'https://m.media-amazon.com/images/I/71YRCaOSqEL._SL1500_.jpg', '8901501100068'),
(24, 'Daawat Rozana Basmati', 'Rice & Dal', 360, 400, '5', 'kg', 15, 'https://m.media-amazon.com/images/I/71YRCaOSqEL._SL1500_.jpg', '8901501102161'),
(25, 'Toor Dal (Arhar)', 'Rice & Dal', 95, 110, '1', 'kg', 20, 'https://m.media-amazon.com/images/I/71kfUFEOk0L._SL1500_.jpg', '8904101702511'),
(26, 'Moong Dal', 'Rice & Dal', 110, 125, '1', 'kg', 18, 'https://m.media-amazon.com/images/I/71kfUFEOk0L._SL1500_.jpg', '8904101702528'),
(27, 'Chana Dal', 'Rice & Dal', 85, 95, '1', 'kg', 22, 'https://m.media-amazon.com/images/I/71kfUFEOk0L._SL1500_.jpg', '8904101702535'),
(28, 'Urad Dal (Black Gram)', 'Rice & Dal', 105, 120, '1', 'kg', 16, 'https://m.media-amazon.com/images/I/71kfUFEOk0L._SL1500_.jpg', '8904101702542'),
(29, 'Masoor Dal (Red Lentil)', 'Rice & Dal', 78, 88, '1', 'kg', 24, 'https://m.media-amazon.com/images/I/71kfUFEOk0L._SL1500_.jpg', '8904101702559'),
(30, 'Rajma (Kidney Beans)', 'Rice & Dal', 120, 135, '1', 'kg', 14, 'https://m.media-amazon.com/images/I/71kfUFEOk0L._SL1500_.jpg', '8904101702566'),
(31, 'Sona Masoori Rice', 'Rice & Dal', 310, 340, '5', 'kg', 10, 'https://m.media-amazon.com/images/I/71YRCaOSqEL._SL1500_.jpg', '8901501100082'),
(32, 'Kabuli Chana', 'Rice & Dal', 130, 145, '1', 'kg', 12, 'https://m.media-amazon.com/images/I/71kfUFEOk0L._SL1500_.jpg', '8904101702573'),
(33, 'Sugar', 'Rice & Dal', 45, 48, '1', 'kg', 40, 'https://m.media-amazon.com/images/I/51sBo0gXsIL._SL1000_.jpg', '8901063341517'),
(34, 'Salt (Tata)', 'Rice & Dal', 22, 25, '1', 'kg', 50, 'https://m.media-amazon.com/images/I/51jHIxc8WFL._SL1100_.jpg', '8901725121020'),

-- Spices & Masala
(35, 'MDH Turmeric Powder', 'Spices & Masala', 36, 42, '100', 'g', 30, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003009'),
(36, 'MDH Red Chilli Powder', 'Spices & Masala', 48, 55, '100', 'g', 28, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003016'),
(37, 'MDH Garam Masala', 'Spices & Masala', 62, 70, '100', 'g', 20, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003023'),
(38, 'Everest Kitchen King', 'Spices & Masala', 55, 62, '100', 'g', 22, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8901552004009'),
(39, 'Cumin Seeds (Jeera)', 'Spices & Masala', 58, 65, '100', 'g', 25, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8904101702580'),
(40, 'Mustard Seeds (Rai)', 'Spices & Masala', 25, 30, '100', 'g', 35, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8904101702597'),
(41, 'Coriander Powder (Dhaniya)', 'Spices & Masala', 32, 38, '100', 'g', 30, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003030'),
(42, 'Black Pepper Powder', 'Spices & Masala', 85, 95, '50', 'g', 15, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003047'),
(43, 'MDH Chaat Masala', 'Spices & Masala', 30, 35, '50', 'g', 20, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003054'),
(44, 'Sambar Masala', 'Spices & Masala', 40, 48, '100', 'g', 18, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003061'),
(45, 'Biryani Masala', 'Spices & Masala', 50, 58, '50', 'g', 16, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003078'),
(46, 'Pav Bhaji Masala', 'Spices & Masala', 42, 48, '100', 'g', 14, 'https://m.media-amazon.com/images/I/41Ql7N7rP5L._SL1000_.jpg', '8902519003085'),

-- Cleaning & Household
(47, 'Harpic Toilet Cleaner', 'Cleaning & Household', 78, 90, '500', 'ml', 20, 'https://m.media-amazon.com/images/I/61WCoc+l7XL._SL1500_.jpg', '8901548250007'),
(48, 'Lizol Floor Cleaner', 'Cleaning & Household', 120, 135, '975', 'ml', 15, 'https://m.media-amazon.com/images/I/51V7ajl-0JL._SL1200_.jpg', '8901548251004'),
(49, 'Vim Bar', 'Cleaning & Household', 10, 12, '130', 'g', 50, 'https://m.media-amazon.com/images/I/61r-drTDAhL._SL1500_.jpg', '8901030570131'),
(50, 'Vim Liquid Gel', 'Cleaning & Household', 95, 110, '500', 'ml', 18, 'https://m.media-amazon.com/images/I/61r-drTDAhL._SL1500_.jpg', '8901030570506'),
(51, 'Colin Glass Cleaner', 'Cleaning & Household', 72, 82, '500', 'ml', 12, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901030572043'),
(52, 'Domex Disinfectant', 'Cleaning & Household', 65, 75, '500', 'ml', 14, 'https://m.media-amazon.com/images/I/61WCoc+l7XL._SL1500_.jpg', '8901030572050'),
(53, 'Scotch Brite Scrub Pad', 'Cleaning & Household', 25, 30, '1', 'pc', 40, 'https://m.media-amazon.com/images/I/51V7ajl-0JL._SL1200_.jpg', '4720094375213'),
(54, 'Hit Mosquito Spray', 'Cleaning & Household', 160, 180, '200', 'ml', 10, 'https://m.media-amazon.com/images/I/51V7ajl-0JL._SL1200_.jpg', '8901548571004'),
(55, 'Good Knight Liquid', 'Cleaning & Household', 52, 60, '45', 'ml', 25, 'https://m.media-amazon.com/images/I/51V7ajl-0JL._SL1200_.jpg', '8901548571011'),
(56, 'Room Freshener (Odonil)', 'Cleaning & Household', 55, 62, '50', 'g', 15, 'https://m.media-amazon.com/images/I/51V7ajl-0JL._SL1200_.jpg', '8901023008139'),

-- Snacks & Biscuits
(57, 'Parle-G Biscuit', 'Snacks & Biscuits', 10, 10, '79.9', 'g', 60, 'https://m.media-amazon.com/images/I/51gvaflFJ-L._SL1000_.jpg', '8904063011020'),
(58, 'Good Day Cashew Cookies', 'Snacks & Biscuits', 30, 35, '200', 'g', 30, 'https://m.media-amazon.com/images/I/51gvaflFJ-L._SL1000_.jpg', '8901063012004'),
(59, 'Oreo Chocolate', 'Snacks & Biscuits', 30, 30, '120', 'g', 35, 'https://m.media-amazon.com/images/I/71OyPRcRF4L._SL1500_.jpg', '7622210455543'),
(60, 'Lays Classic Salted', 'Snacks & Biscuits', 20, 20, '52', 'g', 40, 'https://m.media-amazon.com/images/I/41uTbMLhTFL._SL1000_.jpg', '8901491101950'),
(61, 'Kurkure Masala Munch', 'Snacks & Biscuits', 20, 20, '75', 'g', 38, 'https://m.media-amazon.com/images/I/41uTbMLhTFL._SL1000_.jpg', '8901491502313'),
(62, 'Maggi 2-Minute Noodles', 'Snacks & Biscuits', 14, 14, '70', 'g', 50, 'https://m.media-amazon.com/images/I/71z7GzGrJeL._SL1500_.jpg', '8901058852134'),
(63, 'Dark Fantasy Choco Fills', 'Snacks & Biscuits', 40, 40, '150', 'g', 22, 'https://m.media-amazon.com/images/I/51gvaflFJ-L._SL1000_.jpg', '8901063040212'),
(64, 'Haldiram Aloo Bhujia', 'Snacks & Biscuits', 55, 60, '200', 'g', 20, 'https://m.media-amazon.com/images/I/41uTbMLhTFL._SL1000_.jpg', '8904004400590'),
(65, 'Marie Gold Biscuit', 'Snacks & Biscuits', 25, 28, '250', 'g', 35, 'https://m.media-amazon.com/images/I/51gvaflFJ-L._SL1000_.jpg', '8901063012011'),
(66, 'Bourbon Chocolate Cream', 'Snacks & Biscuits', 30, 30, '150', 'g', 28, 'https://m.media-amazon.com/images/I/51gvaflFJ-L._SL1000_.jpg', '8901063012028'),
(67, 'Hide & Seek Fab', 'Snacks & Biscuits', 35, 38, '150', 'g', 18, 'https://m.media-amazon.com/images/I/51gvaflFJ-L._SL1000_.jpg', '8901063012035'),
(68, 'Bingo Tedhe Medhe', 'Snacks & Biscuits', 20, 20, '66', 'g', 32, 'https://m.media-amazon.com/images/I/41uTbMLhTFL._SL1000_.jpg', '8901491100250'),

-- Beverages
(69, 'Coca-Cola', 'Beverages', 40, 40, '750', 'ml', 25, 'https://m.media-amazon.com/images/I/41bPmKzqL4L._SL1000_.jpg', '5449000133335'),
(70, 'Thums Up', 'Beverages', 40, 40, '750', 'ml', 22, 'https://m.media-amazon.com/images/I/41bPmKzqL4L._SL1000_.jpg', '8901764010012'),
(71, 'Sprite', 'Beverages', 40, 40, '750', 'ml', 20, 'https://m.media-amazon.com/images/I/41bPmKzqL4L._SL1000_.jpg', '5449000133342'),
(72, 'Tata Tea Gold', 'Beverages', 135, 150, '250', 'g', 18, 'https://m.media-amazon.com/images/I/51+pwbMUxfL._SL1000_.jpg', '8901725121044'),
(73, 'Nescafe Classic Coffee', 'Beverages', 185, 205, '100', 'g', 14, 'https://m.media-amazon.com/images/I/51+pwbMUxfL._SL1000_.jpg', '7613036687188'),
(74, 'Bournvita', 'Beverages', 230, 255, '500', 'g', 12, 'https://m.media-amazon.com/images/I/51+pwbMUxfL._SL1000_.jpg', '7622210455550'),
(75, 'Horlicks Original', 'Beverages', 260, 285, '500', 'g', 10, 'https://m.media-amazon.com/images/I/51+pwbMUxfL._SL1000_.jpg', '8901571004829'),
(76, 'Maaza Mango Drink', 'Beverages', 25, 25, '600', 'ml', 30, 'https://m.media-amazon.com/images/I/41bPmKzqL4L._SL1000_.jpg', '8901764120018'),
(77, 'Paper Boat Aam Panna', 'Beverages', 30, 30, '200', 'ml', 20, 'https://m.media-amazon.com/images/I/41bPmKzqL4L._SL1000_.jpg', '8906002540017'),
(78, 'Red Bull Energy Drink', 'Beverages', 115, 125, '250', 'ml', 8, 'https://m.media-amazon.com/images/I/41bPmKzqL4L._SL1000_.jpg', '9002490100070'),

-- Personal Care
(79, 'Colgate Strong Teeth', 'Personal Care', 52, 58, '100', 'g', 25, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901314010018'),
(80, 'Pepsodent Toothpaste', 'Personal Care', 48, 55, '100', 'g', 22, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901030572067'),
(81, 'Head & Shoulders Shampoo', 'Personal Care', 185, 210, '180', 'ml', 12, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '4902430401883'),
(82, 'Clinic Plus Shampoo', 'Personal Care', 95, 110, '175', 'ml', 18, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901030572074'),
(83, 'Nivea Body Lotion', 'Personal Care', 175, 195, '200', 'ml', 10, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '4005900009395'),
(84, 'Vaseline Body Lotion', 'Personal Care', 145, 165, '200', 'ml', 14, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901030572081'),
(85, 'Gillette Guard Razor', 'Personal Care', 35, 40, '1', 'pc', 20, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '7702018584321'),
(86, 'Dettol Handwash', 'Personal Care', 75, 85, '200', 'ml', 16, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901396341017'),
(87, 'Himalaya Face Wash', 'Personal Care', 110, 125, '100', 'ml', 12, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901138501136'),
(88, 'Navratna Oil', 'Personal Care', 65, 72, '100', 'ml', 20, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8902052100026'),

-- Dairy & Eggs
(89, 'Amul Taaza Milk', 'Dairy & Eggs', 28, 28, '500', 'ml', 30, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262150502'),
(90, 'Amul Butter', 'Dairy & Eggs', 56, 58, '100', 'g', 20, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262250012'),
(91, 'Amul Cheese Slice', 'Dairy & Eggs', 35, 38, '5', 'slices', 15, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262350013'),
(92, 'Curd (Plain Dahi)', 'Dairy & Eggs', 30, 32, '400', 'g', 18, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262450014'),
(93, 'Paneer (Fresh)', 'Dairy & Eggs', 90, 100, '200', 'g', 10, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262550015'),
(94, 'Farm Eggs', 'Dairy & Eggs', 72, 80, '6', 'pcs', 20, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8904101702604'),
(95, 'Amul Masti Buttermilk', 'Dairy & Eggs', 15, 15, '200', 'ml', 25, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262650016'),
(96, 'Amul Lassi', 'Dairy & Eggs', 25, 25, '200', 'ml', 22, 'https://m.media-amazon.com/images/I/41Hpfq9z7cL._SL1000_.jpg', '8901262750017'),

-- Soaps & Detergent
(97, 'Surf Excel Quick Wash', 'Soaps & Detergent', 55, 62, '500', 'g', 20, 'https://m.media-amazon.com/images/I/61r-drTDAhL._SL1500_.jpg', '8901030572098'),
(98, 'Rin Detergent Bar', 'Soaps & Detergent', 10, 12, '140', 'g', 50, 'https://m.media-amazon.com/images/I/61r-drTDAhL._SL1500_.jpg', '8901030572104'),
(99, 'Tide Plus Powder', 'Soaps & Detergent', 60, 68, '500', 'g', 18, 'https://m.media-amazon.com/images/I/61r-drTDAhL._SL1500_.jpg', '4902430573306'),
(100, 'Lux Beauty Soap', 'Soaps & Detergent', 35, 38, '100', 'g', 30, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901030572111'),
(101, 'Dettol Soap (Original)', 'Soaps & Detergent', 42, 48, '75', 'g', 25, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901396341024'),
(102, 'Dove Soap', 'Soaps & Detergent', 52, 58, '75', 'g', 20, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901030572128'),
(103, 'Comfort Fabric Softener', 'Soaps & Detergent', 48, 55, '220', 'ml', 14, 'https://m.media-amazon.com/images/I/61r-drTDAhL._SL1500_.jpg', '8901030572135'),
(104, 'Ariel Matic Powder', 'Soaps & Detergent', 75, 85, '500', 'g', 12, 'https://m.media-amazon.com/images/I/61r-drTDAhL._SL1500_.jpg', '4902430573313'),
(105, 'Lifebuoy Soap', 'Soaps & Detergent', 30, 32, '100', 'g', 35, 'https://m.media-amazon.com/images/I/51Sv9pPnMSL._SL1200_.jpg', '8901030572142'),
(106, 'Wheel Detergent Powder', 'Soaps & Detergent', 29, 32, '500', 'g', 28, 'https://m.media-amazon.com/images/I/61r-drTDAhL._SL1500_.jpg', '8901030572159')

ON CONFLICT (id) DO NOTHING;

-- Reset the sequence so new products get the right IDs
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- ============================================================
-- ✅ DONE! You should now see:
--   • products table with 106 items
--   • orders table (empty, ready for new orders)
--   • RLS policies allowing read/write access
--   • Realtime enabled for live order updates
-- ============================================================
