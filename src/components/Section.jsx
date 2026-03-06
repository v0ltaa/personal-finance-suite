import { useState } from "react";
import { C, fonts } from "../lib/tokens";

export default function Section({ title, children, defaultOpen = true, onSave, onLoad, canSave }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        cursor: "pointer", userSelect: "none", marginBottom: open ? 20 : 0,
        paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
      }}>
        <span onClick={() => setOpen(!open)} style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, fontFamily: fonts.sans, flex: 1 }}>{title}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canSave && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onSave?.(); }} style={{
                padding: "4px 10px", border: `1px solid ${C.border}`, borderRadius: 0,
                background: "transparent", fontSize: 9, fontFamily: fonts.sans, fontWeight: 600,
                color: C.textLight, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
              }}>Save</button>
              <button onClick={(e) => { e.stopPropagation(); onLoad?.(); }} style={{
                padding: "4px 10px", border: `1px solid ${C.border}`, borderRadius: 0,
                background: "transparent", fontSize: 9, fontFamily: fonts.sans, fontWeight: 600,
                color: C.textLight, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
              }}>Load</button>
            </>
          )}
          <span onClick={() => setOpen(!open)} style={{ color: C.textFaint, fontSize: 14, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s" }}>▾</span>
        </div>
      </div>
      {open && children}
    </div>
  );
}
