import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// ── Shared inflation settings (persisted to localStorage, synced across pages) ──
export function useInflationSettings() {
  const [inflationRate, setInflationRateState] = useState(() => {
    const v = localStorage.getItem("inflation_rate");
    return v != null ? Number(v) : 2.0;
  });
  const [inflationAdjusted, setInflationAdjustedState] = useState(() => {
    return localStorage.getItem("inflation_adjusted") === "true";
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "inflation_rate" && e.newValue != null) setInflationRateState(Number(e.newValue));
      if (e.key === "inflation_adjusted" && e.newValue != null) setInflationAdjustedState(e.newValue === "true");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setInflationRate = (v) => {
    const n = Number(v);
    localStorage.setItem("inflation_rate", String(n));
    setInflationRateState(n);
    window.dispatchEvent(new StorageEvent("storage", { key: "inflation_rate", newValue: String(n) }));
  };

  const setInflationAdjusted = (v) => {
    localStorage.setItem("inflation_adjusted", String(v));
    setInflationAdjustedState(v);
    window.dispatchEvent(new StorageEvent("storage", { key: "inflation_adjusted", newValue: String(v) }));
  };

  return { inflationRate, setInflationRate, inflationAdjusted, setInflationAdjusted };
}

export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password, username) => {
    if (!supabase) return { error: { message: "Supabase not configured" } };
    return supabase.auth.signUp({
      email, password,
      options: username ? { data: { display_name: username } } : undefined,
    });
  };

  const signIn = async (email, password) => {
    if (!supabase) return { error: { message: "Supabase not configured" } };
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return { user, loading, signUp, signIn, signOut };
}
