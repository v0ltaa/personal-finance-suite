import { supabase } from "../lib/supabase";

const NOT_CONFIGURED = { data: null, error: { message: "Supabase not configured" } };

// ── Stocks ──

export async function fetchStocks() {
  if (!supabase) return { data: [], error: null };
  return supabase.from("stocks").select("*").order("created_at", { ascending: false });
}

export async function insertStock(stock) {
  if (!supabase) return NOT_CONFIGURED;
  // Upsert so two accounts generating the same ticker merge instead of duplicating
  return supabase
    .from("stocks")
    .upsert({ ...stock }, { onConflict: "ticker", ignoreDuplicates: false })
    .select()
    .single();
}

export async function deleteStock(id) {
  if (!supabase) return NOT_CONFIGURED;
  return supabase.from("stocks").delete().eq("id", id);
}

export async function updateStock(id, data) {
  if (!supabase) return NOT_CONFIGURED;
  return supabase.from("stocks").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();
}

// ── Portfolio Holdings ──

export async function fetchHoldings(strategy) {
  if (!supabase) return { data: [], error: null };
  const query = supabase.from("portfolio_holdings").select("*").order("created_at", { ascending: false });
  return strategy ? query.eq("strategy", strategy) : query;
}

export async function insertHolding(holding) {
  if (!supabase) return NOT_CONFIGURED;
  return supabase.from("portfolio_holdings").insert({ ...holding }).select().single();
}

export async function deleteHolding(id) {
  if (!supabase) return NOT_CONFIGURED;
  return supabase.from("portfolio_holdings").delete().eq("id", id);
}

export async function updateHolding(id, data) {
  if (!supabase) return NOT_CONFIGURED;
  return supabase.from("portfolio_holdings").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();
}

// ── Indicator Log ──

export async function fetchIndicatorLog() {
  if (!supabase) return { data: [], error: null };
  return supabase.from("indicator_log").select("*").order("logged_at", { ascending: false });
}

export async function insertIndicatorEntry(entry) {
  if (!supabase) return NOT_CONFIGURED;
  const payload = { logged_at: new Date().toISOString(), ...entry };
  return supabase.from("indicator_log").insert(payload).select().single();
}

export async function deleteIndicatorEntry(id) {
  if (!supabase) return NOT_CONFIGURED;
  return supabase.from("indicator_log").delete().eq("id", id);
}

// ── Sandbox Portfolios ──

function normalizeSandbox(sb) {
  return {
    ...sb,
    potMode: sb.pot_mode ?? sb.potMode ?? "pot",
    potAllocations: sb.pot_allocations ?? sb.potAllocations ?? { buy_and_hold: 40, fortress: 30, slingshot: 30 },
  };
}

export async function fetchSandboxes() {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from("sandbox_portfolios")
    .select("*")
    .order("updated_at", { ascending: false });
  return { data: data ? data.map(normalizeSandbox) : data, error };
}

export async function upsertSandbox(sandbox) {
  if (!supabase) return NOT_CONFIGURED;
  const payload = {
    id: sandbox.id,
    name: sandbox.name,
    holdings: sandbox.holdings,
    correlations: sandbox.correlations,
    pot_mode: sandbox.potMode ?? "pot",
    pot_allocations: sandbox.potAllocations,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("sandbox_portfolios")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  return { data: data ? normalizeSandbox(data) : data, error };
}

export async function deleteSandbox(id) {
  if (!supabase) return NOT_CONFIGURED;
  return supabase.from("sandbox_portfolios").delete().eq("id", id);
}
