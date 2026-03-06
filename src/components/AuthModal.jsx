import { useState } from "react";
import { C, fonts } from "../lib/tokens";
import { supabase } from "../lib/supabase";

export default function AuthModal({ onClose, auth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!supabase) {
    return (
      <Overlay onClose={onClose}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, margin: "0 0 16px 0", color: C.text }}>Supabase Not Configured</h2>
        <p style={{ fontFamily: fonts.serif, color: C.textMid, lineHeight: 1.6, margin: 0 }}>
          To enable user accounts, set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in a <code>.env</code> file at the project root.
        </p>
      </Overlay>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = mode === "login"
      ? await auth.signIn(email, password)
      : await auth.signUp(email, password);
    setLoading(false);
    if (res.error) setError(res.error.message);
    else onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, margin: "0 0 20px 0", color: C.text }}>
        {mode === "login" ? "Sign In" : "Create Account"}
      </h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
          style={{ padding: "10px 12px", border: `1.5px solid ${C.border}`, borderRadius: 0, fontFamily: fonts.sans, fontSize: 14, outline: "none", background: "transparent", color: C.text }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
          style={{ padding: "10px 12px", border: `1.5px solid ${C.border}`, borderRadius: 0, fontFamily: fonts.sans, fontSize: 14, outline: "none", background: "transparent", color: C.text }} />
        {error && <div style={{ color: C.red, fontSize: 12, fontFamily: fonts.sans }}>{error}</div>}
        <button type="submit" disabled={loading} style={{
          padding: "12px", border: "none", background: C.text, color: C.bg,
          fontSize: 13, fontWeight: 600, fontFamily: fonts.sans, cursor: "pointer",
          letterSpacing: "0.04em", textTransform: "uppercase", opacity: loading ? 0.6 : 1,
        }}>{loading ? "..." : mode === "login" ? "Sign In" : "Sign Up"}</button>
      </form>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
          style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontFamily: fonts.sans, fontSize: 12, fontWeight: 600 }}>
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, padding: 32, width: "100%", maxWidth: 380,
        boxShadow: "0 16px 64px rgba(0,0,0,0.15)", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 12, right: 12, background: "none", border: "none",
          fontSize: 18, color: C.textLight, cursor: "pointer",
        }}>×</button>
        {children}
      </div>
    </div>
  );
}
