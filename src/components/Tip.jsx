import { useState } from "react";
import { C, fonts } from "../lib/tokens";

export default function Tip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6 }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
      <span style={{
        width: 16, height: 16, borderRadius: 8, background: C.borderLight,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, color: C.textLight, cursor: "help", fontWeight: 700, fontFamily: fonts.sans,
      }}>?</span>
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: C.text, borderRadius: 8, padding: "10px 14px",
          fontSize: 12, color: "#eee", lineHeight: 1.5, width: 220, zIndex: 999,
          fontFamily: fonts.sans, fontWeight: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        }}>
          {text}
          <div style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: `6px solid ${C.text}`,
          }} />
        </div>
      )}
    </span>
  );
}
