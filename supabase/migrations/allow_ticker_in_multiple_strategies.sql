-- Allow the same ticker to appear in multiple strategy buckets
-- (e.g. AAPL in both Buy & Hold and Fortress simultaneously)
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste & run

-- Step 1: Drop the ticker-only unique constraint (name may vary — the DO block
--         handles all common auto-generated names Supabase uses).
DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname INTO c_name
  FROM   pg_constraint
  WHERE  conrelid = 'portfolio_holdings'::regclass
  AND    contype  = 'u'
  AND    array_length(conkey, 1) = 1
  AND    conkey[1] = (
    SELECT attnum FROM pg_attribute
    WHERE  attrelid = 'portfolio_holdings'::regclass
    AND    attname  = 'ticker'
  );

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE portfolio_holdings DROP CONSTRAINT %I', c_name);
    RAISE NOTICE 'Dropped constraint: %', c_name;
  ELSE
    RAISE NOTICE 'No ticker-only unique constraint found — nothing to drop.';
  END IF;
END $$;

-- Step 2: Ensure uniqueness is on (ticker, strategy) so you still can't add
--         the same stock twice to the *same* bucket.
ALTER TABLE portfolio_holdings
  DROP CONSTRAINT IF EXISTS portfolio_holdings_ticker_strategy_key;

ALTER TABLE portfolio_holdings
  ADD CONSTRAINT portfolio_holdings_ticker_strategy_key
  UNIQUE (ticker, strategy);
