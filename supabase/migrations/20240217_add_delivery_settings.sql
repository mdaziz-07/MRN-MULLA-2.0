INSERT INTO store_settings (key, value) VALUES 
('delivery_charge', '30'),
('delivery_min_amount', '500')
ON CONFLICT (key) DO NOTHING;
