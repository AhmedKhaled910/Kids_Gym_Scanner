-- =========================================================
-- Migration: updated cafeteria menu and prices
-- Keeps existing historical orders and validates all new orders
-- =========================================================

alter table cafeteria_orders
drop constraint if exists cafeteria_orders_item_check;

alter table cafeteria_orders
add constraint cafeteria_orders_item_check
check (
  item in (
    -- New cafeteria menu
    'Drinks & Snacks',
    'Fruit & Chocolate Bars',
    'Premium Snacks - 35 LE',
    'Premium Snacks - 40 LE',
    'Jelly & Gummy',
    'Kinder Collection - 80 LE',
    'Kinder Collection - 100 LE',
    'Popcorn',
    'Meal',
    'Water',

    -- Extra-hours items
    '+1 Hour',
    '+1-2 Hours',
    '+2-3 Hours',
    '+3-6 Hours',

    -- Old values kept for historical records
    'Crackers',
    'Candy',
    'Candy - Small',
    'Candy - Large',
    'Juice',
    'Juice / Soft Drink',
    'Soft Drink',
    'Chocolate',
    'Chocolate - Small',
    'Chocolate - Large',
    'Socks'
  )
);
