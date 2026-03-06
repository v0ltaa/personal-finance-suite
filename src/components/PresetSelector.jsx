import { useState } from "react";
import { C, fonts } from "../lib/tokens";
import Field from "./Field";

export default function PresetSelector({ presets, value, onChange, mobile }) {
  const [custom, setCustom] = useState(false);
  const active = presets.find((p) => p.value === value);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {presets.map((p) => (
          <button key={p.label} onClick={() => { onChange(p.value); setCustom(false); }} style={{
            padding: mobile ? "8px 12px" : "8px 18px",
            border: `1.5px solid ${!custom && value === p.value ? C.text : C.border}`,
            borderRadius: 0, background: !custom && value === p.value ? C.text : "transparent",
            color: !custom && value === p.value ? C.bg : C.textMid,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
            letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
          }}>{p.label}</button>
        ))}
        <button onClick={() => setCustom(true)} style={{
          padding: mobile ? "8px 12px" : "8px 18px",
          border: `1.5px solid ${custom ? C.accent : C.border}`,
          borderRadius: 0, background: custom ? C.accentLight : "transparent",
          color: custom ? C.accent : C.textFaint,
          fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
          letterSpacing: "0.04em", textTransform: "uppercase",
        }}>Custom</button>
      </div>
      {active && !custom && (
        <div style={{ fontSize: 12, color: C.textLight, fontFamily: fonts.serif, fontStyle: "italic" }}>
          {active.desc} — {active.value}% p.a.
        </div>
      )}
      {custom && (
        <div style={{ maxWidth: 160 }}>
          <Field label="Custom rate" suffix="% p.a." value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
