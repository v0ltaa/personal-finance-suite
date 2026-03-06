import { C, fonts } from "../lib/tokens";

export default function SummaryBar({ children }) {
  return (
    <div style={{
      marginTop: 16, padding: "10px 16px", background: C.borderLight,
      borderLeft: `3px solid ${C.accent}`,
      fontFamily: fonts.serif, fontSize: 14, color: C.textMid, fontStyle: "italic",
    }}>{children}</div>
  );
}
