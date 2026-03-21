import { useState, useEffect, useMemo } from "react";
import { fmt, hpPresets, invPresets } from "../lib/tokens";
import { runProjection, calcStampDuty, pmtCalc, defaultConfig } from "../lib/calc";
import { useIsMobile, useAuth, useInflationSettings } from "../lib/hooks";
import { loadScenarios, loadProperties } from "../lib/supabase";
import { cn } from "../lib/utils";
import Field from "../components/Field";
import PresetSelector from "../components/PresetSelector";
import InteractiveChart from "../components/InteractiveChart";
import SensitivityTable from "../components/SensitivityTable";
import Stat from "../components/Stat";
import Tip from "../components/Tip";
import Toggle from "../components/Toggle";
import { Button } from "../components/ui/button";

function ScenarioPicker({ title, scenarios, selected, onSelect, loading }) {
  return (
    <div className="mb-6">
      <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand border-b border-border pb-2 mb-4">
        {title}
      </div>
      {loading && (
        <div className="text-sm text-muted-foreground font-serif">Loading...</div>
      )}
      {!loading && scenarios.length === 0 && (
        <div className="px-4 py-3 border border-dashed border-border text-xs font-serif text-muted-foreground italic">
          No saved scenarios. Configure and save one in Buy Scenario.
        </div>
      )}
      {!loading && scenarios.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {scenarios.map((s) => {
            const isSelected = selected?.id === s.id;
            const hasPhoto = s.config?.propertyPhotoUrl;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(isSelected ? null : s)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 border text-left transition-all duration-150 rounded-none",
                  isSelected
                    ? "border-foreground bg-foreground"
                    : "border-border bg-transparent hover:border-brand/40"
                )}
              >
                <div
                  className={cn(
                    "w-[30px] h-[30px] shrink-0 border overflow-hidden flex items-center justify-center",
                    isSelected ? "bg-brand/10 border-border" : "bg-background border-border/40"
                  )}
                >
                  {hasPhoto ? (
                    <img src={s.config.propertyPhotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={isSelected ? "text-background" : "text-muted-foreground/40"}
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "font-serif text-[13px] overflow-hidden text-ellipsis whitespace-nowrap",
                      isSelected ? "text-background" : "text-foreground"
                    )}
                  >
                    {s.config?.propertyName || s.name}
                  </div>
                  <div
                    className={cn(
                      "text-[10px] mt-px",
                      isSelected ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {s.name}
                  </div>
                </div>
                {isSelected && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-background"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FlatPicker({ flats, selected, onSelect, loading }) {
  return (
    <div className="mb-6">
      <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand border-b border-border pb-2 mb-4">
        Flat to Rent
      </div>
      {loading && (
        <div className="text-sm text-muted-foreground font-serif">Loading...</div>
      )}
      {!loading && flats.length === 0 && (
        <div className="px-4 py-3 border border-dashed border-border text-xs font-serif text-muted-foreground italic">
          No saved flats. Add one in Gaff Tracker.
        </div>
      )}
      {!loading && flats.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {flats.map((f) => {
            const isSelected = selected?.id === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onSelect(isSelected ? null : f)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 border text-left transition-all duration-150 rounded-none",
                  isSelected
                    ? "border-foreground bg-foreground"
                    : "border-border bg-transparent hover:border-brand/40"
                )}
              >
                <div
                  className={cn(
                    "w-[30px] h-[30px] shrink-0 border overflow-hidden flex items-center justify-center",
                    isSelected ? "bg-brand/10 border-border" : "bg-background border-border/40"
                  )}
                >
                  {f.photo_url ? (
                    <img src={f.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={isSelected ? "text-background" : "text-muted-foreground/40"}
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "font-serif text-[13px] overflow-hidden text-ellipsis whitespace-nowrap",
                      isSelected ? "text-background" : "text-foreground"
                    )}
                  >
                    {f.name}
                  </div>
                  <div
                    className={cn(
                      "text-[10px] mt-px",
                      isSelected ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {f.price ? `${fmt(f.price)}/mo` : "No price set"}
                    {f.location ? ` · ${f.location}` : ""}
                  </div>
                </div>
                {isSelected && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-background"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sandbox() {
  const mobile = useIsMobile();
  const { user } = useAuth();

  const [buyScenarios, setBuyScenarios] = useState([]);
  const [flats, setFlats] = useState([]);
  const [selectedBuy, setSelectedBuy] = useState(null);
  const [selectedFlat, setSelectedFlat] = useState(null);
  const [loading, setLoading] = useState(true);

  const [houseGrowth, setHouseGrowth] = useState(defaultConfig.houseGrowth);
  const [investReturn, setInvestReturn] = useState(defaultConfig.investReturn);
  const [horizonYears, setHorizonYears] = useState(defaultConfig.horizonYears);
  const [monthlyRent, setMonthlyRent] = useState(defaultConfig.monthlyRent);
  const [rentInflation, setRentInflation] = useState(defaultConfig.rentInflation);
  const [activeTab, setActiveTab] = useState("shortTerm");

  // ── Inflation adjustment (shared with Finance Tracker via localStorage) ──
  const { inflationRate, setInflationRate, inflationAdjusted, setInflationAdjusted } = useInflationSettings();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([loadScenarios("buy"), loadProperties()]).then(([b, p]) => {
      setBuyScenarios(b.data || []);
      setFlats(p.data || []);
      setLoading(false);
    });
  }, [user]);

  // When a flat is selected, auto-fill monthly rent from its price
  const handleSelectFlat = (flat) => {
    setSelectedFlat(flat);
    if (flat?.price) setMonthlyRent(flat.price);
  };

  // Auto-compute results whenever inputs change
  const results = useMemo(() => {
    if (!selectedBuy || !selectedFlat) return null;
    const buyCfg = selectedBuy.config;
    const deposit = buyCfg.depositMode === "pct"
      ? buyCfg.propertyValue * (buyCfg.depositPct / 100)
      : buyCfg.depositCash;
    const stampDuty = buyCfg.stampDutyOverride != null
      ? buyCfg.stampDutyOverride
      : calcStampDuty(buyCfg.propertyValue, buyCfg.isFirstTimeBuyer);
    return runProjection({ ...buyCfg, monthlyRent, rentInflation, deposit, stampDuty, houseGrowth, investReturn, horizonYears });
  }, [selectedBuy, selectedFlat, monthlyRent, rentInflation, houseGrowth, investReturn, horizonYears]);

  const runConfig = useMemo(() => {
    if (!selectedBuy || !selectedFlat) return null;
    const buyCfg = selectedBuy.config;
    const deposit = buyCfg.depositMode === "pct"
      ? buyCfg.propertyValue * (buyCfg.depositPct / 100)
      : buyCfg.depositCash;
    const stampDuty = buyCfg.stampDutyOverride != null
      ? buyCfg.stampDutyOverride
      : calcStampDuty(buyCfg.propertyValue, buyCfg.isFirstTimeBuyer);
    return { ...buyCfg, monthlyRent, rentInflation, deposit, stampDuty, houseGrowth, investReturn, horizonYears };
  }, [selectedBuy, selectedFlat, monthlyRent, rentInflation, houseGrowth, investReturn, horizonYears]);

  const fB = results?.wD?.length > 0 ? results.wD[results.wD.length - 1].buyWealth : 0;
  const fR = results?.wD?.length > 0 ? results.wD[results.wD.length - 1].rentWealth : 0;

  // ── Inflation-adjusted wealth data ──
  const inflationAdjustedWD = useMemo(() => {
    if (!results?.wD || !inflationAdjusted || !inflationRate) return results?.wD ?? [];
    const r = inflationRate / 100;
    return results.wD.map((d) => {
      const discount = Math.pow(1 + r, d.month / 12);
      return { ...d, buyWealth: Math.round(d.buyWealth / discount), rentWealth: Math.round(d.rentWealth / discount) };
    });
  }, [results?.wD, inflationAdjusted, inflationRate]);

  // Final real-term values for summary stats
  const finalDiscount = inflationAdjusted && inflationRate ? Math.pow(1 + inflationRate / 100, horizonYears) : 1;
  const fBDisplay = inflationAdjusted ? Math.round(fB / finalDiscount) : fB;
  const fRDisplay = inflationAdjusted ? Math.round(fR / finalDiscount) : fR;

  const exportCSV = () => {
    if (!results || !runConfig) return;
    const csv = activeTab === "shortTerm"
      ? "Month,Year,Net Buy Cost,Cumulative Rent\n" + results.cD.map((d) => `${d.month},${(d.month / 12).toFixed(2)},${Math.round(d.buyCost)},${Math.round(d.rentCost)}`).join("\n")
      : "Month,Year,Buy Wealth,Rent+Invest Wealth\n" + results.wD.map((d) => `${d.month},${(d.month / 12).toFixed(2)},${Math.round(d.buyWealth)},${Math.round(d.rentWealth)}`).join("\n");
    const filename = activeTab === "shortTerm" ? "rent-vs-buy-costs.csv" : "rent-vs-buy-wealth.csv";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="text-center py-20 px-5">
        <h2 className="font-serif font-normal text-foreground mb-3 text-2xl">Rent vs Buy</h2>
        <p className="font-serif text-muted-foreground italic">Sign in to save and compare scenarios.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-8 items-start",
      mobile ? "grid-cols-1" : "grid-cols-[300px_1fr]"
    )}>

      {/* ══ LEFT: INPUTS ══ */}
      <div className={mobile ? "static" : "sticky top-20"}>
        <h2 className="font-serif font-normal text-foreground mb-6 text-[22px]">Rent vs Buy</h2>

        <ScenarioPicker title="Buy Scenario" scenarios={buyScenarios} selected={selectedBuy} onSelect={setSelectedBuy} loading={loading} />
        <FlatPicker flats={flats} selected={selectedFlat} onSelect={handleSelectFlat} loading={loading} />

        {/* Assumptions */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand border-b border-border pb-2 mb-5">
            Assumptions
          </div>

          <div className="mb-5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center mb-2.5">
              House Price Growth <Tip text="Annual property value increase. UK long-term avg ~3.5%." />
            </label>
            <PresetSelector presets={hpPresets} value={houseGrowth} onChange={setHouseGrowth} mobile={true} />
          </div>

          <div className="mb-5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center mb-2.5">
              Investment Return <Tip text="Opportunity cost — what your deposit would earn invested instead." />
            </label>
            <PresetSelector presets={invPresets} value={investReturn} onChange={setInvestReturn} mobile={true} />
          </div>

          <Field label="Monthly Rent" prefix="£" value={monthlyRent} onChange={setMonthlyRent} tip="Monthly rent for the selected flat. Auto-filled from Gaff Tracker price." fieldKey="monthlyRent" />
          <Field label="Rent Inflation" suffix="% p.a." value={rentInflation} onChange={setRentInflation} tip="Annual rent increase. UK cities: 4–8% recently, long-term avg 2–3%." fieldKey="rentInflation" />
          <Field label="Time Horizon" suffix="yrs" value={horizonYears} onChange={setHorizonYears} tip="3–5 years short-term, 15–25 long-term." fieldKey="horizonYears" />
        </div>
      </div>

      {/* ══ RIGHT: OUTPUTS ══ */}
      <div>
        {!results ? (
          <div className="flex items-center justify-center min-h-[320px] border border-dashed border-border flex-col gap-3 p-10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
              <path d="M3 3v18h18" /><path d="m7 16 4-4 4 4 4-4" />
            </svg>
            <p className="font-serif text-muted-foreground italic text-center m-0">
              Select a buy scenario and a flat on the left to see the analysis.
            </p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="flex gap-3 mb-6 flex-wrap px-4 py-3 bg-card border border-border text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{selectedBuy?.config?.propertyName || selectedBuy?.name}</strong>
                {" vs "}
                <strong className="text-foreground">{selectedFlat?.name}</strong>
                {" ("}
                {fmt(runConfig.monthlyRent)}/mo)
              </span>
              <span className="text-border">|</span>
              <span>Growth {runConfig.houseGrowth}% · Invest {runConfig.investReturn}% · {runConfig.horizonYears}yr</span>
            </div>

            {/* Tabs + export */}
            <div className="flex gap-1 mb-6 flex-wrap items-center">
              {[
                { key: "shortTerm", label: "Short-term: Should I buy?" },
                { key: "longTerm", label: "Long-term: Wealth" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "px-[18px] py-[9px] border text-[11px] font-semibold cursor-pointer tracking-[0.02em] transition-all duration-150 rounded-none",
                    activeTab === t.key
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-transparent text-muted-foreground hover:border-brand/40"
                  )}
                >
                  {t.label}
                </button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-wider"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CSV
              </Button>
            </div>

            {/* Short-term */}
            {activeTab === "shortTerm" && (
              <div>
                <div className={cn(
                  "border-l-4 px-6 py-4 mb-6",
                  results.costBE != null
                    ? "border-l-green-600 bg-green-50 dark:bg-green-950/20"
                    : "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                )}>
                  <div className={cn(
                    "text-xl font-serif font-normal mb-1.5",
                    results.costBE != null ? "text-green-600" : "text-red-500"
                  )}>
                    {results.costBE != null
                      ? `Buying breaks even after ${(results.costBE / 12).toFixed(1)} years`
                      : `Renting costs less over ${horizonYears} years`}
                  </div>
                  <p className="text-[13px] font-serif text-muted-foreground leading-relaxed m-0 italic">
                    {results.costBE != null
                      ? `Sell before year ${(results.costBE / 12).toFixed(1)} and you'll have spent more buying than renting.`
                      : `Over ${horizonYears} years, total buying costs exceed cumulative rent.`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-5 mb-6">
                  <Stat mobile={false} label="Cost Break-Even" value={results.costBE != null ? `${(results.costBE / 12).toFixed(1)} yrs` : "N/A"} sub="When total buy cost < total rent" />
                  <Stat mobile={false} label="Monthly: Buy (Yr 1)" value={fmt(Math.round(pmtCalc(results.loanAmount, runConfig.fixedRate, runConfig.mortgageTerm) + results.ongoingMonthly))} sub={`Mortgage + ${fmt(results.ongoingMonthly)} ongoing`} />
                  <Stat mobile={false} label="Monthly: Rent (Yr 1)" value={fmt(runConfig.monthlyRent)} sub={`Rising ${runConfig.rentInflation}% p.a.`} />
                </div>

                {results.mC.length > 1 && (
                  <InteractiveChart
                    mobile={false}
                    data={results.mC.map((d) => ({ month: d.year * 12, buy: d.buy, rent: d.rent }))}
                    keys={["buy", "rent"]}
                    colors={["var(--success)", "var(--destructive)"]}
                    labels={["Monthly buy cost", "Monthly rent"]}
                    title="Monthly Outgoing — Buy vs Rent"
                    formatY={(v) => v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`}
                  />
                )}

                <InteractiveChart
                  mobile={false}
                  data={results.cD}
                  keys={["buyCost", "rentCost"]}
                  colors={["var(--success)", "var(--destructive)"]}
                  labels={["Net buy cost", "Cumulative rent"]}
                  title="Cumulative Net Cost"
                  breakEvenMonth={results.costBE}
                  annotation={results.costBE ? `Break-even: Yr ${(results.costBE / 12).toFixed(1)}` : undefined}
                />

                <SensitivityTable
                  mobile={false}
                  propertyValue={runConfig.propertyValue}
                  totalUpfront={results.totalUpfront}
                  loanAmount={results.loanAmount}
                  fixedRate={runConfig.fixedRate}
                  mortgageTerm={runConfig.mortgageTerm}
                  fixedPeriod={runConfig.fixedPeriod}
                  revertRate={runConfig.revertRate}
                  monthlyRent={runConfig.monthlyRent}
                  rentInflation={runConfig.rentInflation}
                  ongoingMonthly={results.ongoingMonthly}
                  houseGrowth={runConfig.houseGrowth}
                  estateAgentPct={runConfig.estateAgentPct}
                  sellingConveyancing={runConfig.sellingConveyancing}
                  epcCost={runConfig.epcCost}
                />
              </div>
            )}

            {/* Long-term */}
            {activeTab === "longTerm" && (
              <div>
                {(() => {
                  const d = fBDisplay - fRDisplay, bw = d > 0;
                  return (
                    <div className={cn(
                      "border-l-4 px-6 py-4 mb-6",
                      bw
                        ? "border-l-green-600 bg-green-50 dark:bg-green-950/20"
                        : "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                    )}>
                      <div className={cn(
                        "text-xl font-serif font-normal mb-1.5",
                        bw ? "text-green-600" : "text-red-500"
                      )}>
                        {bw ? "Buying" : "Renting + investing"} builds more wealth over {horizonYears} years
                        {inflationAdjusted && (
                          <span className="text-sm text-brand ml-2.5">(in today's £)</span>
                        )}
                      </div>
                      <p className="text-[13px] font-serif text-muted-foreground leading-relaxed m-0 italic">
                        {bw
                          ? `Buying leaves you ${fmt(Math.abs(d))} wealthier${inflationAdjusted ? " in today's purchasing power" : ""}.${results.wBE ? ` Crossover at year ${(results.wBE / 12).toFixed(1)}.` : ""}`
                          : `Renting and investing at ${investReturn}% leaves you ${fmt(Math.abs(d))} ahead${inflationAdjusted ? " in today's purchasing power" : ""}.${results.wBE ? ` Buying catches up at year ${(results.wBE / 12).toFixed(1)}.` : " Buying doesn't catch up."}`}
                      </p>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap gap-5 mb-4">
                  <Stat mobile={false} label="Buy: Net Equity" value={fmt(fBDisplay)} sub={inflationAdjusted ? "In today's purchasing power" : "After mortgage & selling costs"} />
                  <Stat mobile={false} label="Rent: Portfolio" value={fmt(fRDisplay)} sub={inflationAdjusted ? "In today's purchasing power" : `Deposit + savings at ${investReturn}%`} />
                  <Stat mobile={false} label="Wealth Break-Even" value={results.wBE != null ? `${(results.wBE / 12).toFixed(1)} yrs` : "N/A"} sub={results.wBE != null ? `Month ${results.wBE}` : "Not within horizon"} />
                </div>

                {/* Inflation controls */}
                <div className="flex flex-wrap gap-5 items-end mb-5 px-4 py-3.5 bg-card border border-border">
                  <div className="w-[155px]">
                    <Field label="Assumed Inflation" value={inflationRate} onChange={setInflationRate} suffix="% p.a." tip="Bank of England target is 2%. Over 25 years at 2%, the discount is ~40% — nominal £350k becomes ~£212k in today's money." />
                  </div>
                  <div>
                    <Toggle
                      label="Show in today's money (inflation-adjusted)"
                      value={inflationAdjusted}
                      onChange={setInflationAdjusted}
                      tip="Inflation-adjusted values show what your future wealth would be worth in today's purchasing power. Over 25 years at 2% inflation, the discount is ~40%."
                    />
                  </div>
                </div>

                <InteractiveChart
                  mobile={false}
                  data={inflationAdjusted ? inflationAdjustedWD : results.wD}
                  keys={["buyWealth", "rentWealth"]}
                  colors={["var(--success)", "var(--destructive)"]}
                  labels={["Buy (net equity)", "Rent + invest"]}
                  title="Wealth Over Time"
                  breakEvenMonth={results.wBE}
                  inflationAdjusted={inflationAdjusted}
                />
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-12 border-t-2 border-foreground pt-4 flex justify-between">
          <span className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase font-semibold">Personal Finance Suite</span>
          <span className="text-[10px] text-muted-foreground/50 tracking-[0.15em] uppercase">Rent vs Buy</span>
        </div>
      </div>
    </div>
  );
}
