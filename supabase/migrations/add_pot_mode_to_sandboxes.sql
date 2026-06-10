-- Add pot_mode and pot_allocations columns to sandbox_portfolios
-- pot_mode:        'pot' (default) | 'portfolio'
-- pot_allocations: JSON object with per-strategy allocation percentages,
--                  e.g. { "buy_and_hold": 40, "fortress": 0, "slingshot": 60 }
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste & run

ALTER TABLE sandbox_portfolios
  ADD COLUMN IF NOT EXISTS pot_mode TEXT NOT NULL DEFAULT 'pot';

ALTER TABLE sandbox_portfolios
  ADD COLUMN IF NOT EXISTS pot_allocations JSONB NOT NULL DEFAULT '{"buy_and_hold": 40, "fortress": 0, "slingshot": 60}'::jsonb;
