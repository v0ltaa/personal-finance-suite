# Personal Finance Suite

A Vite + React app for personal finance decisions. Built with Tailwind CSS, Supabase, and React Router (HashRouter for GitHub Pages compatibility).

## Modules

### Buy vs Rent Calculator (`/`)
Model whether buying or renting makes more financial sense given purchase price, deposit, mortgage rate, rental cost, and investment return assumptions.

### Property Comparison (`/compare`)
Side-by-side comparison of up to four properties with weighted scoring.

### Map View (`/map`)
Geographic view of tracked properties on an interactive map.

### Budget Designer (`/budget`)
Multi-step budget wizard with income/expense categorisation, gauge tiles, and CSV export.

### Finance Tracker (`/finance`)
Track income and expenses over time with chart visualisations.

### Portfolio Strategy (`/portfolio-strategy`)
Four-tab module for managing a structured investment strategy:

- **Stocks** — Build a stock library. Enter any ticker and Claude generates a full fact sheet (sector, volatility tier, moat, key ratios, analyst sentiment). Fact sheets are stored in Supabase. Filter and sort by sector, volatility, and more.

- **Portfolio** — Allocate stocks across three strategy buckets:
  - *Buy & Hold* (40% target) — long-term core positions
  - *Fortress* (configurable) — capital preservation and defensive plays
  - *Slingshot* (configurable) — high-volatility positions with a 90 trading day countdown
  - Donut charts, over-allocation warnings, and a "Rotate Capital" tool to adjust the Fortress/Slingshot split.

- **Indicator** — Log a custom market cycle indicator (0–100 scale). Configure Slingshot/Fortress thresholds, optionally auto-compute the signal, and view a Recharts line chart with colour-coded zones over historical readings.

- **Sandbox** — Test hypothetical allocations before committing. Build named sandboxes, assign weights, get strategy section suggestions based on volatility, run a Claude-powered correlation matrix, and promote positions directly to the Portfolio tab.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

`VITE_ANTHROPIC_API_KEY` is needed for:
- Generating stock fact sheets (Stocks tab → Add Stock)
- Running correlation analysis (Sandbox tab → Analyse)

If this key is absent, the UI shows a clear error message in the modal — all other features continue to work.

---

## Supabase Setup

Create the following tables in your Supabase project (SQL editor):

```sql
-- Stock library
create table stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  ticker text not null,
  fact_sheet jsonb default '{}',
  notes text default '',
  created_at timestamptz default now()
);

-- Portfolio holdings
create table portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  ticker text not null,
  strategy text not null check (strategy in ('buy_and_hold', 'fortress', 'slingshot')),
  weight numeric not null default 0,
  entry_date date,
  created_at timestamptz default now()
);

-- Market cycle indicator log
create table indicator_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  value numeric not null,
  signal text not null check (signal in ('slingshot', 'fortress', 'neutral')),
  notes text default '',
  logged_at timestamptz default now()
);

-- Sandbox portfolios
create table sandbox_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  holdings jsonb default '[]',
  correlations jsonb default '{}',
  updated_at timestamptz default now()
);
```

Then enable **Row Level Security** and add policies so each user can only access their own rows:

```sql
-- Example for stocks (repeat for each table)
alter table stocks enable row level security;

create policy "Users manage own stocks" on stocks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Repeat the RLS policy for `portfolio_holdings`, `indicator_log`, and `sandbox_portfolios`.

---

## Local Development

```bash
cp .env.example .env
# fill in your Supabase + Anthropic keys

npm install
npm run dev
```

## Deploy to GitHub Pages

```bash
npm run build
# Push dist/ to your gh-pages branch, or use gh-pages CLI:
npx gh-pages -d dist
```

The app uses `HashRouter` and `base: '/personal-finance-suite/'` in `vite.config.js`, so all routes work correctly on GitHub Pages without a custom 404 handler.
