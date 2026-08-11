-- =========================================================
-- Migration: cafeteria orders (run this AFTER schema.sql,
-- in the Supabase SQL Editor)
-- =========================================================

create table if not exists cafeteria_orders (
  id            uuid primary key default gen_random_uuid(),
  check_in_id   uuid not null references check_ins(id) on delete cascade,
  item          text not null check (item in
                  ('Crackers', 'Candy', 'Juice', 'Soft Drink', 'Chocolate', 'Water', 'Socks')),
  price         numeric(10,2) not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'paid')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_cafeteria_orders_check_in_id
  on cafeteria_orders (check_in_id);

create index if not exists idx_cafeteria_orders_pending
  on cafeteria_orders (check_in_id) where status = 'pending';

alter table cafeteria_orders enable row level security;
-- No public policies — only the server-side service role key reads/writes this.
