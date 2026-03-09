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

// ── Avatar Upload ──

export async function uploadAvatar(userId, file) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) return { error };
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  // Store URL in user metadata
  await supabase.auth.updateUser({ data: { avatar_url: publicUrl + "?t=" + Date.now() } });
  return { url: publicUrl };
}

export function getAvatarUrl(user) {
  return user?.user_metadata?.avatar_url || null;
}

// ── Gaff Tracker: Properties ──
// Requires Supabase table: properties
// Requires Supabase storage bucket: property-photos

export async function loadProperties() {
  if (!supabase) return { data: [], error: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  return supabase.from("properties").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
}

export async function saveProperty(data) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { message: "Not logged in" } };
  return supabase.from("properties").insert({ ...data, user_id: user.id }).select().single();
}

export async function updateProperty(id, data) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  return supabase.from("properties").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();
}

export async function deleteProperty(id) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  return supabase.from("properties").delete().eq("id", id);
}

export async function uploadPropertyPhoto(userId, propertyId, file) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const ext = file.name.split(".").pop();
  const path = `${userId}/${propertyId}.${ext}`;
  const { error } = await supabase.storage.from("property-photos").upload(path, file, { upsert: true });
  if (error) return { error };
  const { data: { publicUrl } } = supabase.storage.from("property-photos").getPublicUrl(path);
  return { url: publicUrl };
}

// ── Gaff Tracker: Custom Fields ("Things I Care About") ──
// Requires Supabase table: custom_fields

export async function loadCustomFields() {
  if (!supabase) return { data: [], error: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  return supabase.from("custom_fields").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
}

export async function saveCustomField(name, field_type) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { message: "Not logged in" } };
  return supabase.from("custom_fields").insert({ name, field_type, user_id: user.id }).select().single();
}

export async function deleteCustomField(id) {
  if (!supabase) return { error: { message: "Supabase not configured" } };
  return supabase.from("custom_fields").delete().eq("id", id);
}

// ── Gaff Tracker: Workplace address (stored in user metadata) ──

export async function saveWorkplaceAddress(address) {
  if (!supabase) return { error: "Not configured" };
  return supabase.auth.updateUser({ data: { workplace_address: address } });
}

export function getWorkplaceAddress(user) {
  return user?.user_metadata?.workplace_address || "";
}

// ── Gaff Tracker: Custom landmarks (stored in user metadata) ──

export async function saveLandmarks(landmarks) {
  if (!supabase) return { error: "Not configured" };
  return supabase.auth.updateUser({ data: { landmarks } });
}

export function getLandmarks(user) {
  return user?.user_metadata?.landmarks || [];
}
