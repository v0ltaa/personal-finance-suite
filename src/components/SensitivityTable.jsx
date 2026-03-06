import { C, fonts } from "../lib/tokens";
import { pmtCalc, balCalc } from "../lib/calc";

export default function SensitivityTable({ propertyValue, totalUpfront, loanAmount, fixedRate, mortgageTerm, fixedPeriod, revertRate, monthlyRent, rentInflation, ongoingMonthly, houseGrowth, estateAgentPct, sellingConveyancing, epcCost, mobile }) {
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
