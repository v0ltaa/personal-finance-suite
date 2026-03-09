import { useState, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { C, fonts } from "./lib/tokens";
import { useIsMobile, useAuth } from "./lib/hooks";
import { uploadAvatar, getAvatarUrl } from "./lib/supabase";
import AuthModal from "./components/AuthModal";
import ScenarioManager from "./components/ScenarioManager";

const modules = [
  { key: "buyVsRent", label: "Buy Scenario", path: "/" },
  { key: "sandbox", label: "Rent vs Buy", path: "/sandbox" },
  { key: "financeTracker", label: "Personal Finance Tracker", path: null },
  { key: "gaffTracker", label: "Gaff Tracker", path: "/gaff" },
];

export default function App() {
  const mobile = useIsMobile();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAuth, setShowAuth] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !auth.user) return;
    await uploadAvatar(auth.user.id, file);
    // Force refresh user metadata
    window.location.reload();
  };

  const currentPath = location.pathname;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: fonts.sans }}>
      {/* Banner Bar */}
      <div style={{
        background: C.card, borderBottom: `1.5px solid ${C.border}`,
        padding: mobile ? "14px 16px" : "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div onClick={() => navigate("/")} style={{
          fontSize: mobile ? 20 : 26, fontFamily: fonts.serif, fontWeight: 400,
          color: C.text, letterSpacing: "-0.02em", cursor: "pointer",
        }}>
          Personal Finance Suite
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Scenario icon */}
          <button title="Scenarios" onClick={() => {
            if (!auth.user) setShowAuth(true);
            else setShowScenarios(true);
          }} style={{
            width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${C.border}`,
            background: "transparent", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: C.textMid,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></svg>
          </button>
          {/* User icon / auth */}
          {auth.user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
              <div onClick={() => fileInputRef.current?.click()} title="Click to change avatar" style={{
                width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                background: getAvatarUrl(auth.user) ? `url(${getAvatarUrl(auth.user)}) center/cover` : C.accent,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: fonts.sans,
                border: `2px solid ${C.border}`, flexShrink: 0,
              }}>
                {!getAvatarUrl(auth.user) && (auth.user.user_metadata?.display_name?.[0] || auth.user.email?.[0] || "?").toUpperCase()}
              </div>
              <span style={{ fontSize: 11, color: C.textMid, fontFamily: fonts.sans, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {auth.user.user_metadata?.display_name || auth.user.email}
              </span>
              <button onClick={auth.signOut} style={{
                padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 0,
                background: "transparent", color: C.textLight, fontSize: 10,
                fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans, textTransform: "uppercase",
              }}>Out</button>
            </div>
          ) : (
            <button title="Sign In" onClick={() => setShowAuth(true)} style={{
              width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${C.border}`,
              background: "transparent", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: C.textMid,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Module Tabs */}
      <div style={{
        background: C.card, borderBottom: `1.5px solid ${C.border}`,
        padding: mobile ? "0 16px" : "0 32px",
        display: "flex", gap: 0, overflowX: "auto",
      }}>
        {modules.map((m) => {
          const isActive = m.path === currentPath || (m.path === "/" && currentPath === "");
          const isDisabled = m.path === null;
          return (
            <button key={m.key} onClick={() => !isDisabled && navigate(m.path)} style={{
              padding: mobile ? "14px 16px" : "14px 24px",
              border: "none",
              borderBottom: isActive ? `3px solid ${C.accent}` : "3px solid transparent",
              background: "transparent",
              cursor: isDisabled ? "default" : "pointer",
              color: isActive ? C.text : C.textLight,
              fontSize: mobile ? 12 : 14,
              fontWeight: isActive ? 600 : 500,
              fontFamily: fonts.sans, whiteSpace: "nowrap",
              transition: "all 0.15s",
              opacity: isDisabled ? 0.5 : 1,
            }}>
              {m.label}
              {isDisabled && <span style={{ fontSize: 9, marginLeft: 6, color: C.textFaint, fontWeight: 400 }}>Soon</span>}
            </button>
          );
        })}
      </div>

      {/* Page Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: mobile ? "32px 16px" : "48px 32px" }}>
        <Outlet />
      </div>

      {/* Modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} auth={auth} />}
      {showScenarios && <ScenarioManager onClose={() => setShowScenarios(false)} />}
    </div>
  );
}
