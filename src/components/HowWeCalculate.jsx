import { useState } from "react";
import { fmt } from "../lib/tokens";
import { pmtCalc } from "../lib/calc";
import { cn } from "../lib/utils";

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-1 text-left cursor-pointer select-none group"
      >
        <span className="text-[13px] font-semibold text-foreground tracking-wide">
          {title}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "text-muted-foreground transition-transform duration-200 shrink-0",
            open ? "rotate-180" : ""
          )}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="pb-4 px-1 animate-fade-in text-[13px] text-foreground/80 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

function Formula({ children }) {
  return (
    <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 my-3 font-mono text-[12px] leading-relaxed overflow-x-auto">
      {children}
    </div>
  );
}

function Var({ label, value }) {
  return (
    <span>
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="text-foreground font-semibold">{value}</span>
    </span>
  );
}

function BandTable({ bands, highlight }) {
  return (
    <table className="w-full text-[12px] my-3 border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-1.5 pr-4 text-muted-foreground font-semibold">Band</th>
          <th className="text-right py-1.5 pr-4 text-muted-foreground font-semibold">Rate</th>
          {highlight && <th className="text-right py-1.5 text-muted-foreground font-semibold">Tax</th>}
        </tr>
      </thead>
      <tbody>
        {bands.map((b, i) => (
          <tr key={i} className="border-b border-border/50 last:border-b-0">
            <td className="py-1.5 pr-4">{b.band}</td>
            <td className="text-right py-1.5 pr-4">{b.rate}</td>
            {highlight && <td className="text-right py-1.5 font-semibold">{b.tax}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function buildStampDutyBreakdown(price, ftb) {
  if (ftb) {
    if (price <= 425000) {
      return {
        bands: [
          { band: `£0 – ${fmt(Math.min(price, 425000))}`, rate: "0%", tax: fmt(0) },
        ],
        total: 0,
      };
    }
    if (price <= 625000) {
      const tax = (price - 425000) * 0.05;
      return {
        bands: [
          { band: "£0 – £425,000", rate: "0%", tax: fmt(0) },
          { band: `£425,001 – ${fmt(price)}`, rate: "5%", tax: fmt(tax) },
        ],
        total: tax,
      };
    }
    // FTB relief doesn't apply above £625k — fall through to standard
  }

  const stdBands = [
    { l: 250000, r: 0, label: "£0 – £250,000" },
    { l: 925000, r: 0.05, label: "£250,001 – £925,000" },
    { l: 1500000, r: 0.1, label: "£925,001 – £1,500,000" },
    { l: Infinity, r: 0.12, label: "Over £1,500,000" },
  ];
  let prev = 0;
  const rows = [];
  let total = 0;
  for (const b of stdBands) {
    if (price <= prev) break;
    const taxable = Math.min(price, b.l) - prev;
    const tax = taxable > 0 ? taxable * b.r : 0;
    total += tax;
    const bandLabel = prev === 0
      ? `£0 – ${price < b.l ? fmt(price) : fmt(b.l)}`
      : `${fmt(prev + 1)} – ${price < b.l ? fmt(price) : fmt(b.l)}`;
    rows.push({
      band: price <= b.l && b.l !== Infinity ? bandLabel : (b.l === Infinity ? `${fmt(prev + 1)} – ${fmt(price)}` : bandLabel),
      rate: `${(b.r * 100).toFixed(0)}%`,
      tax: fmt(tax),
    });
    prev = b.l;
  }
  return { bands: rows, total };
}

export default function HowWeCalculate({ config, results, inflationRate, inflationAdjusted }) {
  if (!config || !results) return null;

  const {
    propertyValue, deposit, mortgageTerm, fixedRate, fixedPeriod, revertRate,
    isFirstTimeBuyer, stampDuty, stampDutyOverride,
    solicitorFees, surveyFees, movingCosts,
    estateAgentPct, sellingConveyancing, epcCost,
    houseGrowth, investReturn, horizonYears,
    monthlyRent, rentInflation, costInflation = 0,
  } = config;

  const loanAmount = Math.max(0, propertyValue - deposit);
  const r = fixedRate / 100 / 12;
  const n = mortgageTerm * 12;
  const monthlyPayment = pmtCalc(loanAmount, fixedRate, mortgageTerm);
  const sdBreakdown = buildStampDutyBreakdown(propertyValue, isFirstTimeBuyer);

  // Remortgage values
  const fM = fixedPeriod * 12;
  const pow = Math.pow(1 + r, fM);
  const balAtRevert = r > 0
    ? loanAmount * pow - monthlyPayment * ((pow - 1) / r)
    : loanAmount - monthlyPayment * fM;
  const remainingTerm = Math.max(0, mortgageTerm - fixedPeriod);
  const revertPayment = remainingTerm > 0 ? pmtCalc(Math.max(0, balAtRevert), revertRate, remainingTerm) : 0;

  // Net equity values
  const totalUpfront = deposit + stampDuty + solicitorFees + surveyFees + movingCosts;
  const months = horizonYears * 12;
  const futureValue = propertyValue * Math.pow(1 + houseGrowth / 100 / 12, months);
  const sellingCosts = futureValue * (estateAgentPct * 1.2 / 100) + sellingConveyancing + epcCost;
  const last = results.wD?.length > 0 ? results.wD[results.wD.length - 1] : null;
  const finalEquity = last?.buyEquity ?? 0;
  const finalSurplus = last?.buySurplus ?? 0;
  const finalBal = last ? Math.max(0, futureValue - finalEquity - sellingCosts) : 0;
  const fB = last?.buyWealth ?? 0;
  const fR = last?.rentWealth ?? 0;

  // Ongoing cost inflation
  const ongoingMonthly = results.ongoingMonthly;
  const inflatedOngoingFinal = ongoingMonthly * Math.pow(1 + costInflation / 100 / 12, months);

  // Inflation
  const finalDiscount = inflationAdjusted && inflationRate ? Math.pow(1 + inflationRate / 100, horizonYears) : 1;
  const fBAdj = Math.round(fB / finalDiscount);
  const fRAdj = Math.round(fR / finalDiscount);

  return (
    <div className="mt-8 border border-border bg-card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
          How we calculate
        </span>
      </div>

      <div className="px-5">
        {/* 1. Monthly payment */}
        <Accordion title="Monthly Mortgage Payment">
          <p className="text-muted-foreground mt-0 mb-2">
            We use the standard annuity formula to calculate your fixed monthly payment:
          </p>
          <Formula>
            <div className="text-center">
              <span className="text-brand font-semibold">M</span> = P &times;{" "}
              <span className="inline-block align-middle">
                r(1 + r)<sup>n</sup>
              </span>{" "}
              &frasl;{" "}
              <span className="inline-block align-middle">
                [(1 + r)<sup>n</sup> &minus; 1]
              </span>
            </div>
          </Formula>
          <div className="space-y-1 text-[12px] mb-3">
            <div><Var label="P (loan amount):" value={fmt(loanAmount)} /> <span className="text-muted-foreground">({fmt(propertyValue)} − {fmt(deposit)} deposit)</span></div>
            <div><Var label="r (monthly rate):" value={`${fixedRate}% ÷ 12 = ${(r * 100).toFixed(4)}%`} /></div>
            <div><Var label="n (total payments):" value={`${mortgageTerm} × 12 = ${n}`} /></div>
          </div>
          <Formula>
            <div className="text-center">
              <span className="text-brand font-semibold">M</span> ={" "}
              {fmt(loanAmount)} &times;{" "}
              {(r).toFixed(6)} &times; (1 + {(r).toFixed(6)})<sup>{n}</sup>{" "}
              &frasl;{" "}
              [(1 + {(r).toFixed(6)})<sup>{n}</sup> &minus; 1]
            </div>
            <div className="text-center mt-2 text-brand font-semibold text-[14px]">
              = {fmt(Math.round(monthlyPayment))}/mo
            </div>
          </Formula>
          <p className="text-muted-foreground text-[12px] mb-0">
            This is your payment during the {fixedPeriod}-year fixed period at {fixedRate}%.
            {revertRate > 0 && revertRate !== fixedRate && remainingTerm > 0 && (
              <> After that, your rate reverts to {revertRate}% — see "Remortgage" below.</>
            )}
          </p>
        </Accordion>

        {/* 2. Stamp duty */}
        <Accordion title="Stamp Duty (SDLT)">
          <p className="text-muted-foreground mt-0 mb-2">
            UK Stamp Duty Land Tax applies in bands — you only pay the rate on the portion within each band.
          </p>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
            Standard SDLT Bands
          </div>
          <BandTable
            bands={[
              { band: "£0 – £250,000", rate: "0%" },
              { band: "£250,001 – £925,000", rate: "5%" },
              { band: "£925,001 – £1,500,000", rate: "10%" },
              { band: "Over £1,500,000", rate: "12%" },
            ]}
          />

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            First-Time Buyer Relief
          </div>
          <BandTable
            bands={[
              { band: "£0 – £425,000", rate: "0%" },
              { band: "£425,001 – £625,000", rate: "5%" },
              { band: "Over £625,000", rate: "No relief (standard rates apply)" },
            ]}
          />

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            Your Calculation ({isFirstTimeBuyer ? "First-Time Buyer" : "Standard"}) — {fmt(propertyValue)}
          </div>
          <BandTable bands={sdBreakdown.bands} highlight />

          <Formula>
            <div className="text-center">
              <span className="text-brand font-semibold">Total Stamp Duty</span> ={" "}
              <span className="font-semibold">{fmt(stampDuty)}</span>
            </div>
          </Formula>
        </Accordion>

        {/* 3. Remortgage */}
        {revertRate > 0 && revertRate !== fixedRate && remainingTerm > 0 && (
          <Accordion title="Remortgage at End of Fixed Period">
            <p className="text-muted-foreground mt-0 mb-2">
              At the end of your {fixedPeriod}-year fixed period, we recalculate your remaining
              balance and start a new amortisation schedule at the revert rate.
            </p>
            <div className="space-y-1 text-[12px] mb-3">
              <div><Var label={`Balance after ${fixedPeriod} years:`} value={fmt(Math.round(Math.max(0, balAtRevert)))} /></div>
              <div><Var label="New rate:" value={`${revertRate}%`} /></div>
              <div><Var label="Remaining term:" value={`${remainingTerm} years`} /></div>
            </div>
            <Formula>
              <div className="text-center">
                <span className="text-brand font-semibold">New payment</span> ={" "}
                <span className="font-semibold">{fmt(Math.round(revertPayment))}/mo</span>
                <span className="text-muted-foreground ml-2">
                  ({revertPayment > monthlyPayment ? "+" : ""}{fmt(Math.round(revertPayment - monthlyPayment))}/mo vs fixed period)
                </span>
              </div>
            </Formula>
            <p className="text-muted-foreground text-[12px] mb-0">
              In practice, most buyers remortgage to a new fixed deal before the revert rate kicks in.
              We use the revert rate as a conservative assumption.
            </p>
          </Accordion>
        )}

        {/* 4. Cost Inflation & Surplus Investing */}
        <Accordion title="Cost Inflation & Surplus Investing">
          <p className="text-muted-foreground mt-0 mb-2">
            Two refinements make the model more realistic over long horizons:
          </p>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            1. Ongoing costs inflate
          </div>
          <p className="text-muted-foreground text-[12px] mb-2">
            A homeowner's ongoing costs (maintenance, service charge, insurance, boiler cover)
            don't stay flat for {horizonYears} years — they track general inflation. We inflate
            them at {costInflation}% p.a. (your assumed CPI rate).
          </p>
          <div className="space-y-1 text-[12px] mb-3">
            <div><Var label="Year 1 ongoing:" value={`${fmt(Math.round(ongoingMonthly))}/mo`} /></div>
            <div><Var label={`Year ${horizonYears} ongoing:`} value={`${fmt(Math.round(inflatedOngoingFinal))}/mo`} /></div>
          </div>
          <p className="text-muted-foreground text-[12px] mb-2">
            Mortgage payments are not inflated — they're fixed by contract. But ongoing costs
            creep up, which affects the model in three ways:
          </p>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            How inflated costs flow through
          </div>
          {(() => {
            // Pull actual values from the model — use mC[1] (year 1) not mC[0] (year 0, pre-mortgage)
            const lastYear = results.mC?.[results.mC.length - 1];
            const yr1 = results.mC?.length > 1 ? results.mC[1] : results.mC?.[0];
            const buyFinalFromModel = lastYear?.buy ?? 0;
            const rentFinalFromModel = lastYear?.rent ?? 0;
            const buyYr1 = yr1?.buy ?? 0;
            const rentYr1 = yr1?.rent ?? monthlyRent;
            const surplusFromModel = Math.max(0, rentFinalFromModel - buyFinalFromModel);
            const surplusWithoutInflation = Math.max(0, rentFinalFromModel - (buyFinalFromModel - Math.round(inflatedOngoingFinal) + Math.round(ongoingMonthly)));
            const surplusDiff = surplusWithoutInflation - surplusFromModel;
            const yr1Diff = buyYr1 - rentYr1;
            return (
              <>
                <div className="space-y-2 text-[12px] mb-3 pl-3 border-l-2 border-brand/20">
                  <div>
                    <span className="font-semibold text-foreground">1. Higher cumulative costs:</span>{" "}
                    <span className="text-muted-foreground">
                      Year 1 total buy cost is {fmt(buyYr1)}/mo (mortgage + ongoing).
                      By year {horizonYears}, it's {fmt(buyFinalFromModel)}/mo — the mortgage stays
                      fixed but ongoing costs have risen
                      from {fmt(Math.round(ongoingMonthly))} to {fmt(Math.round(inflatedOngoingFinal))}/mo.
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">2. Renter gets more surplus early on:</span>{" "}
                    <span className="text-muted-foreground">
                      Year 1 rent is {fmt(rentYr1)}/mo vs buying
                      at {fmt(buyYr1)}/mo.
                      {yr1Diff > 0
                        ? <> The renter's portfolio receives the {fmt(yr1Diff)}/mo difference — compounded over years, this adds up.</>
                        : <> Buying is already cheaper from year 1, so the renter has no surplus to invest early on.</>
                      }
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">3. Buyer's late-game surplus shrinks:</span>{" "}
                    <span className="text-muted-foreground">
                      At year {horizonYears}, rent is {fmt(rentFinalFromModel)}/mo and buy
                      costs are {fmt(buyFinalFromModel)}/mo
                      {surplusFromModel > 0 ? <> — buyer's investable surplus is {fmt(surplusFromModel)}/mo</> : null}.
                      {surplusDiff > 0 && <> Without cost inflation, that surplus would be {fmt(surplusWithoutInflation)}/mo
                      — that's {fmt(surplusDiff)}/mo less being invested because ongoing costs have risen.</>}
                    </span>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            2. Surplus investing is symmetric
          </div>
          <p className="text-muted-foreground text-[12px] mb-2">
            As rent inflates past the mortgage payment, the buyer has spare cash each month.
            We invest that surplus at the same {investReturn}% rate used for the renter's portfolio.
            This is the mirror of the renter investing their surplus in early years.
          </p>
          <Formula>
            <div className="text-center text-[11px]">
              <div className="mb-1"><span className="text-muted-foreground">Early years (buy &gt; rent):</span> renter invests the difference</div>
              <div><span className="text-muted-foreground">Later years (rent &gt; buy):</span> buyer invests the difference</div>
            </div>
          </Formula>
          <p className="text-muted-foreground text-[12px] mb-0">
            Without the surplus investing, the model would ignore the buyer's growing monthly advantage.
            Without the cost inflation, it would overstate that advantage. Together, they give a
            more balanced picture over a {horizonYears}-year horizon.
          </p>
        </Accordion>

        {/* 5. Buy: Total Wealth */}
        <Accordion title="Buy: Total Wealth">
          <p className="text-muted-foreground mt-0 mb-2">
            A buyer's total wealth has two parts: property equity (what you'd walk away with if you sold)
            plus any invested surplus from months where your costs were lower than rent.
          </p>
          <Formula>
            <div className="text-center">
              <span className="text-brand font-semibold">Buy Wealth</span> = Net Equity + Invested Surplus
            </div>
            <div className="text-center mt-1 text-[11px] text-muted-foreground">
              where Net Equity = Property Value &minus; Mortgage Balance &minus; Selling Costs
            </div>
          </Formula>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            Property Value at Year {horizonYears}
          </div>
          <div className="space-y-1 text-[12px] mb-3">
            <div><Var label="Starting value:" value={fmt(propertyValue)} /></div>
            <div><Var label="Annual growth:" value={`${houseGrowth}%`} /> <span className="text-muted-foreground">(compounded monthly)</span></div>
          </div>
          <Formula>
            <div className="text-center">
              {fmt(propertyValue)} &times; (1 + {houseGrowth}% &frasl; 12)<sup>{months}</sup> ={" "}
              <span className="font-semibold">{fmt(Math.round(futureValue))}</span>
            </div>
          </Formula>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            Mortgage Balance at Year {horizonYears}
          </div>
          <p className="text-muted-foreground text-[12px] mb-2">
            We run a standard amortisation loop month by month. Each iteration does two things:
          </p>
          <div className="space-y-2 text-[12px] mb-3 pl-3 border-l-2 border-brand/20">
            <div>
              <span className="font-semibold text-foreground">1. Interest:</span>{" "}
              <span className="text-muted-foreground">remaining balance × (annual rate ÷ 12)</span>
            </div>
            <div>
              <span className="font-semibold text-foreground">2. Principal repaid:</span>{" "}
              <span className="text-muted-foreground">monthly payment − interest, which reduces the balance</span>
            </div>
          </div>
          <p className="text-muted-foreground text-[12px] mb-2">
            Because interest is calculated on the remaining balance, early payments are eaten
            almost entirely by interest — leaving little to reduce principal. As the balance
            shrinks, more of each payment chips away at principal. This is the classic
            slow-start equity curve.
          </p>
          {revertRate > 0 && revertRate !== fixedRate && remainingTerm > 0 && (
            <p className="text-muted-foreground text-[12px] mb-2">
              At month {fM} (end of the {fixedPeriod}-year fixed period), the loop switches
              to the revert rate — same process, just a different monthly payment recalculated
              against the balance at that point.
            </p>
          )}
          <p className="text-muted-foreground text-[12px] mb-2">
            The balance is tracked step by step from day one — no estimation or interpolation.
          </p>
          <Formula>
            <div className="text-center">
              <span className="text-muted-foreground">Balance at year {horizonYears}:</span>{" "}
              <span className="font-semibold">{fmt(Math.round(finalBal))}</span>
              {finalBal === 0 && <span className="text-muted-foreground ml-2">(fully repaid)</span>}
            </div>
          </Formula>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            Selling Costs
          </div>
          <div className="space-y-1 text-[12px] mb-3">
            <div><Var label="Estate agent:" value={`${estateAgentPct}% + VAT`} /> <span className="text-muted-foreground">= {fmt(Math.round(futureValue * estateAgentPct * 1.2 / 100))} on {fmt(Math.round(futureValue))}</span></div>
            <div><Var label="Conveyancing:" value={fmt(sellingConveyancing)} /></div>
            <div><Var label="EPC:" value={fmt(epcCost)} /></div>
          </div>
          <Formula>
            <div className="text-center">
              <span className="text-muted-foreground">Total selling costs:</span>{" "}
              <span className="font-semibold">{fmt(Math.round(sellingCosts))}</span>
            </div>
          </Formula>

          <Formula>
            <div className="text-center">
              <span className="text-muted-foreground">Net Equity:</span>{" "}
              {fmt(Math.round(futureValue))} &minus; {fmt(Math.round(finalBal))} &minus; {fmt(Math.round(sellingCosts))}{" "}
              = <span className="font-semibold">{fmt(Math.round(finalEquity))}</span>
            </div>
            {finalSurplus > 0 && (
              <div className="text-center mt-1">
                <span className="text-muted-foreground">Invested surplus:</span>{" "}
                <span className="font-semibold">{fmt(Math.round(finalSurplus))}</span>
                <span className="text-muted-foreground ml-1.5">(from months where rent &gt; buy costs)</span>
              </div>
            )}
            <div className="text-center mt-2 text-brand font-semibold text-[14px]">
              Total Buy Wealth = {fmt(Math.round(fB))}
            </div>
          </Formula>
        </Accordion>

        {/* 5. Rent: Portfolio */}
        <Accordion title="Rent: Portfolio Value">
          <p className="text-muted-foreground mt-0 mb-2">
            If you rent instead of buy, we assume you invest the money you would have spent on upfront buying costs.
            Each month, when buying costs more than renting, the renter invests the difference.
            This is symmetric — when rent exceeds buy costs (typically in later years as rent inflates),
            the buyer invests that surplus too.
          </p>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            Starting Capital
          </div>
          <div className="space-y-1 text-[12px] mb-3">
            <div>
              <Var label="Deposit:" value={fmt(deposit)} />
              {" + "}
              <Var label="stamp duty:" value={fmt(stampDuty)} />
              {" + "}
              <Var label="fees:" value={fmt(solicitorFees + surveyFees + movingCosts)} />
            </div>
          </div>
          <Formula>
            <div className="text-center">
              <span className="text-muted-foreground">Initial investment:</span>{" "}
              <span className="font-semibold">{fmt(totalUpfront)}</span>
            </div>
          </Formula>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            Monthly Growth
          </div>
          <p className="text-muted-foreground text-[12px] mb-2">
            Each month, the portfolio grows at {investReturn}% p.a. (compounded monthly = {(investReturn / 12).toFixed(3)}%/mo).
            When monthly buying costs exceed rent, the surplus is added to the renter's portfolio.
            Symmetrically, when rent exceeds buying costs, that surplus is invested by the buyer.
          </p>
          <Formula>
            <div className="text-center text-[11px]">
              <div className="mb-1.5"><span className="text-muted-foreground">Renter:</span> portfolio<sub>m</sub> = portfolio<sub>m-1</sub> &times; (1 + {investReturn}% &frasl; 12) + max(0, buyCost<sub>m</sub> &minus; rent<sub>m</sub>)</div>
              <div><span className="text-muted-foreground">Buyer:</span> surplus<sub>m</sub> = surplus<sub>m-1</sub> &times; (1 + {investReturn}% &frasl; 12) + max(0, rent<sub>m</sub> &minus; buyCost<sub>m</sub>)</div>
            </div>
          </Formula>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            Rent Inflation
          </div>
          <p className="text-muted-foreground text-[12px] mb-2">
            Rent grows at {rentInflation}% p.a. compounded monthly. Year 1 rent: {fmt(Math.round(monthlyRent))}/mo,
            year {horizonYears} rent: ~{fmt(Math.round(monthlyRent * Math.pow(1 + rentInflation / 100 / 12, months)))}/mo.
          </p>

          <Formula>
            <div className="text-center">
              <span className="text-brand font-semibold">Portfolio at Year {horizonYears}</span>
            </div>
            <div className="text-center mt-2 text-brand font-semibold text-[14px]">
              = {fmt(Math.round(fR))}
            </div>
          </Formula>
        </Accordion>

        {/* 6. Wealth Break-Even */}
        <Accordion title="Wealth Break-Even">
          <p className="text-muted-foreground mt-0 mb-2">
            The wealth break-even is the month when the buyer's total wealth (equity + invested surplus)
            first exceeds the renter's portfolio. Before this point, renting + investing leaves you
            wealthier; after it, owning does.
          </p>
          <Formula>
            <div className="text-center text-[11px]">
              Find first month <span className="font-semibold italic">m</span> where{" "}
              <span className="text-brand">(Equity + Surplus)<sub>m</sub></span>{" "}
              &gt;{" "}
              <span className="text-brand">Portfolio<sub>m</sub></span>
            </div>
          </Formula>
          {results.wBE != null ? (
            <div className="space-y-1 text-[12px] mb-3">
              <div><Var label="Break-even month:" value={results.wBE} /> <span className="text-muted-foreground">= {(results.wBE / 12).toFixed(1)} years</span></div>
              <div><Var label="Buy total wealth at that point:" value={fmt(Math.round(results.wD[results.wBE]?.buyWealth ?? 0))} /></div>
              <div><Var label="Rent portfolio at that point:" value={fmt(Math.round(results.wD[results.wBE]?.rentWealth ?? 0))} /></div>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground italic">
              Buying never overtakes renting + investing within the {horizonYears}-year horizon. This could change with different growth assumptions or a longer time frame.
            </p>
          )}
          <p className="text-muted-foreground text-[12px] mb-0">
            This is sensitive to house price growth ({houseGrowth}%) vs investment return ({investReturn}%).
            Small changes to either can shift the break-even by years.
          </p>
        </Accordion>

        {/* 7. Inflation Adjustment */}
        <Accordion title="Inflation Adjustment (Today's Money)">
          <p className="text-muted-foreground mt-0 mb-2">
            When "Show in today's money" is toggled on, we discount all future values back to present-day purchasing power.
            A pound in {horizonYears} years won't buy as much as a pound today.
          </p>
          <Formula>
            <div className="text-center text-[11px]">
              <span className="text-brand font-semibold">Real value</span> = Nominal value &frasl; (1 + inflation)<sup>years</sup>
            </div>
          </Formula>
          <div className="space-y-1 text-[12px] mb-3">
            <div><Var label="Assumed inflation:" value={`${inflationRate}% p.a.`} /></div>
            <div><Var label={`Discount factor at year ${horizonYears}:`} value={`(1 + ${inflationRate}%)^${horizonYears} = ${finalDiscount.toFixed(2)}`} /></div>
          </div>

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 mt-4">
            Effect on Final Values
          </div>
          <table className="w-full text-[12px] my-3 border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-4 text-muted-foreground font-semibold"></th>
                <th className="text-right py-1.5 pr-4 text-muted-foreground font-semibold">Nominal</th>
                <th className="text-right py-1.5 text-muted-foreground font-semibold">Today's £</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 pr-4">Buy: Net Equity</td>
                <td className="text-right py-1.5 pr-4">{fmt(Math.round(fB))}</td>
                <td className="text-right py-1.5 font-semibold">{fmt(fBAdj)}</td>
              </tr>
              <tr className="border-b border-border/50 last:border-b-0">
                <td className="py-1.5 pr-4">Rent: Portfolio</td>
                <td className="text-right py-1.5 pr-4">{fmt(Math.round(fR))}</td>
                <td className="text-right py-1.5 font-semibold">{fmt(fRAdj)}</td>
              </tr>
            </tbody>
          </table>

          <p className="text-muted-foreground text-[12px] mb-0">
            At {inflationRate}% inflation over {horizonYears} years, nominal values are divided
            by {finalDiscount.toFixed(2)} — meaning £1 in the future is worth roughly{" "}
            {(100 / finalDiscount).toFixed(0)}p in today's money.
            This affects both buy and rent equally, but can change which option looks better
            because it reduces the apparent gap between large nominal figures.
          </p>
        </Accordion>
      </div>
    </div>
  );
}
