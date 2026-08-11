-- =========================================================
-- Kids Area & Nursery — Staff QR Scanner
-- Supabase schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- =========================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------
-- 1. children_profiles
--    id is the UUID that gets encoded into the parent's QR code
-- -----------------------------------------------------
create table if not exists children_profiles (
  id                            uuid primary key default gen_random_uuid(),
  parent_name                   text not null,
  parent_phone                  text,
  child_name                    text not null,
  child_age                     int  not null check (child_age >= 0),
  photo_url                     text,

  entry_type                    text not null default 'Parent'
                                 check (entry_type in ('Parent', 'Nanny/Driver')),

  -- Medical / safety
  allergies                     text,               -- e.g. "Peanuts, Dairy"
  medical_info                  text,               -- e.g. "Asthma - inhaler in bag"
  is_sick                       boolean not null default false,
  has_injury                    boolean not null default false,   -- e.g. broken arm / cast
  injury_notes                  text,

  -- Emergency contact
  emergency_contact_name        text,
  emergency_contact_phone       text,

  -- Consents
  whatsapp_consent              boolean not null default false,   -- required for Nanny/Driver drop-off
  responsibility_consent_signed boolean not null default false,   -- required if sick / injured

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index if not exists idx_children_profiles_child_name
  on children_profiles (child_name);

-- -----------------------------------------------------
-- 2. check_ins
-- -----------------------------------------------------
create table if not exists check_ins (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references children_profiles(id) on delete cascade,
  staff_id         text not null,                -- staff username/PIN label who processed it

  check_in_time    timestamptz not null default now(),
  check_out_time   timestamptz,

  duration_booked  text not null,                -- '1 Hour' | '2 Hours' | 'Full Day'
  amount_paid      numeric(10,2) not null default 0,
  payment_method   text not null check (payment_method in ('Cash', 'Card')),

  created_at       timestamptz not null default now()
);

create index if not exists idx_check_ins_child_id on check_ins (child_id);
create index if not exists idx_check_ins_open
  on check_ins (child_id) where check_out_time is null;

-- -----------------------------------------------------
-- Row Level Security
-- The app talks to Supabase using the SERVICE ROLE key from
-- Next.js Server Actions only (never exposed to the browser),
-- so RLS can stay enabled/locked-down and the service role
-- bypasses it automatically.
-- -----------------------------------------------------
alter table children_profiles enable row level security;
alter table check_ins enable row level security;

-- No public policies are created on purpose — only the
-- server-side service role key can read/write these tables.

-- -----------------------------------------------------
-- Optional: sample test data (remove in production)
-- -----------------------------------------------------
-- insert into children_profiles
--   (parent_name, child_name, child_age, entry_type, allergies, is_sick,
--    emergency_contact_name, emergency_contact_phone, whatsapp_consent, responsibility_consent_signed)
-- values
--   ('Sara Ahmed', 'Yousef Ahmed', 4, 'Parent', 'Peanut Allergy', false,
--    'Sara Ahmed', '+201001112223', true, false);
