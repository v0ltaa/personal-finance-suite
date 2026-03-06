import { useState, useMemo } from "react";
import { C, fonts, fmt, fmtK, hpPresets, invPresets } from "../lib/tokens";
import { calcStampDuty, pmtCalc, runProjection, defaultConfig } from "../lib/calc";
import { useIsMobile, useAuth } from "../lib/hooks";
import Field from "../components/Field";
import Toggle from "../components/Toggle";
import PresetSelector from "../components/PresetSelector";
import Section from "../components/Section";
import SummaryBar from "../components/SummaryBar";
import Stat from "../components/Stat";
import InteractiveChart from "../components/InteractiveChart";
import SensitivityTable from "../components/SensitivityTable";
import Tip from "../components/Tip";
import { SaveDialog, LoadDialog } from "../components/ScenarioManager";

export default function BuyVsRent() {
  const mobile = useIsMobile();
  const { user } = useAuth();

  // Slider mode toggle
  const [sliderMode, setSliderMode] = useState(false);

  // All input state
  const [propertyValue, setPropertyValue] = useState(defaultConfig.propertyValue);
  const [depositMode, setDepositMode] = useState(defaultConfig.depositMode);
  const [depositPct, setDepositPct] = useState(defaultConfig.depositPct);
  const [depositCash, setDepositCash] = useState(defaultConfig.depositCash);
  const [mortgageTerm, setMortgageTerm] = useState(defaultConfig.mortgageTerm);
  const [fixedRate, setFixedRate] = useState(defaultConfig.fixedRate);
  const [fixedPeriod, setFixedPeriod] = useState(defaultConfig.fixedPeriod);
  const [revertRate, setRevertRate] = useState(defaultConfig.revertRate);
  const [monthlyRent, setMonthlyRent] = useState(defaultConfig.monthlyRent);
  const [rentInflation, setRentInflation] = useState(defaultConfig.rentInflation);
  const [isFirstTimeBuyer, setIsFirstTimeBuyer] = useState(defaultConfig.isFirstTimeBuyer);
  const [stampDutyOverride, setStampDutyOverride] = useState(defaultConfig.stampDutyOverride);
  const [solicitorFees, setSolicitorFees] = useState(defaultConfig.solicitorFees);
  const [surveyFees, setSurveyFees] = useState(defaultConfig.surveyFees);
  const [movingCosts, setMovingCosts] = useState(defaultConfig.movingCosts);
  const [maintenance, setMaintenance] = useState(defaultConfig.maintenance);
  const [serviceCharge, setServiceCharge] = useState(defaultConfig.serviceCharge);
  const [buildingsInsurance, setBuildingsInsurance] = useState(defaultConfig.buildingsInsurance);
  const [lifeInsurance, setLifeInsurance] = useState(defaultConfig.lifeInsurance);
  const [boilerCover, setBoilerCover] = useState(defaultConfig.boilerCover);
  const [groundRent, setGroundRent] = useState(defaultConfig.groundRent);
  const [estateAgentPct, setEstateAgentPct] = useState(defaultConfig.estateAgentPct);
  const [sellingConveyancing, setSellingConveyancing] = useState(defaultConfig.sellingConveyancing);
  const [epcCost, setEpcCost] = useState(defaultConfig.epcCost);
  const [houseGrowth, setHouseGrowth] = useState(defaultConfig.houseGrowth);
  const [investReturn, setInvestReturn] = useState(defaultConfig.investReturn);
  const [horizonYears, setHorizonYears] = useState(defaultConfig.horizonYears);
  const [activeTab, setActiveTab] = useState("shortTerm");

  // Save/load dialogs
  const [saveDialog, setSaveDialog] = useState(null); // { section, config }
  const [loadDialog, setLoadDialog] = useState(null); // section string

  // Derived values
  const deposit = depositMode === "pct" ? propertyValue * (depositPct / 100) : depositCash;
  const effectivePct = depositMode === "cash" ? (depositCash / propertyValue) * 100 : depositPct;
  const loanAmount = Math.max(0, propertyValue - deposit);
  const autoSD = calcStampDuty(propertyValue, isFirstTimeBuyer);
  const stampDuty = stampDutyOverride != null ? stampDutyOverride : autoSD;
  const totalUpfront = deposit + stampDuty + solicitorFees + surveyFees + movingCosts;
  const ongoingMonthly = maintenance + serviceCharge + buildingsInsurance + lifeInsurance + boilerCover + groundRent;

  const results = useMemo(() => runProjection({
    propertyValue, deposit, mortgageTerm, fixedRate, fixedPeriod, revertRate,
    monthlyRent, rentInflation, stampDuty, solicitorFees, surveyFees, movingCosts,
    maintenance, serviceCharge, buildingsInsurance, lifeInsurance, boilerCover, groundRent,
    estateAgentPct, sellingConveyancing, epcCost, houseGrowth, investReturn, horizonYears,
  }), [propertyValue, deposit, mortgageTerm, fixedRate, fixedPeriod, revertRate, monthlyRent, rentInflation, stampDuty, solicitorFees, surveyFees, movingCosts, maintenance, serviceCharge, buildingsInsurance, lifeInsurance, boilerCover, groundRent, estateAgentPct, sellingConveyancing, epcCost, houseGrowth, investReturn, horizonYears]);

  const fB = results.wD.length > 0 ? results.wD[results.wD.length - 1].buyWealth : 0;
  const fR = results.wD.length > 0 ? results.wD[results.wD.length - 1].rentWealth : 0;

  const grid = {
    display: "grid",
    gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(155px, 1fr))",
    gap: mobile ? "16px" : "20px 32px",
  };

  // Build config object for a section
  const getFullConfig = () => ({
    propertyValue, depositMode, depositPct, depositCash, mortgageTerm, fixedRate, fixedPeriod, revertRate,
    monthlyRent, rentInflation, isFirstTimeBuyer, stampDutyOverride, solicitorFees, surveyFees, movingCosts,
    maintenance, serviceCharge, buildingsInsurance, lifeInsurance, boilerCover, groundRent,
    estateAgentPct, sellingConveyancing, epcCost, houseGrowth, investReturn, horizonYears,
  });

  const getSectionConfig = (section) => {
    const full = getFullConfig();
    const sectionKeys = {
      property: ["propertyValue", "depositMode", "depositPct", "depositCash", "mortgageTerm", "fixedRate", "fixedPeriod", "revertRate"],
      rent: ["monthlyRent", "rentInflation"],
      upfront: ["isFirstTimeBuyer", "stampDutyOverride", "solicitorFees", "surveyFees", "movingCosts"],
      ongoing: ["maintenance", "serviceCharge", "buildingsInsurance", "lifeInsurance", "boilerCover", "groundRent"],
      selling: ["estateAgentPct", "sellingConveyancing", "epcCost"],
      assumptions: ["houseGrowth", "investReturn", "horizonYears"],
      full: Object.keys(full),
    };
    const keys = sectionKeys[section] || Object.keys(full);
    const config = {};
    for (const k of keys) config[k] = full[k];
    return config;
  };

  const applySectionConfig = (config) => {
    const setters = {
      propertyValue: setPropertyValue, depositMode: setDepositMode, depositPct: setDepositPct,
      depositCash: setDepositCash, mortgageTerm: setMortgageTerm, fixedRate: setFixedRate,
      fixedPeriod: setFixedPeriod, revertRate: setRevertRate, monthlyRent: setMonthlyRent,
      rentInflation: setRentInflation, isFirstTimeBuyer: setIsFirstTimeBuyer,
      stampDutyOverride: setStampDutyOverride, solicitorFees: setSolicitorFees,
      surveyFees: setSurveyFees, movingCosts: setMovingCosts, maintenance: setMaintenance,
      serviceCharge: setServiceCharge, buildingsInsurance: setBuildingsInsurance,
      lifeInsurance: setLifeInsurance, boilerCover: setBoilerCover, groundRent: setGroundRent,
      estateAgentPct: setEstateAgentPct, sellingConveyancing: setSellingConveyancing,
      epcCost: setEpcCost, houseGrowth: setHouseGrowth, investReturn: setInvestReturn,
      horizonYears: setHorizonYears,
    };
    for (const [k, v] of Object.entries(config)) {
      if (setters[k]) setters[k](v);
    }
  };

  const handleSave = (section) => setSaveDialog({ section, config: getSectionConfig(section) });
  const handleLoad = (section) => setLoadDialog(section);

  // CSV export
  const exportCSV = () => {
    let csv, filename;
    if (activeTab === "shortTerm") {
      csv = "Month,Year,Net Buy Cost,Cumulative Rent\n" +
        results.cD.map((d) => `${d.month},${(d.month / 12).toFixed(2)},${Math.round(d.buyCost)},${Math.round(d.rentCost)}`).join("\n");
      filename = "buy-vs-rent-costs.csv";
    } else {
      csv = "Month,Year,Buy Wealth,Rent+Invest Wealth\n" +
        results.wD.map((d) => `${d.month},${(d.month / 12).toFixed(2)},${Math.round(d.buyWealth)},${Math.round(d.rentWealth)}`).join("\n");
      filename = "buy-vs-rent-wealth.csv";
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const canSave = !!user;

  return (
    <>
      {/* Slider mode toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Toggle label="Slider mode" value={sliderMode} onChange={setSliderMode} tip="Show range sliders under each input for quick adjustments." />
        {canSave && (
          <button onClick={() => handleSave("full")} style={{
            marginLeft: "auto", padding: "6px 14px", border: `1.5px solid ${C.accent}`,
            borderRadius: 0, background: C.accentLight, color: C.accent,
            fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Save All Inputs</button>
        )}
      </div>

      {/* ═══ INPUTS ═══ */}
      <Section title="Property & Mortgage" canSave={canSave}
        onSave={() => handleSave("property")} onLoad={() => handleLoad("property")}>
        <div style={grid}>
          <Field label="Property Value" prefix="£" value={propertyValue} onChange={setPropertyValue} tip="The purchase price of the property you're considering." sliderMode={sliderMode} fieldKey="propertyValue" />
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
          <Field label="Mortgage Term" suffix="yrs" value={mortgageTerm} onChange={setMortgageTerm} tip="Total mortgage length. UK standard 25 years, 30–35 increasingly common." sliderMode={sliderMode} fieldKey="mortgageTerm" />
          <Field label="Fixed Rate" suffix="%" value={fixedRate} onChange={setFixedRate} tip="Locked-in rate during the initial fixed period." sliderMode={sliderMode} fieldKey="fixedRate" />
          <Field label="Fixed Period" suffix="yrs" value={fixedPeriod} onChange={setFixedPeriod} tip="How long the fixed rate lasts (typically 2 or 5 years)." sliderMode={sliderMode} fieldKey="fixedPeriod" />
          <Field label="Revert Rate" suffix="%" value={revertRate} onChange={setRevertRate} tip="Lender's SVR after the fixed period. Models worst case — you'd normally remortgage." sliderMode={sliderMode} fieldKey="revertRate" />
        </div>
        <SummaryBar>Loan: {fmt(loanAmount)} · Deposit: {fmt(deposit)} ({effectivePct.toFixed(1)}%) · LTV: {(100 - effectivePct).toFixed(1)}%</SummaryBar>
      </Section>

      <Section title="Rent Comparison" canSave={canSave}
        onSave={() => handleSave("rent")} onLoad={() => handleLoad("rent")}>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: mobile ? "16px" : "20px 32px" }}>
          <Field label="Monthly Rent" prefix="£" value={monthlyRent} onChange={setMonthlyRent} tip="Monthly rent for a comparable property." sliderMode={sliderMode} fieldKey="monthlyRent" />
          <Field label="Rent Inflation" suffix="% p.a." value={rentInflation} onChange={setRentInflation} tip="Annual rent increase. UK cities: 4–8% recently, long-term avg 2–3%." sliderMode={sliderMode} fieldKey="rentInflation" />
        </div>
      </Section>

      <Section title="Upfront Buying Costs" defaultOpen={false} canSave={canSave}
        onSave={() => handleSave("upfront")} onLoad={() => handleLoad("upfront")}>
        <div style={{ marginBottom: 16 }}>
          <Toggle label="First-time buyer" value={isFirstTimeBuyer} onChange={setIsFirstTimeBuyer} tip="FTBs pay no stamp duty up to £425k, reduced rates up to £625k." />
        </div>
        <div style={grid}>
          <Field label={`Stamp Duty ${stampDutyOverride == null ? "(auto)" : "(manual)"}`} prefix="£" value={stampDutyOverride != null ? stampDutyOverride : Math.round(autoSD)} onChange={(v) => setStampDutyOverride(v)} tip="Auto-calculated. Edit to override if thresholds changed." sliderMode={sliderMode} />
          <Field label="Solicitor Fees" prefix="£" value={solicitorFees} onChange={setSolicitorFees} tip="Conveyancing. Usually £1,000–£2,000." sliderMode={sliderMode} fieldKey="solicitorFees" />
          <Field label="Survey" prefix="£" value={surveyFees} onChange={setSurveyFees} tip="Homebuyer's report. Level 2: £400–£700." sliderMode={sliderMode} fieldKey="surveyFees" />
          <Field label="Moving Costs" prefix="£" value={movingCosts} onChange={setMovingCosts} tip="Removal van, packing, everything else." sliderMode={sliderMode} fieldKey="movingCosts" />
        </div>
        {stampDutyOverride != null && (
          <div onClick={() => setStampDutyOverride(null)} style={{ marginTop: 10, fontSize: 12, color: C.accent, cursor: "pointer", fontFamily: fonts.sans, fontWeight: 600 }}>↩ Reset to auto ({fmt(autoSD)})</div>
        )}
        <SummaryBar>Total upfront: {fmt(totalUpfront)}</SummaryBar>
      </Section>

      <Section title="Owner-Only Monthly Costs" defaultOpen={false} canSave={canSave}
        onSave={() => handleSave("ongoing")} onLoad={() => handleLoad("ongoing")}>
        <p style={{ fontSize: 13, color: C.textMid, marginBottom: 20, fontFamily: fonts.serif, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 20px 0" }}>
          Costs only homeowners pay. Renters don't pay these directly.
        </p>
        <div style={grid}>
          <Field label="Maintenance" prefix="£" value={maintenance} onChange={setMaintenance} tip="Monthly repair budget. ~1% of property value per year." sliderMode={sliderMode} fieldKey="maintenance" />
          <Field label="Service Charge" prefix="£" value={serviceCharge} onChange={setServiceCharge} tip="For flats: communal areas, management. £0 for freehold." sliderMode={sliderMode} fieldKey="serviceCharge" />
          <Field label="Buildings Insurance" prefix="£" value={buildingsInsurance} onChange={setBuildingsInsurance} tip="Covers structure. Required by lender. £15–£40/mo." sliderMode={sliderMode} fieldKey="buildingsInsurance" />
          <Field label="Life / Mortgage Protection" prefix="£" value={lifeInsurance} onChange={setLifeInsurance} tip="Pays off mortgage if you die or can't work." sliderMode={sliderMode} fieldKey="lifeInsurance" />
          <Field label="Boiler / Home Cover" prefix="£" value={boilerCover} onChange={setBoilerCover} tip="Emergency cover. Optional, £10–£25/mo." sliderMode={sliderMode} fieldKey="boilerCover" />
          <Field label="Ground Rent" prefix="£" value={groundRent} onChange={setGroundRent} tip="Leasehold only. New builds: £0 under 2022 law." sliderMode={sliderMode} fieldKey="groundRent" />
        </div>
        <SummaryBar>Monthly owner costs: {fmt(ongoingMonthly)}</SummaryBar>
      </Section>

      <Section title="Selling Costs" defaultOpen={false} canSave={canSave}
        onSave={() => handleSave("selling")} onLoad={() => handleLoad("selling")}>
        <p style={{ fontSize: 13, color: C.textMid, marginBottom: 20, fontFamily: fonts.serif, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 20px 0" }}>
          Deducted from equity. Without these, buying looks artificially better on short horizons.
        </p>
        <div style={grid}>
          <Field label="Estate Agent Fee" suffix="% + VAT" value={estateAgentPct} onChange={setEstateAgentPct} tip="High-street: 1–1.5% + 20% VAT." sliderMode={sliderMode} fieldKey="estateAgentPct" />
          <Field label="Selling Conveyancing" prefix="£" value={sellingConveyancing} onChange={setSellingConveyancing} tip="Legal fees for sale. £1,000–£1,500." sliderMode={sliderMode} fieldKey="sellingConveyancing" />
          <Field label="EPC Certificate" prefix="£" value={epcCost} onChange={setEpcCost} tip="Required before listing. £60–£120." sliderMode={sliderMode} fieldKey="epcCost" />
        </div>
        <SummaryBar>Selling cost at current value: ~{fmt(Math.round(propertyValue * (estateAgentPct * 1.2 / 100) + sellingConveyancing + epcCost))}</SummaryBar>
      </Section>

      <Section title="Assumptions" canSave={canSave}
        onSave={() => handleSave("assumptions")} onLoad={() => handleLoad("assumptions")}>
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
          <Field label="Time Horizon" suffix="yrs" value={horizonYears} onChange={setHorizonYears} tip="3–5 years short-term, 15–25 long-term." sliderMode={sliderMode} fieldKey="horizonYears" />
        </div>
      </Section>

      {/* ═══ RESULTS ═══ */}
      <div style={{ borderTop: `2px solid ${C.text}`, paddingTop: 32, marginTop: 8 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
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
          <button onClick={exportCSV} style={{
            marginLeft: "auto", padding: "10px 18px", border: `1.5px solid ${C.border}`,
            borderRadius: 0, background: "transparent", color: C.textMid,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
            letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
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
              <InteractiveChart mobile={mobile}
                data={results.mC.map((d) => ({ month: d.year * 12, buy: d.buy, rent: d.rent }))}
                keys={["buy", "rent"]} colors={[C.green, C.red]}
                labels={["Monthly buy cost", "Monthly rent"]}
                title="Monthly Outgoing — Buy vs Rent"
                formatY={(v) => v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`}
              />
            )}

            <InteractiveChart mobile={mobile} data={results.cD} keys={["buyCost", "rentCost"]} colors={[C.green, C.red]}
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

            <InteractiveChart mobile={mobile} data={results.wD} keys={["buyWealth", "rentWealth"]}
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
        <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>Buy vs Rent</span>
      </div>

      {/* Save/Load dialogs */}
      {saveDialog && <SaveDialog section={saveDialog.section} config={saveDialog.config} onClose={() => setSaveDialog(null)} />}
      {loadDialog && <LoadDialog section={loadDialog} onLoad={applySectionConfig} onClose={() => setLoadDialog(null)} />}
    </>
  );
}
