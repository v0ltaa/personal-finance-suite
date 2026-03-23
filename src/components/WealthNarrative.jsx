import { useMemo } from "react";
import { fmt } from "../lib/tokens";
import { cn } from "../lib/utils";

/**
 * Analyse the wealth data to detect the crossover pattern and build a
 * narrative explanation with the user's actual numbers plugged in.
 */
function analysePattern(wD) {
  if (!wD || wD.length < 2) return null;

  // Find all crossover points (months where the lead switches)
  const crossovers = [];
  for (let i = 1; i < wD.length; i++) {
    const prevDiff = wD[i - 1].buyWealth - wD[i - 1].rentWealth;
    const currDiff = wD[i].buyWealth - wD[i].rentWealth;
    if ((prevDiff < 0 && currDiff >= 0) || (prevDiff >= 0 && currDiff < 0)) {
      crossovers.push(i);
    }
  }

  const first = wD[0];
  const last = wD[wD.length - 1];
  const buyWinsAtEnd = last.buyWealth >= last.rentWealth;

  // Find the peak advantage for each side
  let maxBuyLead = -Infinity, maxBuyLeadMonth = 0;
  let maxRentLead = -Infinity, maxRentLeadMonth = 0;
  for (const d of wD) {
    const diff = d.buyWealth - d.rentWealth;
    if (diff > maxBuyLead) { maxBuyLead = diff; maxBuyLeadMonth = d.month; }
    if (-diff > maxRentLead) { maxRentLead = -diff; maxRentLeadMonth = d.month; }
  }

  // Determine pattern
  let pattern;
  if (crossovers.length === 0 && !buyWinsAtEnd) {
    pattern = "rent_dominates";
  } else if (crossovers.length === 0 && buyWinsAtEnd) {
    // Edge case: buy starts above (shouldn't happen with transaction costs, but handle it)
    pattern = "buy_dominates";
  } else if (crossovers.length === 1 && buyWinsAtEnd) {
    pattern = "buy_wins_long_term";
  } else if (crossovers.length === 1 && !buyWinsAtEnd) {
    // Buy briefly leads then rent wins — rare edge case, treat as rent_dominates variant
    pattern = "buy_brief_then_rent";
  } else if (crossovers.length >= 2 && !buyWinsAtEnd) {
    pattern = "buy_mid_rent_long";
  } else if (crossovers.length >= 2 && buyWinsAtEnd) {
    pattern = "rent_mid_buy_long";
  } else {
    pattern = "buy_wins_long_term"; // fallback
  }

  // Track surplus at end (if available)
  const finalSurplus = last.buySurplus ?? 0;

  return {
    pattern,
    crossovers,
    crossoverMonths: crossovers.map((i) => wD[i].month),
    buyWinsAtEnd,
    first,
    last,
    finalSurplus: Math.round(finalSurplus),
    maxBuyLead: Math.round(maxBuyLead),
    maxBuyLeadMonth,
    maxRentLead: Math.round(maxRentLead),
    maxRentLeadMonth,
    startGap: Math.round(first.rentWealth - first.buyWealth),
    endGap: Math.round(Math.abs(last.buyWealth - last.rentWealth)),
  };
}

const patternLabels = {
  rent_dominates: "Rent always ahead",
  buy_wins_long_term: "Buy wins long-term",
  buy_mid_rent_long: "Buy wins mid-term, rent wins long-term",
  buy_dominates: "Buy always ahead",
  buy_brief_then_rent: "Buy briefly leads, rent wins",
  rent_mid_buy_long: "Rent leads mid-term, buy wins long-term",
};

const patternColors = {
  rent_dominates: "text-red-500",
  buy_wins_long_term: "text-green-600",
  buy_mid_rent_long: "text-amber-600 dark:text-amber-400",
  buy_dominates: "text-green-600",
  buy_brief_then_rent: "text-red-500",
  rent_mid_buy_long: "text-green-600",
};

function Phase({ number, title, months, children }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-5 h-5 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[10px] font-bold text-brand">{number}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground">
          {title}
          {months && (
            <span className="text-muted-foreground font-normal ml-1.5 text-[12px]">{months}</span>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5 mb-0">
          {children}
        </p>
      </div>
    </div>
  );
}

function HonestTake({ children }) {
  return (
    <div className="mt-4 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-[12px] text-foreground/80 leading-relaxed">
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400 shrink-0">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span className="font-semibold text-amber-700 dark:text-amber-400 text-[11px] uppercase tracking-widest">
          Honest take
        </span>
      </div>
      {children}
    </div>
  );
}

export default function WealthNarrative({ wD, config }) {
  const analysis = useMemo(() => analysePattern(wD), [wD]);
  if (!analysis || !config) return null;

  const {
    pattern, crossoverMonths, maxBuyLead, maxBuyLeadMonth,
    maxRentLead, maxRentLeadMonth, startGap, endGap, buyWinsAtEnd,
    finalSurplus,
  } = analysis;

  const { houseGrowth, investReturn, horizonYears } = config;
  const yrs = (m) => `yr ${(m / 12).toFixed(1)}`;

  return (
    <div className="mt-6 border border-border bg-card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
          Reading the Curve
        </span>
        <span className={cn("text-[11px] font-semibold", patternColors[pattern])}>
          {patternLabels[pattern]}
        </span>
      </div>

      <div className="px-5 py-4">
        {/* ── Pattern: Rent always wins ── */}
        {pattern === "rent_dominates" && (
          <div className="space-y-3">
            <p className="text-[13px] text-foreground/80 leading-relaxed mt-0 mb-4">
              Buying never overtakes renting + investing over your {horizonYears}-year horizon.
              The rent portfolio's {investReturn}% compound growth outpaces the {houseGrowth}% house
              price growth throughout.
            </p>
            <Phase number={1} title="Transaction cost gap" months="(day one)">
              Buying starts {fmt(startGap)} behind — stamp duty, fees, and the selling costs
              you'd face if you sold immediately create this day-one hole.
            </Phase>
            <Phase number={2} title="The gap never closes" months={`(to ${yrs(horizonYears * 12)})`}>
              Rent's maximum lead peaks at {fmt(maxRentLead)} around {yrs(maxRentLeadMonth)}.
              At {investReturn}% returns vs {houseGrowth}% house growth, the portfolio compounds
              faster than equity builds. By year {horizonYears}, renting leaves
              you {fmt(endGap)} ahead.
            </Phase>

            <div className="mt-4 px-4 py-3 bg-muted/50 border border-border rounded-lg text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">What would change this?</span>{" "}
              Higher house price growth, lower investment returns, a longer horizon,
              or a smaller deposit (less opportunity cost) could create a crossover point.
            </div>

            <HonestTake>
              The numbers say rent, but this model assumes you actually invest the difference
              consistently for {horizonYears} years — and most people don't. A mortgage is
              forced savings; an ISA requires discipline. If you're confident you'll invest
              month-in, month-out without touching it, renting genuinely wins here. If not,
              buying's "forced equity" may outperform your real-world investing behaviour
              even if it underperforms on paper. The other thing this model can't price:
              security of tenure. Landlords can sell, raise rent, or simply not renew.
              That instability has a real cost — just not one that shows up on a graph.
            </HonestTake>
          </div>
        )}

        {/* ── Pattern: Buy wins long-term (single crossover) ── */}
        {pattern === "buy_wins_long_term" && (
          <div className="space-y-3">
            <p className="text-[13px] text-foreground/80 leading-relaxed mt-0 mb-4">
              The classic pattern: buying starts behind due to transaction costs, then
              overtakes and stays ahead. Once the mortgage is building equity faster than the
              portfolio compounds, buying doesn't look back.
            </p>
            <Phase number={1} title="Transaction cost gap" months="(day one)">
              Buying starts {fmt(startGap)} behind. Stamp duty, solicitor fees, survey, and moving
              costs are sunk immediately, plus you'd lose estate agent fees if you sold today.
            </Phase>
            <Phase number={2} title="Rent leads" months={crossoverMonths[0] ? `(months 1–${crossoverMonths[0]})` : undefined}>
              Renting peaks at {fmt(maxRentLead)} ahead around {yrs(maxRentLeadMonth)}.
              Early mortgage payments are mostly interest — little goes to principal, so
              equity builds slowly while the portfolio compounds at {investReturn}%.
            </Phase>
            <Phase number={3} title="Buy overtakes" months={crossoverMonths[0] ? `(${yrs(crossoverMonths[0])} onward)` : undefined}>
              At {yrs(crossoverMonths[0])}, buy wealth crosses above the rent portfolio.
              The mortgage balance has shrunk enough that property growth ({houseGrowth}% p.a.) on your
              full asset outweighs the portfolio's returns on a smaller base.
              {finalSurplus > 0 && <> As rent inflates past your mortgage payment, you also
              build an invested surplus of {fmt(finalSurplus)} by year {horizonYears}.</>}
              {maxBuyLead > 0 && <> Buy peaks at {fmt(maxBuyLead)} ahead around {yrs(maxBuyLeadMonth)}.</>}
              {" "}By year {horizonYears}, buying leaves you {fmt(endGap)} wealthier.
            </Phase>

            <div className="mt-4 px-4 py-3 bg-muted/50 border border-border rounded-lg text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">The key insight:</span>{" "}
              Sell before {yrs(crossoverMonths[0])} and you'll have been better off renting.
              The crossover is the minimum hold period to justify buying.
            </div>

            <HonestTake>
              This is the scenario most people hope for — and it's realistic if you plan to
              stay put. The {(crossoverMonths[0] / 12).toFixed(0)}-year minimum hold period is
              your real commitment. Moving before then (job change, relationship, neighbourhood)
              means you'd have been better off renting. After the crossover, you're using
              property as leveraged savings — a {fmt(config.deposit)} deposit controlling
              a {fmt(config.propertyValue)} asset. That leverage works both ways though:
              a {houseGrowth}% fall in house prices hits your equity much harder percentage-wise
              than the headline number suggests. If you sell, the realistic move is to roll
              equity into your next property — not cash out entirely. This model treats
              the sale as an endpoint, but in practice most people are buying again, restarting
              the cycle with a larger deposit.
            </HonestTake>
          </div>
        )}

        {/* ── Pattern: Buy wins mid-term, rent wins long-term (2+ crossovers) ── */}
        {pattern === "buy_mid_rent_long" && (
          <div className="space-y-3">
            <p className="text-[13px] text-foreground/80 leading-relaxed mt-0 mb-4">
              The most nuanced pattern: buying overtakes in the middle years as equity builds,
              but the rent portfolio's higher compound rate ({investReturn}% vs {houseGrowth}%)
              eventually catches back up.
            </p>
            <Phase number={1} title="Transaction cost gap" months="(day one)">
              Buying starts {fmt(startGap)} behind — the usual day-one deficit from
              stamp duty, fees, and hypothetical selling costs.
            </Phase>
            <Phase number={2} title="Buy overtakes" months={crossoverMonths[0] ? `(${yrs(crossoverMonths[0])})` : undefined}>
              At {yrs(crossoverMonths[0])}, mortgage paydown and property growth
              close the gap. Buy peaks at {fmt(maxBuyLead)} ahead
              around {yrs(maxBuyLeadMonth)} — this is the sweet spot for selling.
            </Phase>
            <Phase number={3} title="Rent catches back up" months={crossoverMonths[1] ? `(${yrs(crossoverMonths[1])})` : undefined}>
              At {yrs(crossoverMonths[1])}, the rent portfolio overtakes again.
              The portfolio base is now large enough that compounding at {investReturn}%
              outpaces {houseGrowth}% growth on the property — even accounting for the
              buyer's invested surplus{finalSurplus > 0 ? ` of ${fmt(finalSurplus)}` : ""}.
              By year {horizonYears}, renting leaves you {fmt(endGap)} ahead.
            </Phase>

            <div className="mt-4 px-4 py-3 bg-muted/50 border border-border rounded-lg text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">The window:</span>{" "}
              Buying is only the better financial outcome if you sell
              between {yrs(crossoverMonths[0])} and {yrs(crossoverMonths[1])}.
              Outside that window, renting + investing wins. Peak advantage
              is around {yrs(maxBuyLeadMonth)}.
            </div>

            <HonestTake>
              The {(crossoverMonths[0] / 12).toFixed(0)}–{(crossoverMonths[1] / 12).toFixed(0)} year
              window is real, but nobody times a property sale to a spreadsheet. In practice,
              if you buy and sell around {yrs(maxBuyLeadMonth)}, you've used property as a
              leveraged savings vehicle — your {fmt(config.deposit)} deposit controlled
              a {fmt(config.propertyValue)} asset that grew. The equity you walk away with
              would realistically go into your next home (bigger deposit, smaller mortgage)
              or, if you're cashing out entirely, into a Stocks &amp; Shares ISA or pension
              where it compounds at closer to that {investReturn}% rate. The model treats
              the sale as the end of the story, but really it's the start of the next chapter.
              The honest question isn't "buy or rent forever" — it's "do I expect to stay
              for at least {(crossoverMonths[0] / 12).toFixed(0)} years?" If yes, buying works
              in the middle. If not, rent and invest without guilt.
            </HonestTake>
          </div>
        )}

        {/* ── Pattern: Rent leads mid-term, buy wins long-term (2+ crossovers, buy ends on top) ── */}
        {pattern === "rent_mid_buy_long" && (
          <div className="space-y-3">
            <p className="text-[13px] text-foreground/80 leading-relaxed mt-0 mb-4">
              An unusual pattern: buying briefly takes the lead, falls behind in the middle years,
              then overtakes again for good. The rate switch or mortgage payoff changes
              the dynamics late in the term.
            </p>
            <Phase number={1} title="Early crossover" months={crossoverMonths[0] ? `(${yrs(crossoverMonths[0])})` : undefined}>
              Buy briefly overtakes at {yrs(crossoverMonths[0])}, but the lead is slim.
            </Phase>
            <Phase number={2} title="Rent retakes the lead" months={crossoverMonths[1] ? `(${yrs(crossoverMonths[1])})` : undefined}>
              Rent pulls back ahead at {yrs(crossoverMonths[1])}.
              Renting peaks at {fmt(maxRentLead)} ahead around {yrs(maxRentLeadMonth)}.
            </Phase>
            <Phase number={3} title="Buy wins permanently" months={crossoverMonths.length > 2 ? `(${yrs(crossoverMonths[crossoverMonths.length - 1])})` : `(${yrs(crossoverMonths[1])} onward)`}>
              {maxBuyLead > 0 && <>Buy's final lead peaks at {fmt(maxBuyLead)} around {yrs(maxBuyLeadMonth)}.</>}
              {" "}By year {horizonYears}, buying leaves you {fmt(endGap)} wealthier.
            </Phase>

            <div className="mt-4 px-4 py-3 bg-muted/50 border border-border rounded-lg text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">Why the wobble?</span>{" "}
              This typically happens when the revert rate causes a temporary spike in
              buy costs, feeding extra cash into the rent portfolio, before the mortgage
              balance drops low enough that buying pulls ahead for good.
            </div>

            <HonestTake>
              The wobble in the middle usually comes from the rate switch — when your fixed
              deal ends and the revert rate kicks in, your payments jump, temporarily feeding
              more cash into the rent-and-invest side. In reality, you'd remortgage to a new
              fixed deal rather than accepting the revert rate, which would smooth out this dip.
              The model uses the revert rate as a conservative worst case. If you're planning
              to hold long-term, this pattern ultimately favours buying — the wobble is a
              modelling artefact more than a real risk. The practical takeaway: make sure you
              remortgage before your fixed deal ends.
            </HonestTake>
          </div>
        )}

        {/* ── Pattern: Buy briefly leads then rent wins ── */}
        {pattern === "buy_brief_then_rent" && (
          <div className="space-y-3">
            <p className="text-[13px] text-foreground/80 leading-relaxed mt-0 mb-4">
              Buying briefly overtakes but can't sustain the lead.
              The rent portfolio's {investReturn}% compound growth takes over.
            </p>
            <Phase number={1} title="Brief buy lead" months={crossoverMonths[0] ? `(${yrs(crossoverMonths[0])})` : undefined}>
              Buy overtakes at {yrs(crossoverMonths[0])}, peaking
              at {fmt(maxBuyLead)} ahead around {yrs(maxBuyLeadMonth)}.
            </Phase>
            <Phase number={2} title="Rent wins" months={`(${yrs(horizonYears * 12)})`}>
              By year {horizonYears}, renting leaves you {fmt(endGap)} ahead.
            </Phase>

            <div className="mt-4 px-4 py-3 bg-muted/50 border border-border rounded-lg text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">What would change this?</span>{" "}
              Higher house price growth or a longer horizon could let buying sustain the lead.
            </div>

            <HonestTake>
              This is a marginal case — buying briefly wins but can't hold on. It suggests the
              numbers are close enough that the decision shouldn't be purely financial.
              Non-financial factors matter here: do you want the stability of owning? Are you
              in an area where landlords frequently sell up? Would you actually invest the
              difference each month, or would it quietly disappear into lifestyle spending?
              When the gap is this narrow, the behavioural question matters more than the
              spreadsheet. If you'd genuinely invest the difference in a global index fund
              every month for {horizonYears} years, rent wins. If you're honest that you
              probably won't, the forced savings of a mortgage might serve you better in practice.
            </HonestTake>
          </div>
        )}

        {/* ── Pattern: Buy always ahead (rare/theoretical) ── */}
        {pattern === "buy_dominates" && (
          <div className="space-y-3">
            <p className="text-[13px] text-foreground/80 leading-relaxed mt-0 mb-4">
              Buying is ahead from the start and stays ahead throughout. This is unusual
              and typically means very low transaction costs relative to the property value.
            </p>
            <Phase number={1} title="Buy leads throughout" months={`(all ${horizonYears} years)`}>
              Buy peaks at {fmt(maxBuyLead)} ahead around {yrs(maxBuyLeadMonth)}.
              By year {horizonYears}, buying leaves you {fmt(endGap)} wealthier.
            </Phase>

            <HonestTake>
              This is rare — buying winning from day one usually means your assumptions
              are very favourable to property (high growth, low returns elsewhere, or very
              low transaction costs). Stress-test this by bumping investment returns up or
              house growth down. If buying still dominates, the case is strong. If it flips
              with small changes, be cautious — the model is sensitive to assumptions that
              nobody can predict with certainty over {horizonYears} years.
            </HonestTake>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-5 pt-4 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed m-0 italic">
            This is not financial advice. These projections are based on simplified models with
            constant growth rates — real markets are volatile and unpredictable. The model does
            not account for tax implications beyond stamp duty, changes in personal circumstances,
            regional market variation, rental market dynamics, or the non-financial value of
            home ownership. Speak to a qualified, independent financial adviser before making
            property or investment decisions.
          </p>
        </div>
      </div>
    </div>
  );
}