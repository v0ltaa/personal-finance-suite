import { C, fonts } from "../lib/tokens";

export default function Stat({ label, value, sub, mobile }) {
  return (
    <div style={{ flex: 1, minWidth: mobile ? "100%" : 140 }}>
      <div style={{ fontSize: 10, fontFamily: fonts.sans, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: mobile ? 24 : 28, fontFamily: fonts.serif, color: C.text, fontWeight: 400, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, fontFamily: fonts.serif, color: C.textLight, fontStyle: "italic", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
