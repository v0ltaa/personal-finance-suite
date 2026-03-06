import { C, fonts } from "../lib/tokens";
import Tip from "./Tip";

export default function Toggle({ label, value, onChange, tip }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div style={{
        width: 36, height: 20, borderRadius: 10, background: value ? C.accent : C.border,
        transition: "background 0.2s", position: "relative", flexShrink: 0,
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: 8, background: "#fff",
          position: "absolute", top: 2, left: value ? 18 : 2, transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }} />
      </div>
      <span style={{ fontSize: 13, fontFamily: fonts.sans, color: C.text, fontWeight: 500 }}>{label}</span>
      {tip && <Tip text={tip} />}
    </div>
  );
}
