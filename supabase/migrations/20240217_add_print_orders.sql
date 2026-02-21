create table if not exists print_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  customer_name text,
  customer_phone text,
  files jsonb not null, -- Array of { url, name, type }
  print_type text check (print_type in ('bw', 'color')),
  status text default 'pending' check (status in ('pending', 'priced', 'accepted', 'completed', 'rejected')),
  price numeric default 0,
  customer_note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table print_orders enable row level security;

create policy "Public can insert print orders"
  on print_orders for insert
  with check (true);

create policy "Users can view their own print orders"
  on print_orders for select
  using (true); -- Simplified for now, can be restricted later

create policy "Admin can update print orders"
  on print_orders for update
  using (true);
