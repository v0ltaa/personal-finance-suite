import { useState, useEffect, useMemo } from "react";
import { C, fonts, fmt, hpPresets, invPresets } from "../lib/tokens";
import { runProjection, calcStampDuty, pmtCalc, defaultConfig } from "../lib/calc";
import { useIsMobile, useAuth, useInflationSettings } from "../lib/hooks";
import { loadScenarios, loadProperties } from "../lib/supabase";
import Field from "../components/Field";
import PresetSelector from "../components/PresetSelector";
import InteractiveChart from "../components/InteractiveChart";
import SensitivityTable from "../components/SensitivityTable";
import Stat from "../components/Stat";
import Tip from "../components/Tip";
import Toggle from "../components/Toggle";

function ScenarioPicker({ title, scenarios, selected, onSelect, loading }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, fontFamily: fonts.sans, marginBottom: 10 }}>
        {title}
      </div>
      {loading && <div style={{ fontSize: 13, color: C.textLight, fontFamily: fonts.serif }}>Loading...</div>}
      {!loading && scenarios.length === 0 && (
        <div style={{ padding: "12px 16px", border: `1.5px dashed ${C.border}`, fontSize: 12, fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>
          No saved scenarios. Configure and save one in Buy Scenario.
        </div>
      )}
      {!loading && scenarios.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {scenarios.map((s) => {
            const isSelected = selected?.id === s.id;
            const hasPhoto = s.config?.propertyPhotoUrl;
            return (
              <button key={s.id} onClick={() => onSelect(isSelected ? null : s)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                border: `1.5px solid ${isSelected ? C.text : C.border}`,
                borderRadius: 0,
                background: isSelected ? C.text : "transparent",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                <div style={{
                  width: 30, height: 30, flexShrink: 0,
                  background: isSelected ? C.accentLight : C.bg,
                  border: `1px solid ${isSelected ? C.border : C.borderLight}`,
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {hasPhoto ? (
                    <img src={s.config.propertyPhotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSelected ? C.bg : C.textFaint} strokeWidth="1.5">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.serif, fontSize: 13, color: isSelected ? C.bg : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.config?.propertyName || s.name}
                  </div>
                  <div style={{ fontFamily: fonts.sans, fontSize: 10, color: isSelected ? C.bg : C.textLight, marginTop: 1 }}>
                    {s.name}
                  </div>
                </div>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
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
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, fontFamily: fonts.sans, marginBottom: 10 }}>
        Flat to Rent
      </div>
      {loading && <div style={{ fontSize: 13, color: C.textLight, fontFamily: fonts.serif }}>Loading...</div>}
      {!loading && flats.length === 0 && (
        <div style={{ padding: "12px 16px", border: `1.5px dashed ${C.border}`, fontSize: 12, fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>
          No saved flats. Add one in Gaff Tracker.
        </div>
      )}
      {!loading && flats.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {flats.map((f) => {
            const isSelected = selected?.id === f.id;
            return (
              <button key={f.id} onClick={() => onSelect(isSelected ? null : f)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                border: `1.5px solid ${isSelected ? C.text : C.border}`,
                borderRadius: 0,
                background: isSelected ? C.text : "transparent",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                <div style={{
                  width: 30, height: 30, flexShrink: 0,
                  background: isSelected ? C.accentLight : C.bg,
                  border: `1px solid ${isSelected ? C.border : C.borderLight}`,
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {f.photo_url ? (
                    <img src={f.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSelected ? C.bg : C.textFaint} strokeWidth="1.5">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.serif, fontSize: 13, color: isSelected ? C.bg : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </div>
                  <div style={{ fontFamily: fonts.sans, fontSize: 10, color: isSelected ? C.bg : C.textLight, marginTop: 1 }}>
                    {f.price ? `${fmt(f.price)}/mo` : "No price set"}{f.location ? ` · ${f.location}` : ""}
                  </div>
                </div>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
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
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, marginBottom: 12 }}>Rent vs Buy</h2>
        <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>Sign in to save and compare scenarios.</p>
      </div>
    );
  }

  const dividerStyle = { fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, fontFamily: fonts.sans, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 20 };

  return (
    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "300px 1fr", gap: mobile ? 32 : 40, alignItems: "start" }}>

      {/* ══ LEFT: INPUTS ══ */}
      <div style={{ position: mobile ? "static" : "sticky", top: 80 }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, margin: "0 0 24px 0", fontSize: 22 }}>Rent vs Buy</h2>

        <ScenarioPicker title="Buy Scenario" scenarios={buyScenarios} selected={selectedBuy} onSelect={setSelectedBuy} loading={loading} />
        <FlatPicker flats={flats} selected={selectedFlat} onSelect={handleSelectFlat} loading={loading} />

        {/* Assumptions */}
        <div>
          <div style={dividerStyle}>Assumptions</div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", marginBottom: 10, fontFamily: fonts.sans }}>
              House Price Growth <Tip text="Annual property value increase. UK long-term avg ~3.5%." />
            </label>
            <PresetSelector presets={hpPresets} value={houseGrowth} onChange={setHouseGrowth} mobile={true} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", marginBottom: 10, fontFamily: fonts.sans }}>
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
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: 320, border: `1.5px dashed ${C.border}`,
            flexDirection: "column", gap: 12, padding: 40,
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.textFaint} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/>
            </svg>
            <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", textAlign: "center", margin: 0 }}>
              Select a buy scenario and a flat on the left to see the analysis.
            </p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{
              display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap",
              padding: "12px 16px", background: C.card, border: `1px solid ${C.borderLight}`,
              fontSize: 11, fontFamily: fonts.sans, color: C.textMid,
            }}>
              <span><strong style={{ color: C.text }}>{selectedBuy?.config?.propertyName || selectedBuy?.name}</strong> vs <strong style={{ color: C.text }}>{selectedFlat?.name}</strong> ({fmt(runConfig.monthlyRent)}/mo)</span>
              <span style={{ color: C.borderLight }}>|</span>
              <span>Growth {runConfig.houseGrowth}% · Invest {runConfig.investReturn}% · {runConfig.horizonYears}yr</span>
            </div>

            {/* Tabs + export */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { key: "shortTerm", label: "Short-term: Should I buy?" },
                { key: "longTerm", label: "Long-term: Wealth" },
              ].map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  padding: "9px 18px",
                  border: `1.5px solid ${activeTab === t.key ? C.text : C.border}`,
                  borderRadius: 0, background: activeTab === t.key ? C.text : "transparent",
                  color: activeTab === t.key ? C.bg : C.textMid,
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
                  letterSpacing: "0.02em", transition: "all 0.15s",
                }}>{t.label}</button>
              ))}
              <button onClick={exportCSV} style={{
                marginLeft: "auto", padding: "9px 14px", border: `1.5px solid ${C.border}`,
                borderRadius: 0, background: "transparent", color: C.textMid,
                fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
                textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
            </div>

            {/* Short-term */}
            {activeTab === "shortTerm" && (
              <div>
                <div style={{
                  borderLeft: `4px solid ${results.costBE != null ? C.green : C.red}`,
                  background: results.costBE != null ? C.greenBg : C.redBg,
                  padding: "16px 20px 16px 24px", marginBottom: 24,
                }}>
                  <div style={{ fontSize: 20, fontFamily: fonts.serif, fontWeight: 400, color: results.costBE != null ? C.green : C.red, marginBottom: 6 }}>
                    {results.costBE != null ? `Buying breaks even after ${(results.costBE / 12).toFixed(1)} years` : `Renting costs less over ${horizonYears} years`}
                  </div>
                  <p style={{ fontSize: 13, fontFamily: fonts.serif, color: C.textMid, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                    {results.costBE != null
                      ? `Sell before year ${(results.costBE / 12).toFixed(1)} and you'll have spent more buying than renting.`
                      : `Over ${horizonYears} years, total buying costs exceed cumulative rent.`}
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 24 }}>
                  <Stat mobile={false} label="Cost Break-Even" value={results.costBE != null ? `${(results.costBE / 12).toFixed(1)} yrs` : "N/A"} sub="When total buy cost < total rent" />
                  <Stat mobile={false} label="Monthly: Buy (Yr 1)" value={fmt(Math.round(pmtCalc(results.loanAmount, runConfig.fixedRate, runConfig.mortgageTerm) + results.ongoingMonthly))} sub={`Mortgage + ${fmt(results.ongoingMonthly)} ongoing`} />
                  <Stat mobile={false} label="Monthly: Rent (Yr 1)" value={fmt(runConfig.monthlyRent)} sub={`Rising ${runConfig.rentInflation}% p.a.`} />
                </div>

                {results.mC.length > 1 && (
                  <InteractiveChart mobile={false}
                    data={results.mC.map((d) => ({ month: d.year * 12, buy: d.buy, rent: d.rent }))}
                    keys={["buy", "rent"]} colors={[C.green, C.red]}
                    labels={["Monthly buy cost", "Monthly rent"]}
                    title="Monthly Outgoing — Buy vs Rent"
                    formatY={(v) => v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`}
                  />
                )}

                <InteractiveChart mobile={false} data={results.cD} keys={["buyCost", "rentCost"]} colors={[C.green, C.red]}
                  labels={["Net buy cost", "Cumulative rent"]}
                  title="Cumulative Net Cost"
                  breakEvenMonth={results.costBE}
                  annotation={results.costBE ? `Break-even: Yr ${(results.costBE / 12).toFixed(1)}` : undefined}
                />

                <SensitivityTable mobile={false}
                  propertyValue={runConfig.propertyValue} totalUpfront={results.totalUpfront}
                  loanAmount={results.loanAmount} fixedRate={runConfig.fixedRate} mortgageTerm={runConfig.mortgageTerm}
                  fixedPeriod={runConfig.fixedPeriod} revertRate={runConfig.revertRate} monthlyRent={runConfig.monthlyRent}
                  rentInflation={runConfig.rentInflation} ongoingMonthly={results.ongoingMonthly} houseGrowth={runConfig.houseGrowth}
                  estateAgentPct={runConfig.estateAgentPct} sellingConveyancing={runConfig.sellingConveyancing} epcCost={runConfig.epcCost}
                />
              </div>
            )}

            {/* Long-term */}
            {activeTab === "longTerm" && (
              <div>
                {(() => {
                  const d = fBDisplay - fRDisplay, bw = d > 0;
                  return (
                    <div style={{
                      borderLeft: `4px solid ${bw ? C.green : C.red}`,
                      background: bw ? C.greenBg : C.redBg,
                      padding: "16px 20px 16px 24px", marginBottom: 24,
                    }}>
                      <div style={{ fontSize: 20, fontFamily: fonts.serif, fontWeight: 400, color: bw ? C.green : C.red, marginBottom: 6 }}>
                        {bw ? "Buying" : "Renting + investing"} builds more wealth over {horizonYears} years
                        {inflationAdjusted && <span style={{ fontSize: 14, color: C.accent, marginLeft: 10 }}>(in today's £)</span>}
                      </div>
                      <p style={{ fontSize: 13, fontFamily: fonts.serif, color: C.textMid, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                        {bw
                          ? `Buying leaves you ${fmt(Math.abs(d))} wealthier${inflationAdjusted ? " in today's purchasing power" : ""}.${results.wBE ? ` Crossover at year ${(results.wBE / 12).toFixed(1)}.` : ""}`
                          : `Renting and investing at ${investReturn}% leaves you ${fmt(Math.abs(d))} ahead${inflationAdjusted ? " in today's purchasing power" : ""}.${results.wBE ? ` Buying catches up at year ${(results.wBE / 12).toFixed(1)}.` : " Buying doesn't catch up."}`}
                      </p>
                    </div>
                  );
                })()}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
                  <Stat mobile={false} label="Buy: Net Equity" value={fmt(fBDisplay)} sub={inflationAdjusted ? "In today's purchasing power" : "After mortgage & selling costs"} />
                  <Stat mobile={false} label="Rent: Portfolio" value={fmt(fRDisplay)} sub={inflationAdjusted ? "In today's purchasing power" : `Deposit + savings at ${investReturn}%`} />
                  <Stat mobile={false} label="Wealth Break-Even" value={results.wBE != null ? `${(results.wBE / 12).toFixed(1)} yrs` : "N/A"} sub={results.wBE != null ? `Month ${results.wBE}` : "Not within horizon"} />
                </div>

                {/* Inflation controls */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", marginBottom: 20, padding: "14px 16px", background: C.card, border: `1px solid ${C.borderLight}` }}>
                  <div style={{ width: 155 }}>
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

                <InteractiveChart mobile={false} data={inflationAdjusted ? inflationAdjustedWD : results.wD} keys={["buyWealth", "rentWealth"]}
                  colors={[C.green, C.red]} labels={["Buy (net equity)", "Rent + invest"]}
                  title="Wealth Over Time" breakEvenMonth={results.wBE}
                  inflationAdjusted={inflationAdjusted}
                />
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, borderTop: `2px solid ${C.text}`, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: C.textLight, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>Personal Finance Suite</span>
          <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>Rent vs Buy</span>
        </div>
      </div>
    </div>
  );
}
