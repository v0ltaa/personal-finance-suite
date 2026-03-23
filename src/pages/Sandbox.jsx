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
import HowWeCalculate from "../components/HowWeCalculate";
import WealthNarrative from "../components/WealthNarrative";
import { Button } from "../components/ui/button";

/* ─── Compact scenario tile ─── */
function ScenarioTile({ scenario, selected, onSelect }) {
  const isSelected = selected?.id === scenario.id;
  const hasPhoto = scenario.config?.propertyPhotoUrl;
  return (
    <button
      onClick={() => onSelect(isSelected ? null : scenario)}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 border text-left transition-all duration-150 rounded-none w-full",
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
          <img src={scenario.config.propertyPhotoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={isSelected ? "text-background" : "text-muted-foreground/40"}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("font-serif text-[13px] overflow-hidden text-ellipsis whitespace-nowrap", isSelected ? "text-background" : "text-foreground")}>
          {scenario.config?.propertyName || scenario.name}
        </div>
        <div className={cn("text-[10px] mt-px", isSelected ? "text-background/70" : "text-muted-foreground")}>
          {scenario.name}
        </div>
      </div>
      {isSelected && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function FlatTile({ flat, selected, onSelect }) {
  const isSelected = selected?.id === flat.id;
  return (
    <button
      onClick={() => onSelect(isSelected ? null : flat)}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 border text-left transition-all duration-150 rounded-none w-full",
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
        {flat.photo_url ? (
          <img src={flat.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={isSelected ? "text-background" : "text-muted-foreground/40"}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("font-serif text-[13px] overflow-hidden text-ellipsis whitespace-nowrap", isSelected ? "text-background" : "text-foreground")}>
          {flat.name}
        </div>
        <div className={cn("text-[10px] mt-px", isSelected ? "text-background/70" : "text-muted-foreground")}>
          {flat.price ? `${fmt(flat.price)}/mo` : "No price set"}
          {flat.location ? ` · ${flat.location}` : ""}
        </div>
      </div>
      {isSelected && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
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
  const [activeTab, setActiveTab] = useState("longTerm");
  const [configOpen, setConfigOpen] = useState(true);

  const { inflationRate, setInflationRate, inflationAdjusted, setInflationAdjusted } = useInflationSettings();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([loadScenarios("buy"), loadProperties()]).then(([b, p]) => {
      setBuyScenarios(b.data || []);
      setFlats(p.data || []);
      setLoading(false);
    });
  }, [user]);

  const handleSelectFlat = (flat) => {
    setSelectedFlat(flat);
    if (flat?.price) setMonthlyRent(flat.price);
  };

  // Auto-collapse config when both selections are made
  useEffect(() => {
    if (selectedBuy && selectedFlat && !mobile) {
      setConfigOpen(false);
    }
  }, [selectedBuy, selectedFlat, mobile]);

  const results = useMemo(() => {
    if (!selectedBuy || !selectedFlat) return null;
    const buyCfg = selectedBuy.config;
    const deposit = buyCfg.depositMode === "pct"
      ? buyCfg.propertyValue * (buyCfg.depositPct / 100)
      : buyCfg.depositCash;
    const stampDuty = buyCfg.stampDutyOverride != null
      ? buyCfg.stampDutyOverride
      : calcStampDuty(buyCfg.propertyValue, buyCfg.isFirstTimeBuyer);
    return runProjection({ ...buyCfg, monthlyRent, rentInflation, deposit, stampDuty, houseGrowth, investReturn, horizonYears, costInflation: inflationRate || 0 });
  }, [selectedBuy, selectedFlat, monthlyRent, rentInflation, houseGrowth, investReturn, horizonYears, inflationRate]);

  const runConfig = useMemo(() => {
    if (!selectedBuy || !selectedFlat) return null;
    const buyCfg = selectedBuy.config;
    const deposit = buyCfg.depositMode === "pct"
      ? buyCfg.propertyValue * (buyCfg.depositPct / 100)
      : buyCfg.depositCash;
    const stampDuty = buyCfg.stampDutyOverride != null
      ? buyCfg.stampDutyOverride
      : calcStampDuty(buyCfg.propertyValue, buyCfg.isFirstTimeBuyer);
    return { ...buyCfg, monthlyRent, rentInflation, deposit, stampDuty, houseGrowth, investReturn, horizonYears, costInflation: inflationRate || 0 };
  }, [selectedBuy, selectedFlat, monthlyRent, rentInflation, houseGrowth, investReturn, horizonYears, inflationRate]);

  const fB = results?.wD?.length > 0 ? results.wD[results.wD.length - 1].buyWealth : 0;
  const fR = results?.wD?.length > 0 ? results.wD[results.wD.length - 1].rentWealth : 0;

  const inflationAdjustedWD = useMemo(() => {
    if (!results?.wD || !inflationAdjusted || !inflationRate) return results?.wD ?? [];
    const r = inflationRate / 100;
    return results.wD.map((d) => {
      const discount = Math.pow(1 + r, d.month / 12);
      return {
        ...d,
        buyWealth: Math.round(d.buyWealth / discount),
        rentWealth: Math.round(d.rentWealth / discount),
        buyEquity: d.buyEquity != null ? Math.round(d.buyEquity / discount) : undefined,
        buySurplus: d.buySurplus != null ? Math.round(d.buySurplus / discount) : undefined,
      };
    });
  }, [results?.wD, inflationAdjusted, inflationRate]);

  const finalDiscount = inflationAdjusted && inflationRate ? Math.pow(1 + inflationRate / 100, horizonYears) : 1;
  const fBDisplay = inflationAdjusted ? Math.round(fB / finalDiscount) : fB;
  const fRDisplay = inflationAdjusted ? Math.round(fR / finalDiscount) : fR;

  const wealthMarkers = useMemo(() => {
    const wD = inflationAdjusted ? inflationAdjustedWD : results?.wD;
    if (!wD || wD.length < 2) return [];
    const crossovers = [];
    for (let i = 1; i < wD.length; i++) {
      const prev = wD[i - 1].buyWealth - wD[i - 1].rentWealth;
      const curr = wD[i].buyWealth - wD[i].rentWealth;
      if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
        crossovers.push(wD[i].month);
      }
    }
    const buyWinsAtEnd = wD[wD.length - 1].buyWealth >= wD[wD.length - 1].rentWealth;
    let phaseOffset;
    if (crossovers.length === 1 && buyWinsAtEnd) phaseOffset = 3;
    else if (crossovers.length === 1 && !buyWinsAtEnd) phaseOffset = 1;
    else if (crossovers.length >= 2 && !buyWinsAtEnd) phaseOffset = 2;
    else if (crossovers.length >= 2 && buyWinsAtEnd) phaseOffset = 1;
    else phaseOffset = 1;

    const cc = getComputedStyle(document.documentElement);
    const successColor = cc.getPropertyValue("--success").trim();
    const destructiveColor = cc.getPropertyValue("--destructive").trim();
    return crossovers.map((month, i) => {
      const buyLeading = (() => {
        const idx = wD.findIndex((d) => d.month === month);
        if (idx < wD.length - 1) return wD[idx + 1].buyWealth > wD[idx + 1].rentWealth;
        return wD[idx].buyWealth >= wD[idx].rentWealth;
      })();
      const yr = (month / 12).toFixed(1);
      return {
        month,
        label: `${phaseOffset + i}`,
        text: buyLeading ? `Buy overtakes: Yr ${yr}` : `Rent catches up: Yr ${yr}`,
        color: buyLeading
          ? (successColor ? `hsl(${successColor})` : "#3a7fa8")
          : (destructiveColor ? `hsl(${destructiveColor})` : "#b83825"),
      };
    });
  }, [results?.wD, inflationAdjustedWD, inflationAdjusted]);

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

  const hasSelections = selectedBuy && selectedFlat;

  return (
    <div className="px-4 sm:px-8 py-6">
      <div className="max-w-7xl mx-auto">

        {/* ══ PAGE HEADER ══ */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif font-normal text-foreground text-[22px] m-0">Rent vs Buy</h2>
          <div className="flex items-center gap-2">
            {results && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CSV
              </Button>
            )}
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 border text-[10px] font-semibold uppercase tracking-wider transition-all duration-150",
                configOpen
                  ? "border-brand text-brand bg-brand/5"
                  : "border-border text-muted-foreground hover:border-brand/40"
              )}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {configOpen ? "Hide" : "Configure"}
              {!configOpen && hasSelections && (
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
              )}
            </button>
          </div>
        </div>

        {/* ══ SELECTED SCENARIOS STRIP (when config collapsed) ══ */}
        {!configOpen && hasSelections && (
          <div className="flex gap-3 mb-4 flex-wrap px-4 py-3 bg-card border border-border text-xs text-muted-foreground animate-fade-in">
            <span>
              <strong className="text-foreground">{selectedBuy?.config?.propertyName || selectedBuy?.name}</strong>
              {" vs "}
              <strong className="text-foreground">{selectedFlat?.name}</strong>
              {" ("}
              {fmt(runConfig?.monthlyRent || monthlyRent)}/mo)
            </span>
            <button
              onClick={() => setConfigOpen(true)}
              className="ml-auto text-brand hover:underline text-[10px] font-semibold uppercase tracking-wider"
            >
              Change scenarios
            </button>
          </div>
        )}

        {/* ══ CONFIGURATION PANEL (scenarios only) ══ */}
        {configOpen && (
          <div className="mb-6 border border-border bg-card animate-fade-in">
            <div className={cn(
              "grid gap-6 p-5",
              mobile ? "grid-cols-1" : "grid-cols-2"
            )}>
              {/* Buy Scenarios */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand border-b border-border pb-2 mb-3">
                  Buy Scenario
                </div>
                {loading && <div className="text-sm text-muted-foreground font-serif">Loading...</div>}
                {!loading && buyScenarios.length === 0 && (
                  <div className="px-4 py-3 border border-dashed border-border text-xs font-serif text-muted-foreground italic">
                    No saved scenarios. Configure and save one in Buy Scenario.
                  </div>
                )}
                {!loading && buyScenarios.length > 0 && (
                  <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                    {buyScenarios.map((s) => (
                      <ScenarioTile key={s.id} scenario={s} selected={selectedBuy} onSelect={setSelectedBuy} />
                    ))}
                  </div>
                )}
              </div>

              {/* Flat to Rent */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand border-b border-border pb-2 mb-3">
                  Flat to Rent
                </div>
                {loading && <div className="text-sm text-muted-foreground font-serif">Loading...</div>}
                {!loading && flats.length === 0 && (
                  <div className="px-4 py-3 border border-dashed border-border text-xs font-serif text-muted-foreground italic">
                    No saved flats. Add one in Gaff Tracker.
                  </div>
                )}
                {!loading && flats.length > 0 && (
                  <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                    {flats.map((f) => (
                      <FlatTile key={f.id} flat={f} selected={selectedFlat} onSelect={handleSelectFlat} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ STICKY ASSUMPTIONS BAR ══ */}
        <div className={cn(
          "sticky z-40 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 sm:-mx-8 px-4 sm:px-8 mb-6 transition-all",
          mobile ? "top-[6.5rem]" : "top-[6.5rem]"
        )}>
          <div className="max-w-7xl mx-auto py-3">
            <div className={cn(
              "flex items-end gap-x-6 gap-y-3 flex-wrap",
            )}>
              <div className="flex items-center gap-1.5 mr-auto sm:mr-0">
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand">Assumptions</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className={cn(
                  "flex items-end gap-x-5 gap-y-3 flex-wrap",
                )}>
                  {/* House Price Growth */}
                  <div>
                    <label className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center mb-1.5">
                      HP Growth <Tip text="Annual property value increase. UK long-term avg ~3.5%." />
                    </label>
                    <PresetSelector presets={hpPresets} value={houseGrowth} onChange={setHouseGrowth} />
                  </div>

                  {/* Investment Return */}
                  <div>
                    <label className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center mb-1.5">
                      Invest Return <Tip text="Opportunity cost — what your deposit would earn invested instead." />
                    </label>
                    <PresetSelector presets={invPresets} value={investReturn} onChange={setInvestReturn} />
                  </div>

                  {/* Compact numeric fields */}
                  <div className="w-[100px]">
                    <Field label="Rent" prefix="£" value={monthlyRent} onChange={setMonthlyRent} tip="Monthly rent. Auto-filled from Gaff Tracker." fieldKey="monthlyRent" />
                  </div>
                  <div className="w-[80px]">
                    <Field label="Rent Infl." suffix="%" value={rentInflation} onChange={setRentInflation} tip="Annual rent increase." fieldKey="rentInflation" />
                  </div>
                  <div className="w-[70px]">
                    <Field label="Horizon" suffix="yr" value={horizonYears} onChange={setHorizonYears} tip="3–5 years short-term, 15–25 long-term." fieldKey="horizonYears" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ EMPTY STATE ══ */}
        {!results && (
          <div className="flex items-center justify-center min-h-[400px] border border-dashed border-border flex-col gap-4 p-10">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
              <path d="M3 3v18h18" /><path d="m7 16 4-4 4 4 4-4" />
            </svg>
            <p className="font-serif text-muted-foreground italic text-center m-0 text-lg">
              Select a buy scenario and a flat above to see the analysis.
            </p>
            {!configOpen && (
              <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                Open Configuration
              </Button>
            )}
          </div>
        )}

        {/* ══ RESULTS ══ */}
        {results && (
          <>
            {/* ── VERDICT HERO ── */}
            {activeTab === "longTerm" && (() => {
              const d = fBDisplay - fRDisplay, bw = d > 0;
              return (
                <div className={cn(
                  "border-l-4 px-6 py-5 mb-8",
                  bw
                    ? "border-l-green-600 bg-green-50 dark:bg-green-950/20"
                    : "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                )}>
                  <div className={cn(
                    "text-2xl sm:text-3xl font-serif font-normal mb-2",
                    bw ? "text-green-600" : "text-red-500"
                  )}>
                    {bw ? "Buying" : "Renting + investing"} builds more wealth over {horizonYears} years
                    {inflationAdjusted && (
                      <span className="text-sm text-brand ml-2.5">(in today's £)</span>
                    )}
                  </div>
                  <p className="text-[14px] font-serif text-muted-foreground leading-relaxed m-0">
                    {bw
                      ? `Buying leaves you ${fmt(Math.abs(d))} wealthier${inflationAdjusted ? " in today's purchasing power" : ""}.${results.wBE ? ` Crossover at year ${(results.wBE / 12).toFixed(1)}.` : ""}`
                      : `Renting and investing at ${investReturn}% leaves you ${fmt(Math.abs(d))} ahead${inflationAdjusted ? " in today's purchasing power" : ""}.${results.wBE ? ` Buying catches up at year ${(results.wBE / 12).toFixed(1)}.` : " Buying doesn't catch up."}`}
                  </p>
                </div>
              );
            })()}

            {activeTab === "shortTerm" && (
              <div className={cn(
                "border-l-4 px-6 py-5 mb-8",
                results.costBE != null
                  ? "border-l-green-600 bg-green-50 dark:bg-green-950/20"
                  : "border-l-red-500 bg-red-50 dark:bg-red-950/20"
              )}>
                <div className={cn(
                  "text-2xl sm:text-3xl font-serif font-normal mb-2",
                  results.costBE != null ? "text-green-600" : "text-red-500"
                )}>
                  {results.costBE != null
                    ? `Buying breaks even after ${(results.costBE / 12).toFixed(1)} years`
                    : `Renting costs less over ${horizonYears} years`}
                </div>
                <p className="text-[14px] font-serif text-muted-foreground leading-relaxed m-0">
                  {results.costBE != null
                    ? `Sell before year ${(results.costBE / 12).toFixed(1)} and you'll have spent more buying than renting.`
                    : `Over ${horizonYears} years, total buying costs exceed cumulative rent.`}
                </p>
              </div>
            )}

            {/* ── KEY STATS ── */}
            <div className={cn(
              "grid gap-5 mb-8",
              mobile ? "grid-cols-2" : "grid-cols-4"
            )}>
              {activeTab === "longTerm" ? (
                <>
                  <Stat label="Buy: Net Equity" value={fmt(fBDisplay)} sub={inflationAdjusted ? "In today's purchasing power" : "After mortgage & selling costs"} />
                  <Stat label="Rent: Portfolio" value={fmt(fRDisplay)} sub={inflationAdjusted ? "In today's purchasing power" : `Deposit + savings at ${investReturn}%`} />
                  <Stat label="Wealth Break-Even" value={results.wBE != null ? `${(results.wBE / 12).toFixed(1)} yrs` : "N/A"} sub={results.wBE != null ? `Month ${results.wBE}` : "Not within horizon"} />
                  <Stat label="Wealth Difference" value={fmt(Math.abs(fBDisplay - fRDisplay))} sub={fBDisplay >= fRDisplay ? "Buy advantage" : "Rent advantage"} accent />
                </>
              ) : (
                <>
                  <Stat label="Cost Break-Even" value={results.costBE != null ? `${(results.costBE / 12).toFixed(1)} yrs` : "N/A"} sub="When total buy cost < total rent" />
                  <Stat label="Monthly: Buy (Yr 1)" value={fmt(Math.round(pmtCalc(results.loanAmount, runConfig.fixedRate, runConfig.mortgageTerm) + results.ongoingMonthly))} sub={`Mortgage + ${fmt(results.ongoingMonthly)} ongoing`} />
                  <Stat label="Monthly: Rent (Yr 1)" value={fmt(runConfig.monthlyRent)} sub={`Rising ${runConfig.rentInflation}% p.a.`} />
                  <Stat label="Difference (Yr 1)" value={fmt(Math.abs(Math.round(pmtCalc(results.loanAmount, runConfig.fixedRate, runConfig.mortgageTerm) + results.ongoingMonthly) - runConfig.monthlyRent))} sub={`${Math.round(pmtCalc(results.loanAmount, runConfig.fixedRate, runConfig.mortgageTerm) + results.ongoingMonthly) > runConfig.monthlyRent ? "Buy costs more" : "Rent costs more"}/mo`} accent />
                </>
              )}
            </div>

            {/* ── TABS ── */}
            <div className="flex gap-1 mb-6 flex-wrap items-center border-b border-border pb-4">
              {[
                { key: "longTerm", label: "Long-term: Wealth" },
                { key: "shortTerm", label: "Short-term: Should I buy?" },
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
            </div>

            {/* ── SHORT-TERM TAB ── */}
            {activeTab === "shortTerm" && (
              <div>
                <p className="text-[13px] font-serif text-muted-foreground leading-relaxed mb-6 italic max-w-3xl">
                  This tab tracks pure cash flow — how much money leaves your pocket each month and cumulatively.
                  It doesn't account for equity or investment gains, just spending. Most useful for 1–5 year affordability.
                </p>

                <div className={cn("grid gap-8", mobile ? "grid-cols-1" : "grid-cols-2")}>
                  {results.mC.length > 1 && (
                    <InteractiveChart
                      mobile={mobile}
                      data={results.mC.map((d) => ({ month: d.year * 12, buy: d.buy, rent: d.rent }))}
                      keys={["buy", "rent"]}
                      colors={["var(--success)", "var(--destructive)"]}
                      labels={["Monthly buy cost", "Monthly rent"]}
                      title="Monthly Outgoing — Buy vs Rent"
                      formatY={(v) => v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`}
                    />
                  )}
                  <InteractiveChart
                    mobile={mobile}
                    data={results.cD}
                    keys={["buyCost", "rentCost"]}
                    colors={["var(--success)", "var(--destructive)"]}
                    labels={["Net buy cost", "Cumulative rent"]}
                    title="Cumulative Net Cost"
                    breakEvenMonth={results.costBE}
                    annotation={results.costBE ? `Break-even: Yr ${(results.costBE / 12).toFixed(1)}` : undefined}
                  />
                </div>

                <SensitivityTable
                  mobile={mobile}
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

            {/* ── LONG-TERM TAB ── */}
            {activeTab === "longTerm" && (
              <div>
                <p className="text-[13px] font-serif text-muted-foreground leading-relaxed mb-6 italic max-w-3xl">
                  This tab tracks your total financial position — not just what you spend, but what you end up with.
                  For buyers, that's property equity minus selling costs plus any invested surplus. For renters, it's
                  the portfolio built by investing the deposit and any monthly savings.
                </p>

                {/* Inflation controls — compact inline */}
                <div className="flex flex-wrap gap-5 items-end mb-6 px-4 py-3.5 bg-card border border-border">
                  <div className="w-[155px]">
                    <Field label="Assumed Inflation" value={inflationRate} onChange={setInflationRate} suffix="% p.a." tip="Bank of England target is 2%. Over 25 years at 2%, the discount is ~40%." />
                  </div>
                  <div>
                    <Toggle
                      label="Show in today's money (inflation-adjusted)"
                      value={inflationAdjusted}
                      onChange={setInflationAdjusted}
                      tip="Inflation-adjusted values show what your future wealth would be worth in today's purchasing power."
                    />
                  </div>
                </div>

                <InteractiveChart
                  mobile={mobile}
                  data={inflationAdjusted ? inflationAdjustedWD : results.wD}
                  keys={["buyWealth", "rentWealth"]}
                  colors={["var(--success)", "var(--destructive)"]}
                  labels={["Buy (net equity)", "Rent + invest"]}
                  title="Wealth Over Time"
                  markers={wealthMarkers}
                  inflationAdjusted={inflationAdjusted}
                />

                <WealthNarrative
                  wD={inflationAdjusted ? inflationAdjustedWD : results.wD}
                  config={runConfig}
                />
              </div>
            )}

            <HowWeCalculate config={runConfig} results={results} inflationRate={inflationRate} inflationAdjusted={inflationAdjusted} />
          </>
        )}

        {/* ── Footer ── */}
        <div className="mt-12 border-t-2 border-foreground pt-4 flex justify-between">
          <span className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase font-semibold">Personal Finance Suite</span>
          <span className="text-[10px] text-muted-foreground/50 tracking-[0.15em] uppercase">Rent vs Buy</span>
        </div>

      </div>
    </div>
  );
}
