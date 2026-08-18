-- =========================================================
-- Migration: new cafeteria item list + extra-hours add-on
-- Run this AFTER migration_payment_methods.sql
-- =========================================================

alter table cafeteria_orders drop constraint if exists cafeteria_orders_item_check;
alter table cafeteria_orders add constraint cafeteria_orders_item_check
  check (item in (
    -- cafeteria items
    'Crackers', 'Candy - Small', 'Candy - Large', 'Juice / Soft Drink',
    'Chocolate - Small', 'Chocolate - Large', 'Water', 'Socks',
    -- extra-hours add-ons (share the same pending/settle flow)
    '+1 Hour', '+1-2 Hours', '+2-3 Hours', '+3-6 Hours'
  ));
