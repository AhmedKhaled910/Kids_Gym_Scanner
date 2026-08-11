-- =========================================================
-- Migration: Cash / Visa / InstaPay payment methods
-- Run this AFTER schema.sql and migration_cafeteria.sql
-- =========================================================

-- 1. check_ins: replace the old Cash/Card constraint
alter table check_ins drop constraint if exists check_ins_payment_method_check;
alter table check_ins add constraint check_ins_payment_method_check
  check (payment_method in ('Cash', 'Visa', 'InstaPay'));

-- 2. cafeteria_orders: record which method was used when the bill was settled
alter table cafeteria_orders add column if not exists payment_method text
  check (payment_method in ('Cash', 'Visa', 'InstaPay'));
