-- Allow 'fortress' as a valid strategy value in portfolio_holdings
--
-- The strategy column may have a CHECK constraint that only allows
-- 'buy_and_hold' and 'slingshot'. This migration adds 'fortress'.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste & run

-- Step 1: Drop any existing strategy CHECK constraint (handles auto-generated names)
DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname INTO c_name
  FROM   pg_constraint
  WHERE  conrelid = 'portfolio_holdings'::regclass
  AND    contype  = 'c'
  AND    pg_get_constraintdef(oid) LIKE '%strategy%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE portfolio_holdings DROP CONSTRAINT %I', c_name);
    RAISE NOTICE 'Dropped strategy constraint: %', c_name;
  ELSE
    RAISE NOTICE 'No strategy CHECK constraint found — nothing to drop.';
  END IF;
END $$;

-- Step 2: Re-add with all three valid strategy values
ALTER TABLE portfolio_holdings
  ADD CONSTRAINT portfolio_holdings_strategy_check
  CHECK (strategy IN ('buy_and_hold', 'fortress', 'slingshot'));
