import { useState, useMemo } from "react";
import { C, fonts, fmt, hpPresets, invPresets } from "../lib/tokens";
import { calcStampDuty, pmtCalc, defaultConfig } from "../lib/calc";
import { useIsMobile, useAuth } from "../lib/hooks";
import Field from "../components/Field";
import Toggle from "../components/Toggle";
import Section from "../components/Section";
import SummaryBar from "../components/SummaryBar";
import Tip from "../components/Tip";
import { SaveDialog, LoadDialog } from "../components/ScenarioManager";

// ── Sub-group label inside the big buy accordion ──
function SubGroup({ title, children, style }) {
  return (
    <div style={{ marginBottom: 32, ...style }}>
      <div style={{
        fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
        color: C.textFaint, fontWeight: 700, fontFamily: fonts.sans,
        borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 8, marginBottom: 20,
      }}>{title}</div>
      {children}
    </div>
  );
}

// ── Big property accordion ──
function BuyPropertyPanel({ open, onToggle, name, photoUrl, canSave, onSave, onLoad, children, mobile }) {
  return (
    <div style={{ marginBottom: 36 }}>
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 16,
          background: C.card, border: `1.5px solid ${open ? C.text : C.border}`,
          padding: mobile ? "16px 16px" : "20px 24px",
          cursor: "pointer", userSelect: "none",
          transition: "border-color 0.2s",
        }}
        onClick={onToggle}
      >
        {/* House photo */}
        <div style={{
          width: mobile ? 56 : 72, height: mobile ? 56 : 72,
          flexShrink: 0, background: C.bg, border: `1.5px solid ${C.borderLight}`,
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {photoUrl ? (
            <img src={photoUrl} alt="Property" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          )}
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, fontFamily: fonts.sans, marginBottom: 4 }}>
            Buy Scenario
          </div>
          <div style={{ fontSize: mobile ? 20 : 26, fontFamily: fonts.serif, fontWeight: 400, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name || "My Property"}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {canSave && (
            <>
              <button onClick={onSave} style={{
                padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 0,
                background: "transparent", fontSize: 9, fontFamily: fonts.sans, fontWeight: 700,
                color: C.textLight, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
              }}>Save</button>
              <button onClick={onLoad} style={{
                padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 0,
                background: "transparent", fontSize: 9, fontFamily: fonts.sans, fontWeight: 700,
                color: C.textLight, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
              }}>Load</button>
            </>
          )}
          <span style={{ color: C.textMid, fontSize: 18, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s", marginLeft: 4 }}>▾</span>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{
          border: `1.5px solid ${C.text}`, borderTop: "none",
          padding: mobile ? "24px 16px" : "32px 28px",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function BuyVsRent() {
  const mobile = useIsMobile();
  const { user } = useAuth();

  const [buyOpen, setBuyOpen] = useState(true);

  // Property identity
  const [propertyName, setPropertyName] = useState("My Property");
  const [propertyPhotoUrl, setPropertyPhotoUrl] = useState("");

  // Buy inputs
  const [propertyValue, setPropertyValue] = useState(defaultConfig.propertyValue);
  const [depositMode, setDepositMode] = useState(defaultConfig.depositMode);
  const [depositPct, setDepositPct] = useState(defaultConfig.depositPct);
  const [depositCash, setDepositCash] = useState(defaultConfig.depositCash);
  const [mortgageTerm, setMortgageTerm] = useState(defaultConfig.mortgageTerm);
  const [fixedRate, setFixedRate] = useState(defaultConfig.fixedRate);
  const [fixedPeriod, setFixedPeriod] = useState(defaultConfig.fixedPeriod);
  const [revertRate, setRevertRate] = useState(defaultConfig.revertRate);
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

  // Save/load dialogs
  const [saveDialog, setSaveDialog] = useState(null);
  const [loadDialog, setLoadDialog] = useState(null);

  // Derived
  const deposit = depositMode === "pct" ? propertyValue * (depositPct / 100) : depositCash;
  const effectivePct = depositMode === "cash" ? (depositCash / propertyValue) * 100 : depositPct;
  const loanAmount = Math.max(0, propertyValue - deposit);
  const autoSD = calcStampDuty(propertyValue, isFirstTimeBuyer);
  const stampDuty = stampDutyOverride != null ? stampDutyOverride : autoSD;
  const totalUpfront = deposit + stampDuty + solicitorFees + surveyFees + movingCosts;
  const ongoingMonthly = maintenance + serviceCharge + buildingsInsurance + lifeInsurance + boilerCover + groundRent;

  const canSave = !!user;

  const getBuyConfig = () => ({
    propertyName, propertyPhotoUrl,
    propertyValue, depositMode, depositPct, depositCash, mortgageTerm, fixedRate, fixedPeriod, revertRate,
    isFirstTimeBuyer, stampDutyOverride, solicitorFees, surveyFees, movingCosts,
    maintenance, serviceCharge, buildingsInsurance, lifeInsurance, boilerCover, groundRent,
    estateAgentPct, sellingConveyancing, epcCost,
  });

  const applyBuyConfig = (cfg) => {
    const setters = {
      propertyName: setPropertyName, propertyPhotoUrl: setPropertyPhotoUrl,
      propertyValue: setPropertyValue, depositMode: setDepositMode, depositPct: setDepositPct,
      depositCash: setDepositCash, mortgageTerm: setMortgageTerm, fixedRate: setFixedRate,
      fixedPeriod: setFixedPeriod, revertRate: setRevertRate,
      isFirstTimeBuyer: setIsFirstTimeBuyer, stampDutyOverride: setStampDutyOverride,
      solicitorFees: setSolicitorFees, surveyFees: setSurveyFees, movingCosts: setMovingCosts,
      maintenance: setMaintenance, serviceCharge: setServiceCharge,
      buildingsInsurance: setBuildingsInsurance, lifeInsurance: setLifeInsurance,
      boilerCover: setBoilerCover, groundRent: setGroundRent,
      estateAgentPct: setEstateAgentPct, sellingConveyancing: setSellingConveyancing, epcCost: setEpcCost,
    };
    for (const [k, v] of Object.entries(cfg)) { if (setters[k]) setters[k](v); }
  };

  const grid = {
    display: "grid",
    gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(155px, 1fr))",
    gap: mobile ? "16px" : "20px 32px",
  };

  return (
    <>
      {/* ══ BUY PROPERTY PANEL ══ */}
      <BuyPropertyPanel
        open={buyOpen} onToggle={() => setBuyOpen(!buyOpen)}
        name={propertyName} photoUrl={propertyPhotoUrl}
        canSave={canSave}
        onSave={() => setSaveDialog({ section: "buy", config: getBuyConfig() })}
        onLoad={() => setLoadDialog("buy")}
        mobile={mobile}
      >
        {/* Property Details */}
        <SubGroup title="Property Details">
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: mobile ? "16px" : "20px 32px" }}>
            <div>
              <label style={{ fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Property Name</label>
              <input
                type="text"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="e.g. 14 Oak Street"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  borderBottom: `1.5px solid ${C.border}`, color: C.text, fontSize: 18,
                  fontFamily: fonts.serif, padding: "8px 0", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                Photo URL
                <span style={{ fontWeight: 400, marginLeft: 6, color: C.textFaint }}>(from Flat Tracker)</span>
              </label>
              <input
                type="text"
                value={propertyPhotoUrl}
                onChange={(e) => setPropertyPhotoUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  borderBottom: `1.5px solid ${C.border}`, color: C.text, fontSize: 14,
                  fontFamily: fonts.sans, padding: "8px 0", boxSizing: "border-box", color: C.textMid,
                }}
              />
            </div>
          </div>
        </SubGroup>

        {/* Property & Mortgage */}
        <SubGroup title="Property & Mortgage">
          <div style={grid}>
            <Field label="Property Value" prefix="£" value={propertyValue} onChange={setPropertyValue} tip="The purchase price of the property you're considering." fieldKey="propertyValue" />
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
            <Field label="Mortgage Term" suffix="yrs" value={mortgageTerm} onChange={setMortgageTerm} tip="Total mortgage length. UK standard 25 years, 30–35 increasingly common." fieldKey="mortgageTerm" />
            <Field label="Fixed Rate" suffix="%" value={fixedRate} onChange={setFixedRate} tip="Locked-in rate during the initial fixed period." fieldKey="fixedRate" />
            <Field label="Fixed Period" suffix="yrs" value={fixedPeriod} onChange={setFixedPeriod} tip="How long the fixed rate lasts (typically 2 or 5 years)." fieldKey="fixedPeriod" />
            <Field label="Revert Rate" suffix="%" value={revertRate} onChange={setRevertRate} tip="Lender's SVR after the fixed period. Models worst case — you'd normally remortgage." fieldKey="revertRate" />
          </div>
          <SummaryBar>Loan: {fmt(loanAmount)} · Deposit: {fmt(deposit)} ({effectivePct.toFixed(1)}%) · LTV: {(100 - effectivePct).toFixed(1)}% · Monthly payment: {fmt(Math.round(pmtCalc(loanAmount, fixedRate, mortgageTerm)))}/mo</SummaryBar>
        </SubGroup>

        {/* Upfront Costs */}
        <SubGroup title="Upfront Buying Costs">
          <div style={{ marginBottom: 16 }}>
            <Toggle label="First-time buyer" value={isFirstTimeBuyer} onChange={setIsFirstTimeBuyer} tip="FTBs pay no stamp duty up to £425k, reduced rates up to £625k." />
          </div>
          <div style={grid}>
            <Field label={`Stamp Duty ${stampDutyOverride == null ? "(auto)" : "(manual)"}`} prefix="£" value={stampDutyOverride != null ? stampDutyOverride : Math.round(autoSD)} onChange={(v) => setStampDutyOverride(v)} tip="Auto-calculated. Edit to override if thresholds changed." />
            <Field label="Solicitor Fees" prefix="£" value={solicitorFees} onChange={setSolicitorFees} tip="Conveyancing. Usually £1,000–£2,000." fieldKey="solicitorFees" />
            <Field label="Survey" prefix="£" value={surveyFees} onChange={setSurveyFees} tip="Homebuyer's report. Level 2: £400–£700." fieldKey="surveyFees" />
            <Field label="Moving Costs" prefix="£" value={movingCosts} onChange={setMovingCosts} tip="Removal van, packing, everything else." fieldKey="movingCosts" />
          </div>
          {stampDutyOverride != null && (
            <div onClick={() => setStampDutyOverride(null)} style={{ marginTop: 10, fontSize: 12, color: C.accent, cursor: "pointer", fontFamily: fonts.sans, fontWeight: 600 }}>↩ Reset to auto ({fmt(autoSD)})</div>
          )}
          <SummaryBar>Total upfront: {fmt(totalUpfront)}</SummaryBar>
        </SubGroup>

        {/* Owner-Only Monthly Costs */}
        <SubGroup title="Owner-Only Monthly Costs">
          <p style={{ fontSize: 13, color: C.textMid, fontFamily: fonts.serif, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 20px 0" }}>
            Costs only homeowners pay. Renters don't pay these directly.
          </p>
          <div style={grid}>
            <Field label="Maintenance" prefix="£" value={maintenance} onChange={setMaintenance} tip="Monthly repair budget. ~1% of property value per year." fieldKey="maintenance" />
            <Field label="Service Charge" prefix="£" value={serviceCharge} onChange={setServiceCharge} tip="For flats: communal areas, management. £0 for freehold." fieldKey="serviceCharge" />
            <Field label="Buildings Insurance" prefix="£" value={buildingsInsurance} onChange={setBuildingsInsurance} tip="Covers structure. Required by lender. £15–£40/mo." fieldKey="buildingsInsurance" />
            <Field label="Life / Mortgage Protection" prefix="£" value={lifeInsurance} onChange={setLifeInsurance} tip="Pays off mortgage if you die or can't work." fieldKey="lifeInsurance" />
            <Field label="Boiler / Home Cover" prefix="£" value={boilerCover} onChange={setBoilerCover} tip="Emergency cover. Optional, £10–£25/mo." fieldKey="boilerCover" />
            <Field label="Ground Rent" prefix="£" value={groundRent} onChange={setGroundRent} tip="Leasehold only. New builds: £0 under 2022 law." fieldKey="groundRent" />
          </div>
          <SummaryBar>Monthly owner costs: {fmt(ongoingMonthly)}</SummaryBar>
        </SubGroup>

        {/* Selling Costs */}
        <SubGroup title="Selling Costs" style={{ marginBottom: 0 }}>
          <p style={{ fontSize: 13, color: C.textMid, fontFamily: fonts.serif, fontStyle: "italic", lineHeight: 1.5, margin: "0 0 20px 0" }}>
            Deducted from equity. Without these, buying looks artificially better on short horizons.
          </p>
          <div style={grid}>
            <Field label="Estate Agent Fee" suffix="% + VAT" value={estateAgentPct} onChange={setEstateAgentPct} tip="High-street: 1–1.5% + 20% VAT." fieldKey="estateAgentPct" />
            <Field label="Selling Conveyancing" prefix="£" value={sellingConveyancing} onChange={setSellingConveyancing} tip="Legal fees for sale. £1,000–£1,500." fieldKey="sellingConveyancing" />
            <Field label="EPC Certificate" prefix="£" value={epcCost} onChange={setEpcCost} tip="Required before listing. £60–£120." fieldKey="epcCost" />
          </div>
          <SummaryBar>Selling cost at current value: ~{fmt(Math.round(propertyValue * (estateAgentPct * 1.2 / 100) + sellingConveyancing + epcCost))}</SummaryBar>
        </SubGroup>
      </BuyPropertyPanel>

      {/* Rent vs Buy CTA */}
      <div style={{
        marginTop: 8, padding: mobile ? "16px" : "20px 24px",
        background: C.accentLight, border: `1.5px solid ${C.accent}`,
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.sans, color: C.accent, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
            Ready to analyse?
          </div>
          <div style={{ fontSize: 13, fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>
            Save your buy scenario, then head to Rent vs Buy to pick a flat, set assumptions, and see the full analysis.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 48, borderTop: `2px solid ${C.text}`, paddingTop: 16,
        display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 10, color: C.textLight, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>Personal Finance Suite</span>
        <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>Buy Scenario</span>
      </div>

      {/* Dialogs */}
      {saveDialog && <SaveDialog section={saveDialog.section} config={saveDialog.config} onClose={() => setSaveDialog(null)} />}
      {loadDialog && <LoadDialog section={loadDialog} onLoad={applyBuyConfig} onClose={() => setLoadDialog(null)} />}
    </>
  );
}
