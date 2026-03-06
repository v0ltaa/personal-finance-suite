import { useState } from "react";
import { C, fonts } from "../lib/tokens";
import { sliderRanges } from "../lib/calc";
import Tip from "./Tip";

export default function Field({ label, value, onChange, prefix, suffix, tip, note, sliderMode, fieldKey }) {
  const [focused, setFocused] = useState(false);
  const range = fieldKey && sliderRanges[fieldKey];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{
          fontSize: 10, fontFamily: fonts.sans, fontWeight: 600,
          color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase",
          display: "flex", alignItems: "center",
        }}>
          {label}{tip && <Tip text={tip} />}
        </label>
        {note && <span style={{ fontSize: 11, color: C.textLight, fontFamily: fonts.serif, fontStyle: "italic" }}>{note}</span>}
      </div>
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: `1.5px solid ${focused ? C.accent : C.border}`,
        padding: "8px 0", transition: "border-color 0.2s",
      }}>
        {prefix && <span style={{ color: C.textLight, fontSize: 16, marginRight: 6, fontFamily: fonts.serif }}>{prefix}</span>}
        <input type="number" value={value}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          style={{
            background: "transparent", border: "none", outline: "none",
            color: C.text, fontSize: 18, fontFamily: fonts.serif,
            width: "100%", fontWeight: 400,
          }}
        />
        {suffix && <span style={{ color: C.textLight, fontSize: 12, marginLeft: 6, fontFamily: fonts.sans }}>{suffix}</span>}
      </div>
      {sliderMode && range && (
        <input
          type="range"
          min={range.min} max={range.max} step={range.step}
          value={value || 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: "100%", marginTop: 4, accentColor: C.accent,
            height: 4, cursor: "pointer",
          }}
        />
      )}
    </div>
  );
}
