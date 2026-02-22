-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
    phone text PRIMARY KEY,
    name text NOT NULL,
    addresses jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous/authenticated access
CREATE POLICY "Enable read access for all users" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.customers FOR UPDATE USING (true);
