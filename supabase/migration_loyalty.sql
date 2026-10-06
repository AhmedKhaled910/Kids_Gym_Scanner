-- =========================================================
-- Migration: monthly loyalty reward tiers
-- Run this AFTER migration_loyalty.sql
-- =========================================================

-- Existing loyalty_rewards rows represent the old single 9-visit offer.
-- Keep them as one-hour rewards so historical redemption records are not lost.
alter table loyalty_rewards
  add column if not exists tier text;

update loyalty_rewards
set tier = 'one_hour'
where tier is null;

alter table loyalty_rewards
  alter column tier set not null;

alter table loyalty_rewards
  drop constraint if exists loyalty_rewards_tier_check;

alter table loyalty_rewards
  add constraint loyalty_rewards_tier_check
  check (tier in ('one_hour', 'two_hours'));

alter table loyalty_rewards
  drop constraint if exists loyalty_rewards_child_id_month_start_key;

-- The original table has an unnamed unique constraint in most installations.
-- Drop it by discovering its generated constraint name, then enforce the new
-- three-column uniqueness below.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'loyalty_rewards'
    and con.contype = 'u'
    and pg_get_constraintdef(con.oid) like '%(child_id, month_start)%';

  if constraint_name is not null then
    execute format('alter table loyalty_rewards drop constraint %I', constraint_name);
  end if;
end $$;

alter table loyalty_rewards
  add constraint loyalty_rewards_child_month_tier_key
  unique (child_id, month_start, tier);

create index if not exists idx_loyalty_rewards_child_month_tier
  on loyalty_rewards (child_id, month_start, tier);

-- Each new month still starts automatically because month_start is part of
-- the unique key. No scheduled reset job is required.
