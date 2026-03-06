import { useState, useEffect } from "react";
import { C, fonts } from "../lib/tokens";
import { loadAllScenarios, deleteScenario, saveScenario, loadScenarios } from "../lib/supabase";

// Full-screen scenario manager panel (opened from banner icon)
export default function ScenarioManager({ onClose, onLoadScenario }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllScenarios().then(({ data }) => {
      setScenarios(data || []);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id) => {
    await deleteScenario(id);
    setScenarios((s) => s.filter((x) => x.id !== id));
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, padding: 32, width: "100%", maxWidth: 540, maxHeight: "80vh",
        overflow: "auto", boxShadow: "0 16px 64px rgba(0,0,0,0.15)", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 12, right: 12, background: "none", border: "none",
          fontSize: 18, color: C.textLight, cursor: "pointer",
        }}>×</button>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, margin: "0 0 20px 0", color: C.text }}>Saved Scenarios</h2>

        {loading && <div style={{ color: C.textLight, fontFamily: fonts.sans }}>Loading...</div>}

        {!loading && scenarios.length === 0 && (
          <p style={{ color: C.textMid, fontFamily: fonts.serif, fontStyle: "italic" }}>
            No saved scenarios yet. Use the Save button on each input section to save configurations.
          </p>
        )}

        {scenarios.map((s) => (
          <div key={s.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 0", borderBottom: `1px solid ${C.borderLight}`,
          }}>
            <div>
              <div style={{ fontFamily: fonts.serif, fontSize: 15, color: C.text }}>{s.name}</div>
              <div style={{ fontFamily: fonts.sans, fontSize: 10, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
                {s.section} · {new Date(s.updated_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { onLoadScenario?.(s); onClose(); }} style={{
                padding: "6px 14px", border: `1px solid ${C.accent}`, borderRadius: 0,
                background: "transparent", color: C.accent, fontSize: 10, fontWeight: 600,
                cursor: "pointer", fontFamily: fonts.sans, textTransform: "uppercase",
              }}>Load</button>
              <button onClick={() => handleDelete(s.id)} style={{
                padding: "6px 14px", border: `1px solid ${C.red}`, borderRadius: 0,
                background: "transparent", color: C.red, fontSize: 10, fontWeight: 600,
                cursor: "pointer", fontFamily: fonts.sans, textTransform: "uppercase",
              }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Inline save dialog (used by Section save button)
export function SaveDialog({ section, config, onClose }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await saveScenario(name.trim(), section, config);
    setSaving(false);
    onClose();
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, padding: 28, width: "100%", maxWidth: 340,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <h3 style={{ fontFamily: fonts.serif, fontWeight: 400, margin: "0 0 16px 0", color: C.text }}>Save Configuration</h3>
        <input type="text" placeholder="Scenario name..." value={name} onChange={(e) => setName(e.target.value)} autoFocus
          style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.border}`, borderRadius: 0, fontFamily: fonts.sans, fontSize: 14, outline: "none", background: "transparent", color: C.text, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={handleSave} disabled={saving || !name.trim()} style={{
            flex: 1, padding: "10px", border: "none", background: C.text, color: C.bg,
            fontSize: 12, fontWeight: 600, fontFamily: fonts.sans, cursor: "pointer",
            textTransform: "uppercase", opacity: saving ? 0.6 : 1,
          }}>{saving ? "Saving..." : "Save"}</button>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px", border: `1.5px solid ${C.border}`, background: "transparent",
            color: C.textMid, fontSize: 12, fontWeight: 600, fontFamily: fonts.sans, cursor: "pointer",
            textTransform: "uppercase",
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Inline load dialog
export function LoadDialog({ section, onLoad, onClose }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScenarios(section).then(({ data }) => {
      setScenarios(data || []);
      setLoading(false);
    });
  }, [section]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.card, padding: 28, width: "100%", maxWidth: 380, maxHeight: "60vh", overflow: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}>
        <h3 style={{ fontFamily: fonts.serif, fontWeight: 400, margin: "0 0 16px 0", color: C.text }}>Load Configuration</h3>
        {loading && <div style={{ color: C.textLight }}>Loading...</div>}
        {!loading && scenarios.length === 0 && (
          <p style={{ color: C.textMid, fontFamily: fonts.serif, fontStyle: "italic" }}>No saved configs for this section.</p>
        )}
        {scenarios.map((s) => (
          <button key={s.id} onClick={() => { onLoad(s.config); onClose(); }} style={{
            display: "block", width: "100%", padding: "12px 14px", border: `1px solid ${C.borderLight}`,
            borderRadius: 0, background: "transparent", cursor: "pointer", textAlign: "left",
            marginBottom: 6, transition: "background 0.1s",
          }}>
            <div style={{ fontFamily: fonts.serif, fontSize: 14, color: C.text }}>{s.name}</div>
            <div style={{ fontFamily: fonts.sans, fontSize: 10, color: C.textLight, marginTop: 4 }}>
              {new Date(s.updated_at).toLocaleDateString()}
            </div>
          </button>
        ))}
        <button onClick={onClose} style={{
          marginTop: 12, width: "100%", padding: "10px", border: `1.5px solid ${C.border}`,
          background: "transparent", color: C.textMid, fontSize: 12, fontWeight: 600,
          fontFamily: fonts.sans, cursor: "pointer", textTransform: "uppercase",
        }}>Cancel</button>
      </div>
    </div>
  );
}
