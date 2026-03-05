import { useState, useMemo, useEffect } from "react";

// ── Utils ──
function calcStampDuty(price, ftb) {
  if (ftb) {
    if (price <= 425000) return 0;
    if (price <= 625000) return (price - 425000) * 0.05;
  }
  let duty = 0;
  const bands = [{ l: 250000, r: 0 }, { l: 925000, r: 0.05 }, { l: 1500000, r: 0.1 }, { l: Infinity, r: 0.12 }];
  let prev = 0;
  for (const b of bands) {
    if (price <= prev) break;
    const t = Math.min(price, b.l) - prev;
    if (t > 0) duty += t * b.r;
    prev = b.l;
  }
  return duty;
}

function pmtCalc(principal, rate, years) {
  if (rate === 0 || years === 0 || principal <= 0) return 0;
  const r = rate / 100 / 12, n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}
function balCalc(principal, rate, years, mPaid) {
  if (principal <= 0) return 0;
  if (rate === 0) return Math.max(0, principal - (principal / (years * 12)) * mPaid);
  const r = rate / 100 / 12;
  const p = pmtCalc(principal, rate, years);
  return Math.max(0, principal * Math.pow(1 + r, mPaid) - p * ((Math.pow(1 + r, mPaid) - 1) / r));
}

const fmt = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const fmtK = (n) => {
  if (Math.abs(n) >= 1e6) return "£" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "£" + (n / 1e3).toFixed(0) + "k";
  return "£" + Math.round(n);
};

// ── Responsive hook ──
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

// ── Design tokens ──
const C = {
  bg: "#f7f5f0", card: "#fff", border: "#e8e4db", borderLight: "#f0ece4",
  text: "#1a1a1a", textMid: "#777", textLight: "#aaa", textFaint: "#ccc",
  accent: "#b8860b", accentLight: "rgba(184,134,11,0.08)",
  green: "#2a7d2a", greenBg: "rgba(42,125,42,0.06)", greenBorder: "rgba(42,125,42,0.15)",
  red: "#c44", redBg: "rgba(204,68,68,0.06)", redBorder: "rgba(204,68,68,0.15)",
};
const fonts = { serif: "'Instrument Serif', serif", sans: "'Instrument Sans', sans-serif" };

// ── Presets ──
const hpPresets = [
  { label: "Conservative", value: 2, desc: "Below long-term average" },
  { label: "UK Average", value: 3.5, desc: "~3.5% long-term UK average" },
  { label: "City Growth", value: 5, desc: "Birmingham / Manchester tier" },
  { label: "Optimistic", value: 7, desc: "High-demand area" },
];
const invPresets = [
  { label: "Cash ISA", value: 4.5, desc: "Current best easy-access rates" },
  { label: "Bonds", value: 5, desc: "UK gilt / bond fund average" },
  { label: "Global Index", value: 7, desc: "MSCI World long-term avg" },
  { label: "S&P 500", value: 10, desc: "US large cap long-term avg" },
];

// ── Components ──
function Tip({ text }) {
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

function Field({ label, value, onChange, prefix, suffix, tip, note }) {
  const [focused, setFocused] = useState(false);
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
    </div>
  );
}

function Toggle({ label, value, onChange, tip }) {
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

function PresetSelector({ presets, value, onChange, mobile }) {
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

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 36 }}>
      <div onClick={() => setOpen(!open)} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        cursor: "pointer", userSelect: "none", marginBottom: open ? 20 : 0,
        paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, fontFamily: fonts.sans }}>{title}</span>
        <span style={{ color: C.textFaint, fontSize: 14, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s" }}>▾</span>
      </div>
      {open && children}
    </div>
  );
}

function SummaryBar({ children }) {
  return (
    <div style={{
      marginTop: 16, padding: "10px 16px", background: C.borderLight,
      borderLeft: `3px solid ${C.accent}`,
      fontFamily: fonts.serif, fontSize: 14, color: C.textMid, fontStyle: "italic",
    }}>{children}</div>
  );
}

function Stat({ label, value, sub, mobile }) {
  return (
    <div style={{ flex: 1, minWidth: mobile ? "100%" : 140 }}>
      <div style={{ fontSize: 10, fontFamily: fonts.sans, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: mobile ? 24 : 28, fontFamily: fonts.serif, color: C.text, fontWeight: 400, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, fontFamily: fonts.serif, color: C.textLight, fontStyle: "italic", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── Chart ──
function Chart({ data, keys, colors, labels, height = 220, formatY = fmtK, title, breakEvenMonth, annotation, mobile }) {
  if (!data || data.length < 2) return null;
  const allVals = data.flatMap((d) => keys.map((k) => d[k]).filter((v) => v !== undefined && !isNaN(v)));
  if (allVals.length === 0) return null;
  const maxV = Math.max(...allVals), minV = Math.min(0, ...allVals);
  const range = maxV - minV || 1;
  const w = 600, h = height;
  const pad = { top: 24, right: 16, bottom: 36, left: mobile ? 50 : 60 };
  const pW = w - pad.left - pad.right, pH = h - pad.top - pad.bottom;
  const toX = (i) => pad.left + (i / (data.length - 1)) * pW;
  const toY = (v) => pad.top + pH - ((v - minV) / range) * pH;
  const makePath = (key) => data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(" ");

  const totalM = data[data.length - 1].month || data.length - 1;
  const yStep = totalM > 240 ? 10 : 5;
  const yearTicks = [];
  for (let y = 0; y <= Math.floor(totalM / 12); y += yStep) yearTicks.push(y);
  const vTicks = [];
  const step = range > 5e5 ? 2e5 : range > 2e5 ? 1e5 : range > 5e4 ? 5e4 : range > 1e4 ? 1e4 : 5e3;
  for (let v = Math.ceil(minV / step) * step; v <= maxV; v += step) vTicks.push(v);

  const areaPath = `${makePath(keys[0])} L${toX(data.length - 1).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`;

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      {title && <div style={{ fontSize: 10, fontWeight: 600, color: C.textLight, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: fonts.sans }}>{title}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
        {vTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.left} x2={w - pad.right} y1={toY(v)} y2={toY(v)} stroke={C.borderLight} strokeWidth={1} />
            <text x={pad.left - 8} y={toY(v) + 4} fill={C.textFaint} fontSize={9} textAnchor="end" fontFamily={fonts.sans}>{formatY(v)}</text>
          </g>
        ))}
        {yearTicks.map((y) => (
          <text key={y} x={toX(y * 12)} y={h - 6} fill={C.textFaint} fontSize={9} textAnchor="middle" fontFamily={fonts.sans}>Yr {y}</text>
        ))}
        <path d={areaPath} fill={colors[0]} opacity={0.06} />
        {breakEvenMonth != null && breakEvenMonth < data.length && (
          <g>
            <line x1={toX(breakEvenMonth)} x2={toX(breakEvenMonth)} y1={pad.top} y2={pad.top + pH} stroke={C.accent} strokeWidth={1} strokeDasharray="4 3" />
            <text x={toX(breakEvenMonth)} y={pad.top - 6} fill={C.accent} fontSize={9} textAnchor="middle" fontFamily={fonts.sans} fontWeight={600}>
              {annotation || `Break-even: Yr ${(breakEvenMonth / 12).toFixed(1)}`}
            </text>
          </g>
        )}
        {keys.map((key, ki) => (
          <path key={key} d={makePath(key)} fill="none" stroke={colors[ki]} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {labels && labels.map((l, li) => (
          <g key={li}>
            <line x1={pad.left + 8 + li * (mobile ? 140 : 160)} x2={pad.left + 20 + li * (mobile ? 140 : 160)} y1={pad.top + 6} y2={pad.top + 6} stroke={colors[li]} strokeWidth={2} />
            <text x={pad.left + 24 + li * (mobile ? 140 : 160)} y={pad.top + 10} fill={C.textMid} fontSize={10} fontFamily={fonts.sans}>{l}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Sensitivity Table ──
function SensitivityTable({ propertyValue, totalUpfront, loanAmount, fixedRate, mortgageTerm, fixedPeriod, revertRate, monthlyRent, rentInflation, ongoingMonthly, houseGrowth, estateAgentPct, sellingConveyancing, epcCost, mobile }) {
  const rates = [1, 2, 3, 4, 5, 7];
  const horizons = mobile ? [3, 5, 10] : [3, 5, 7, 10, 15];

  function findBE(hpg, maxM) {
    const mhg = hpg / 100 / 12, fM = fixedPeriod * 12, mM = mortgageTerm * 12, mri = rentInflation / 100 / 12;
    const bR = fM < mM ? balCalc(loanAmount, fixedRate, mortgageTerm, fM) : 0;
    const rT = mortgageTerm - fixedPeriod;
    const p1 = pmtCalc(loanAmount, fixedRate, mortgageTerm);
    const p2 = rT > 0 ? pmtCalc(Math.max(0, bR), revertRate, rT) : 0;
    let cB = totalUpfront, cR = 0;
    for (let m = 1; m <= maxM; m++) {
      const pV = propertyValue * Math.pow(1 + mhg, m);
      let b = m <= fM && m <= mM ? balCalc(loanAmount, fixedRate, mortgageTerm, m) : m <= mM ? balCalc(Math.max(0, bR), revertRate, rT, m - fM) : 0;
      b = Math.max(0, b);
      const sC = pV * (estateAgentPct * 1.2 / 100) + sellingConveyancing + epcCost;
      cB += (m <= mM ? (m <= fM ? p1 : p2) : 0) + ongoingMonthly;
      cR += monthlyRent * Math.pow(1 + mri, m);
      if (cB - (pV - b - sC) < cR) return m;
    }
    return null;
  }

  return (
    <div style={{ marginTop: 24, overflowX: "auto" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: fonts.sans, marginBottom: 4 }}>
        Sensitivity — cost break-even
      </div>
      <div style={{ fontSize: 12, color: C.textLight, marginBottom: 16, fontFamily: fonts.serif, fontStyle: "italic" }}>
        Years until buying costs less than renting. — means never within that horizon.
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: mobile ? 300 : "auto" }}>
        <thead>
          <tr>
            <th style={{ padding: "8px 10px", fontSize: 10, fontFamily: fonts.sans, color: C.textLight, fontWeight: 600, textAlign: "left", borderBottom: `2px solid ${C.text}`, letterSpacing: "0.06em" }}>Growth</th>
            {horizons.map((h) => <th key={h} style={{ padding: "8px 10px", fontSize: 10, fontFamily: fonts.sans, color: C.textLight, fontWeight: 600, textAlign: "center", borderBottom: `2px solid ${C.text}`, letterSpacing: "0.06em" }}>{h}yr</th>)}
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r} style={{ background: Math.abs(r - houseGrowth) < 0.5 ? C.accentLight : "transparent" }}>
              <td style={{ padding: "9px 10px", fontSize: 13, fontFamily: fonts.serif, color: Math.abs(r - houseGrowth) < 0.5 ? C.accent : C.textMid, fontWeight: Math.abs(r - houseGrowth) < 0.5 ? 700 : 400, textAlign: "left", borderBottom: `1px solid ${C.borderLight}` }}>{r}%</td>
              {horizons.map((h) => {
                const be = findBE(r, h * 12);
                return <td key={h} style={{ padding: "9px 10px", fontSize: 13, fontFamily: fonts.serif, color: be != null ? C.green : C.red, fontWeight: be != null ? 600 : 400, textAlign: "center", borderBottom: `1px solid ${C.borderLight}` }}>{be != null ? `${(be / 12).toFixed(1)}y` : "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ══════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════
export default function App() {
  const mobile = useIsMobile();

  const [propertyValue, setPropertyValue] = useState(250000);
  const [depositMode, setDepositMode] = useState("pct");
  const [depositPct, setDepositPct] = useState(10);
  const [depositCash, setDepositCash] = useState(25000);
  const [mortgageTerm, setMortgageTerm] = useState(25);
  const [fixedRate, setFixedRate] = useState(4.5);
  const [fixedPeriod, setFixedPeriod] = useState(5);
  const [revertRate, setRevertRate] = useState(5.5);
  const [monthlyRent, setMonthlyRent] = useState(1000);
  const [rentInflation, setRentInflation] = useState(4);
  const [isFirstTimeBuyer, setIsFirstTimeBuyer] = useState(true);
  const [stampDutyOverride, setStampDutyOverride] = useState(null);
  const [solicitorFees, setSolicitorFees] = useState(1500);
  const [surveyFees, setSurveyFees] = useState(500);
  const [movingCosts, setMovingCosts] = useState(1000);
  const [maintenance, setMaintenance] = useState(100);
  const [serviceCharge, setServiceCharge] = useState(150);
  const [buildingsInsurance, setBuildingsInsurance] = useState(30);
  const [lifeInsurance, setLifeInsurance] = useState(25);
  const [boilerCover, setBoilerCover] = useState(15);
  const [groundRent, setGroundRent] = useState(0);
  const [estateAgentPct, setEstateAgentPct] = useState(1.5);
  const [sellingConveyancing, setSellingConveyancing] = useState(1200);
  const [epcCost, setEpcCost] = useState(80);
  const [houseGrowth, setHouseGrowth] = useState(3.5);
  const [investReturn, setInvestReturn] = useState(7);
  const [horizonYears, setHorizonYears] = useState(25);
  const [activeTab, setActiveTab] = useState("shortTerm");

  const deposit = depositMode === "pct" ? propertyValue * (depositPct / 100) : depositCash;
  const effectivePct = depositMode === "cash" ? (depositCash / propertyValue) * 100 : depositPct;
  const loanAmount = Math.max(0, propertyValue - deposit);
  const autoSD = calcStampDuty(propertyValue, isFirstTimeBuyer);
  const stampDuty = stampDutyOverride != null ? stampDutyOverride : autoSD;
  const totalUpfront = deposit + stampDuty + solicitorFees + surveyFees + movingCosts;
  const ongoingMonthly = maintenance + serviceCharge + buildingsInsurance + lifeInsurance + boilerCover + groundRent;

  const results = useMemo(() => {
    const months = horizonYears * 12, fM = fixedPeriod * 12, mM = mortgageTerm * 12;
    const p1 = pmtCalc(loanAmount, fixedRate, mortgageTerm);
    const bR = fM < mM ? balCalc(loanAmount, fixedRate, mortgageTerm, fM) : 0;
    const rT = Math.max(0, mortgageTerm - fixedPeriod);
    const p2 = rT > 0 ? pmtCalc(Math.max(0, bR), revertRate, rT) : 0;
    const mI = investReturn / 100 / 12, mH = houseGrowth / 100 / 12, mR = rentInflation / 100 / 12;
    let rW = totalUpfront, cB = totalUpfront, cR = 0, costBE = null, wBE = null;
    const wD = [], cD = [], mC = [];

    for (let m = 0; m <= months; m++) {
      const pV = propertyValue * Math.pow(1 + mH, m);
      let b = m === 0 ? loanAmount : m <= fM && m <= mM ? balCalc(loanAmount, fixedRate, mortgageTerm, m) : m <= mM ? balCalc(Math.max(0, bR), revertRate, rT, m - fM) : 0;
      b = Math.max(0, b);
      const sC = pV * (estateAgentPct * 1.2 / 100) + sellingConveyancing + epcCost;
      const nE = pV - b - sC;
      const mp = m > 0 && m <= mM ? (m <= fM ? p1 : p2) : 0;
      const bM = mp + ongoingMonthly;
      const rent = monthlyRent * Math.pow(1 + mR, m);
      if (m > 0) { cB += bM; cR += rent; rW *= (1 + mI); if (bM > rent) rW += bM - rent; }
      wD.push({ month: m, buyWealth: nE, rentWealth: rW });
      cD.push({ month: m, buyCost: cB - nE, rentCost: cR });
      if (m % 12 === 0) mC.push({ year: m / 12, buy: Math.round(bM), rent: Math.round(rent) });
      if (costBE === null && m > 0 && (cB - nE) < cR) costBE = m;
      if (wBE === null && m > 0 && nE > rW) wBE = m;
    }
    return { wD, cD, mC, costBE, wBE };
  }, [propertyValue, deposit, mortgageTerm, fixedRate, fixedPeriod, revertRate, monthlyRent, rentInflation, stampDuty, solicitorFees, surveyFees, movingCosts, maintenance, serviceCharge, buildingsInsurance, lifeInsurance, boilerCover, groundRent, estateAgentPct, sellingConveyancing, epcCost, houseGrowth, investReturn, horizonYears, loanAmount, totalUpfront, ongoingMonthly]);

  const fB = results.wD.length > 0 ? results.wD[results.wD.length - 1].buyWealth : 0;
  const fR = results.wD.length > 0 ? results.wD[results.wD.length - 1].rentWealth : 0;

  const grid = {
    display: "grid",
    gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(155px, 1fr))",
    gap: mobile ? "16px" : "20px 32px",
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: fonts.sans }}>
      <div style={{ maxWidth: 660, margin: "0 auto", padding: mobile ? "32px 16px" : "56px 24px" }}>

        {/* Masthead */}
        <div style={{ borderBottom: `2px solid ${C.text}`, paddingBottom: 20, marginBottom: mobile ? 32 : 48 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, marginBottom: 10 }}>
            Personal Finance Suite — Module 1
          </div>
          <h1 style={{ fontSize: mobile ? 32 : 44, fontFamily: fonts.serif, fontWeight: 400, margin: 0, color: C.text, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Buy vs Rent
          </h1>
          <p style={{ fontSize: mobile ? 14 : 16, color: C.textMid, margin: "10px 0 0 0", fontFamily: fonts.serif, fontStyle: "italic", lineHeight: 1.5 }}>
            Model whether purchasing makes more financial sense than renting — short-term and long-term.
          </p>
        </div>

        {/* ═══ INPUTS ═══ */}
        <Section title="Property & Mortgage">
          <div style={grid}>
            <Field label="Property Value" prefix="£" value={propertyValue} onChange={setPropertyValue} tip="The purchase price of the property you're considering." />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <label style={{ fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase" }}>Deposit</label>
                <Tip text="Toggle between a percentage or fixed cash amount. Changing one auto-updates the other." />
              </div>
              <div style={{ display: "flex", gap: 0, marginBottom: 4 }}>
                {["pct", "cash"].map((mode) => (
                  <button key={mode} onClick={() => {
                    if (mode === "pct") { setDepositMode("pct"); setDepositPct(Math.round((depositCash / propertyValue) * 100)); }
                    else { setDepositMode("cash"); setDepositCash(Math.round(propertyValue * depositPct / 100)); }
                  }} style={{
                    padding: "6px 14px", border: `1.5px solid ${depositMode === mode ? C.text : C.border}`,
                    borderRadius: 0, borderRight: mode === "pct" ? "none" : undefined,
                    background: depositMode === mode ? C.text : "transparent",
                    color: depositMode === mode ? C.bg : C.textMid,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
                  }}>{mode === "pct" ? "%" : "£"}</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", borderBottom: `1.5px solid ${C.border}`, padding: "8px 0" }}>
                {depositMode === "cash" && <span style={{ color: C.textLight, fontSize: 16, marginRight: 6, fontFamily: fonts.serif }}>£</span>}
                <input type="number"
                  value={depositMode === "pct" ? depositPct : depositCash}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : Number(e.target.value);
                    if (depositMode === "pct") { setDepositPct(v); setDepositCash(Math.round(propertyValue * v / 100)); }
                    else { setDepositCash(v); setDepositPct(propertyValue > 0 ? Math.round((v / propertyValue) * 100) : 0); }
                  }}
                  style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 18, fontFamily: fonts.serif, width: "100%", fontWeight: 400 }}
                />
                {depositMode === "pct" && <span style={{ color: C.textLight, fontSize: 12, marginLeft: 6, fontFamily: fonts.sans }}>%</span>}
              </div>
              <span style={{ fontSize: 11, color: C.textLight, fontFamily: fonts.serif, fontStyle: "italic" }}>
                {depositMode === "pct" ? fmt(deposit) : `${effectivePct.toFixed(1)}%`}
              </span>
            </div>
            <Field label="Mortgage Term" suffix="yrs" value={mortgageTerm} onChange={setMortgageTerm} tip="Total mortgage length. UK standard 25 years, 30–35 increasingly common." />
            <Field label="Fixed Rate" suffix="%" value={fixedRate} onChange={setFixedRate} tip="Locked-in rate during the initial fixed period." />
            <Field label="Fixed Period" suffix="yrs" value={fixedPeriod} onChange={setFixedPeriod} tip="How long the fixed rate lasts (typically 2 or 5 years)." />
            <Field label="Revert Rate" suffix="%" value={revertRate} onChange={setRevertRate} tip="Lender's SVR after the fixed period. Models worst case — you'd normally remortgage." />
          </div>
          <SummaryBar>Loan: {fmt(loanAmount)} · Deposit: {fmt(deposit)} ({effectivePct.toFixed(1)}%) · LTV: {(100 - effectivePct).toFixed(1)}%</SummaryBar>
        </Section>

        <Section title="Rent Comparison">
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: mobile ? "16px" : "20px 32px" }}>
            <Field label="Monthly Rent" prefix="£" value={monthlyRent} onChange={setMonthlyRent} tip="Monthly rent for a comparable property." />
            <Field label="Rent Inflation" suffix="% p.a." value={rentInflation} onChange={setRentInflation} tip="Annual rent increase. UK cities: 4–8% recently, long-term avg 2–3%." />
          </div>
        </Section>

        <Section title="Upfront Buying Costs" defaultOpen={false}>
          <div style={{ marginBottom: 16 }}>
            <Toggle label="First-time buyer" value={isFirstTimeBuyer} onChange={setIsFirstTimeBuyer} tip="FTBs pay no stamp duty up to £425k, reduced rates up to £625k." />
          </div>
          <div style={grid}>
            <Field label={`Stamp Duty ${stampDutyOverride == null ? "(auto)" : "(manual)"}`} prefix="£" value={stampDutyOverride != null ? stampDutyOverride : Math.round(autoSD)} onChange={(v) => setStampDutyOverride(v)} tip="Auto-calculated. Edit to override if thresholds changed." />
            <Field label="Solicitor Fees" prefix="£" value={solicitorFees} onChange={setSolicitorFees} tip="Conveyancing. Usually £1,000–£2,000." />
            <Field label="Survey" prefix="£" value={surveyFees} onChange={setSurveyFees} tip="Homebuyer's report. Level 2: £400–£700." />
            <Field label="Moving Costs" prefix="£" value={movingCosts} onChange={setMovingCosts} tip="Removal van, packing, everything else." />
          </div>
          {stampDutyOverride != null && (
            <div onClick={() => setStampDutyOverride(null)} style={{ marginTop: 10, fontSize: 12, color: C.accent, cursor: "pointer", fontFamily: fonts.sans, fontWeight: 600 }}>↩ Reset to auto ({fmt(autoSD)})</div>
          )}
          <SummaryBar>Total upfront: {fmt(totalUpfront)}</SummaryBar>
        </Section>

        <Section title="Owner-Only Monthly Costs" defaultOpen={false}>
          <p style={{ fontSize: 13, color: C.textMid, marginBottom: 20, fontFamily: fonts.serif, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 20px 0" }}>
            Costs only homeowners pay. Renters don't pay these directly.
          </p>
          <div style={grid}>
            <Field label="Maintenance" prefix="£" value={maintenance} onChange={setMaintenance} tip="Monthly repair budget. ~1% of property value per year." />
            <Field label="Service Charge" prefix="£" value={serviceCharge} onChange={setServiceCharge} tip="For flats: communal areas, management. £0 for freehold." />
            <Field label="Buildings Insurance" prefix="£" value={buildingsInsurance} onChange={setBuildingsInsurance} tip="Covers structure. Required by lender. £15–£40/mo." />
            <Field label="Life / Mortgage Protection" prefix="£" value={lifeInsurance} onChange={setLifeInsurance} tip="Pays off mortgage if you die or can't work." />
            <Field label="Boiler / Home Cover" prefix="£" value={boilerCover} onChange={setBoilerCover} tip="Emergency cover. Optional, £10–£25/mo." />
            <Field label="Ground Rent" prefix="£" value={groundRent} onChange={setGroundRent} tip="Leasehold only. New builds: £0 under 2022 law." />
          </div>
          <SummaryBar>Monthly owner costs: {fmt(ongoingMonthly)}</SummaryBar>
        </Section>

        <Section title="Selling Costs" defaultOpen={false}>
          <p style={{ fontSize: 13, color: C.textMid, marginBottom: 20, fontFamily: fonts.serif, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 20px 0" }}>
            Deducted from equity. Without these, buying looks artificially better on short horizons.
          </p>
          <div style={grid}>
            <Field label="Estate Agent Fee" suffix="% + VAT" value={estateAgentPct} onChange={setEstateAgentPct} tip="High-street: 1–1.5% + 20% VAT." />
            <Field label="Selling Conveyancing" prefix="£" value={sellingConveyancing} onChange={setSellingConveyancing} tip="Legal fees for sale. £1,000–£1,500." />
            <Field label="EPC Certificate" prefix="£" value={epcCost} onChange={setEpcCost} tip="Required before listing. £60–£120." />
          </div>
          <SummaryBar>Selling cost at current value: ~{fmt(Math.round(propertyValue * (estateAgentPct * 1.2 / 100) + sellingConveyancing + epcCost))}</SummaryBar>
        </Section>

        <Section title="Assumptions">
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", marginBottom: 12, fontFamily: fonts.sans }}>
              House Price Growth <Tip text="Annual property value increase. UK long-term avg ~3.5%." />
            </label>
            <PresetSelector presets={hpPresets} value={houseGrowth} onChange={setHouseGrowth} mobile={mobile} />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", marginBottom: 12, fontFamily: fonts.sans }}>
              Investment Return <Tip text="Opportunity cost — what your deposit would earn invested instead." />
            </label>
            <PresetSelector presets={invPresets} value={investReturn} onChange={setInvestReturn} mobile={mobile} />
          </div>
          <div style={{ maxWidth: 200 }}>
            <Field label="Time Horizon" suffix="yrs" value={horizonYears} onChange={setHorizonYears} tip="3–5 years short-term, 15–25 long-term." />
          </div>
        </Section>

        {/* ═══ RESULTS ═══ */}
        <div style={{ borderTop: `2px solid ${C.text}`, paddingTop: 32, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 28, flexWrap: "wrap" }}>
            {[
              { key: "shortTerm", label: mobile ? "Short-term" : "Short-term: Should I buy?" },
              { key: "longTerm", label: mobile ? "Long-term" : "Long-term: Wealth" },
            ].map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                padding: mobile ? "10px 16px" : "10px 22px",
                border: `1.5px solid ${activeTab === t.key ? C.text : C.border}`,
                borderRadius: 0, background: activeTab === t.key ? C.text : "transparent",
                color: activeTab === t.key ? C.bg : C.textMid,
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
                letterSpacing: "0.02em", transition: "all 0.15s",
                flex: mobile ? 1 : "none",
              }}>{t.label}</button>
            ))}
          </div>

          {activeTab === "shortTerm" && (
            <div>
              <div style={{
                borderLeft: `4px solid ${results.costBE != null ? C.green : C.red}`,
                background: results.costBE != null ? C.greenBg : C.redBg,
                padding: mobile ? "16px 16px 16px 20px" : "20px 24px 20px 28px",
                marginBottom: 28,
              }}>
                <div style={{ fontSize: mobile ? 18 : 22, fontFamily: fonts.serif, fontWeight: 400, color: results.costBE != null ? C.green : C.red, marginBottom: 8 }}>
                  {results.costBE != null
                    ? `Buying breaks even after ${(results.costBE / 12).toFixed(1)} years`
                    : `Renting costs less over ${horizonYears} years`}
                </div>
                <p style={{ fontSize: 14, fontFamily: fonts.serif, color: C.textMid, lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
                  {results.costBE != null
                    ? `Sell before year ${(results.costBE / 12).toFixed(1)} and you'll have spent more buying than renting. After that point, buying costs less overall.`
                    : `Over ${horizonYears} years, total buying costs exceed cumulative rent — even accounting for the equity you'd build.`}
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: mobile ? 20 : 24, marginBottom: 24 }}>
                <Stat mobile={mobile} label="Cost Break-Even" value={results.costBE != null ? `${(results.costBE / 12).toFixed(1)} yrs` : "N/A"} sub="When total buy cost < total rent" />
                <Stat mobile={mobile} label="Monthly: Buy (Yr 1)" value={fmt(Math.round(pmtCalc(loanAmount, fixedRate, mortgageTerm) + ongoingMonthly))} sub={`Mortgage + ${fmt(ongoingMonthly)} ongoing`} />
                <Stat mobile={mobile} label="Monthly: Rent (Yr 1)" value={fmt(monthlyRent)} sub={`Rising ${rentInflation}% p.a.`} />
              </div>

              {results.mC.length > 1 && (
                <Chart mobile={mobile}
                  data={results.mC.map((d) => ({ month: d.year * 12, buy: d.buy, rent: d.rent }))}
                  keys={["buy", "rent"]} colors={[C.green, C.red]}
                  labels={["Monthly buy cost", "Monthly rent"]}
                  title="Monthly Outgoing — Buy vs Rent"
                  formatY={(v) => v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`}
                />
              )}

              <Chart mobile={mobile} data={results.cD} keys={["buyCost", "rentCost"]} colors={[C.green, C.red]}
                labels={["Net buy cost", "Cumulative rent"]}
                title="Cumulative Net Cost"
                breakEvenMonth={results.costBE}
                annotation={results.costBE ? `Break-even: Yr ${(results.costBE / 12).toFixed(1)}` : undefined}
              />

              <SensitivityTable mobile={mobile}
                propertyValue={propertyValue} totalUpfront={totalUpfront}
                loanAmount={loanAmount} fixedRate={fixedRate} mortgageTerm={mortgageTerm}
                fixedPeriod={fixedPeriod} revertRate={revertRate} monthlyRent={monthlyRent}
                rentInflation={rentInflation} ongoingMonthly={ongoingMonthly} houseGrowth={houseGrowth}
                estateAgentPct={estateAgentPct} sellingConveyancing={sellingConveyancing} epcCost={epcCost}
              />
            </div>
          )}

          {activeTab === "longTerm" && (
            <div>
              {(() => {
                const d = fB - fR, bw = d > 0;
                return (
                  <div style={{
                    borderLeft: `4px solid ${bw ? C.green : C.red}`,
                    background: bw ? C.greenBg : C.redBg,
                    padding: mobile ? "16px 16px 16px 20px" : "20px 24px 20px 28px",
                    marginBottom: 28,
                  }}>
                    <div style={{ fontSize: mobile ? 18 : 22, fontFamily: fonts.serif, fontWeight: 400, color: bw ? C.green : C.red, marginBottom: 8 }}>
                      {bw ? "Buying" : "Renting + investing"} builds more wealth over {horizonYears} years
                    </div>
                    <p style={{ fontSize: 14, fontFamily: fonts.serif, color: C.textMid, lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
                      {bw
                        ? `Buying leaves you ${fmt(Math.abs(d))} wealthier. Property equity minus selling costs outgrows a ${investReturn}% portfolio.${results.wBE ? ` Crossover at year ${(results.wBE / 12).toFixed(1)}.` : ""}`
                        : `Renting and investing at ${investReturn}% leaves you ${fmt(Math.abs(d))} ahead.${results.wBE ? ` Buying catches up at year ${(results.wBE / 12).toFixed(1)}.` : " Buying doesn't catch up."}`}
                    </p>
                  </div>
                );
              })()}

              <div style={{ display: "flex", flexWrap: "wrap", gap: mobile ? 20 : 24, marginBottom: 24 }}>
                <Stat mobile={mobile} label="Buy: Net Equity" value={fmt(fB)} sub="After mortgage & selling costs" />
                <Stat mobile={mobile} label="Rent: Portfolio" value={fmt(fR)} sub={`Deposit + savings at ${investReturn}%`} />
                <Stat mobile={mobile} label="Wealth Break-Even" value={results.wBE != null ? `${(results.wBE / 12).toFixed(1)} yrs` : "N/A"} sub={results.wBE != null ? `Month ${results.wBE}` : "Not within horizon"} />
              </div>

              <Chart mobile={mobile} data={results.wD} keys={["buyWealth", "rentWealth"]}
                colors={[C.green, C.red]} labels={["Buy (net equity)", "Rent + invest"]}
                title="Wealth Over Time" breakEvenMonth={results.wBE}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 48, borderTop: `2px solid ${C.text}`, paddingTop: 16,
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 10, color: C.textLight, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>Personal Finance Suite</span>
          <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>Module 1</span>
        </div>
      </div>
    </div>
  );
}
