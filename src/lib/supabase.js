import { createClient } from "@supabase/supabase-js";

// Replace these with your Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ── Scenario CRUD ──

export async function saveScenario(name, section, config) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { message: "Not logged in" } };
  return supabase.from("scenarios").insert({
    user_id: user.id, name, section, config,
  }).select().single();
}

export async function loadScenarios(section) {
  if (!supabase) return { data: [], error: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  return supabase.from("scenarios")
    .select("*")
    .eq("user_id", user.id)
    .eq("section", section)
    .order("updated_at", { ascending: false });
}

export async function loadAllScenarios() {
  if (!supabase) return { data: [], error: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  return supabase.from("scenarios")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
}

export async function deleteScenario(id) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  return supabase.from("scenarios").delete().eq("id", id);
}

export async function updateScenario(id, config) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  return supabase.from("scenarios")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", id);
}
