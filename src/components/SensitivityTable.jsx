import { pmtCalc, balCalc } from "../lib/calc";
import { cn } from "../lib/utils";

export default function SensitivityTable({
  propertyValue, totalUpfront, loanAmount, fixedRate, mortgageTerm,
  fixedPeriod, revertRate, monthlyRent, rentInflation, ongoingMonthly,
  houseGrowth, estateAgentPct, sellingConveyancing, epcCost, mobile,
}) {
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
    <div className="mt-6 overflow-x-auto">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        Sensitivity — cost break-even
      </p>
      <p className="text-xs font-serif italic text-muted-foreground mb-4">
        Years until buying costs less than renting. — means never within that horizon.
      </p>
      <table className="w-full border-collapse" style={{ minWidth: mobile ? 300 : undefined }}>
        <thead>
          <tr>
            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-left border-b-2 border-foreground">
              Growth
            </th>
            {horizons.map((h) => (
              <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center border-b-2 border-foreground">
                {h}yr
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => {
            const isActive = Math.abs(r - houseGrowth) < 0.5;
            return (
              <tr key={r} className={cn(isActive && "bg-brand/8")}>
                <td className={cn(
                  "px-3 py-2.5 text-sm font-serif border-b border-border/60",
                  isActive ? "text-brand font-bold" : "text-muted-foreground"
                )}>
                  {r}%
                </td>
                {horizons.map((h) => {
                  const be = findBE(r, h * 12);
                  return (
                    <td key={h} className={cn(
                      "px-3 py-2.5 text-sm font-serif text-center border-b border-border/60",
                      be != null ? "text-success font-semibold" : "text-danger"
                    )}>
                      {be != null ? `${(be / 12).toFixed(1)}y` : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
