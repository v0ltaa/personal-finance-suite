import { useState } from "react";
import { fmt, hpPresets, invPresets } from "../lib/tokens";
import { calcStampDuty, pmtCalc, defaultConfig } from "../lib/calc";
import { useAuth } from "../lib/hooks";
import Field from "../components/Field";
import Toggle from "../components/Toggle";
import Section from "../components/Section";
import SummaryBar from "../components/SummaryBar";
import Tip from "../components/Tip";
import { SaveDialog, LoadDialog } from "../components/ScenarioManager";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { ChevronDown, Home } from "lucide-react";

function SubGroup({ title, children }) {
  return (
    <div className="mb-8">
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground border-b border-border/60 pb-2 mb-5">
        {title}
      </p>
      {children}
    </div>
  );
}

function BuyPropertyPanel({ open, onToggle, name, photoUrl, canSave, onSave, onLoad, children }) {
  return (
    <div className="mb-8">
      {/* Header */}
      <div
        onClick={onToggle}
        className={cn(
          "flex items-center gap-4 bg-card border rounded-xl px-5 py-4 cursor-pointer select-none",
          "transition-all duration-200",
          open ? "border-foreground rounded-b-none" : "border-border hover:border-foreground/40"
        )}
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 shrink-0 rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center">
          {photoUrl ? (
            <img src={photoUrl} alt="Property" className="w-full h-full object-cover" />
          ) : (
            <Home size={22} className="text-muted-foreground" />
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <Badge variant="brand" className="mb-1.5">Buy Scenario</Badge>
          <p className="text-xl sm:text-2xl font-serif text-foreground truncate">
            {name || "My Property"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {canSave && (
            <>
              <Button variant="outline" size="sm" onClick={onSave}>Save</Button>
              <Button variant="outline" size="sm" onClick={onLoad}>Load</Button>
            </>
          )}
          <ChevronDown
            size={16}
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              !open && "-rotate-90"
            )}
          />
        </div>
      </div>

      {/* Body */}
      {open && (
        <Card className="rounded-t-none border-t-0 border-foreground animate-fade-in">
          <CardContent className="pt-6 pb-8 px-5 sm:px-7">
            {children}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BuyVsRent() {
  const { user } = useAuth();
  const [buyOpen, setBuyOpen] = useState(true);

  const [propertyName, setPropertyName] = useState("My Property");
  const [propertyPhotoUrl, setPropertyPhotoUrl] = useState("");
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

  const [saveDialog, setSaveDialog] = useState(null);
  const [loadDialog, setLoadDialog] = useState(null);

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
    const map = {
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
    for (const [k, v] of Object.entries(cfg)) { if (map[k]) map[k](v); }
  };

  return (
    <>
      <BuyPropertyPanel
        open={buyOpen} onToggle={() => setBuyOpen(!buyOpen)}
        name={propertyName} photoUrl={propertyPhotoUrl}
        canSave={canSave}
        onSave={() => setSaveDialog({ section: "buy", config: getBuyConfig() })}
        onLoad={() => setLoadDialog("buy")}
      >
        {/* Property Details */}
        <SubGroup title="Property Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Property Name
              </label>
              <input
                type="text"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="e.g. 14 Oak Street"
                className="bg-transparent border-none outline-none border-b-2 border-border focus:border-brand pb-2 text-lg font-serif text-foreground transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Photo URL <span className="font-normal text-muted-foreground/60 normal-case tracking-normal">(from Property Tracker)</span>
              </label>
              <input
                type="text"
                value={propertyPhotoUrl}
                onChange={(e) => setPropertyPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="bg-transparent border-none outline-none border-b-2 border-border focus:border-brand pb-2 text-sm font-sans text-muted-foreground transition-colors"
              />
            </div>
          </div>
        </SubGroup>

        {/* Property & Mortgage */}
        <SubGroup title="Property & Mortgage">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5 mb-4">
            <Field label="Property Value" prefix="£" value={propertyValue} onChange={setPropertyValue} tip="The purchase price of the property you're considering." fieldKey="propertyValue" />

            {/* Deposit with mode toggle */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Deposit</label>
                <Tip text="Toggle between a percentage or fixed cash amount. Changing one auto-updates the other." />
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden mb-1 w-fit">
                {["pct", "cash"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      if (mode === "pct") { setDepositMode("pct"); setDepositPct(Math.round((depositCash / propertyValue) * 100)); }
                      else { setDepositMode("cash"); setDepositCash(Math.round(propertyValue * depositPct / 100)); }
                    }}
                    className={cn(
                      "px-4 py-1.5 text-xs font-semibold transition-colors",
                      depositMode === mode
                        ? "bg-foreground text-background"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {mode === "pct" ? "%" : "£"}
                  </button>
                ))}
              </div>
              <div className="flex items-center border-b-2 border-border pb-2">
                {depositMode === "cash" && <span className="text-muted-foreground text-base font-serif mr-2">£</span>}
                <input
                  type="number"
                  value={depositMode === "pct" ? depositPct : depositCash}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : Number(e.target.value);
                    if (depositMode === "pct") { setDepositPct(v); setDepositCash(Math.round(propertyValue * v / 100)); }
                    else { setDepositCash(v); setDepositPct(propertyValue > 0 ? Math.round((v / propertyValue) * 100) : 0); }
                  }}
                  className="bg-transparent border-none outline-none text-foreground text-lg font-serif w-full"
                />
                {depositMode === "pct" && <span className="text-muted-foreground text-xs ml-2">%</span>}
              </div>
              <span className="text-xs font-serif italic text-muted-foreground">
                {depositMode === "pct" ? fmt(deposit) : `${effectivePct.toFixed(1)}%`}
              </span>
            </div>

            <Field label="Mortgage Term" suffix="yrs" value={mortgageTerm} onChange={setMortgageTerm} tip="Total mortgage length. UK standard 25 years." fieldKey="mortgageTerm" />
            <Field label="Fixed Rate" suffix="%" value={fixedRate} onChange={setFixedRate} tip="Locked-in rate during the initial fixed period." fieldKey="fixedRate" />
            <Field label="Fixed Period" suffix="yrs" value={fixedPeriod} onChange={setFixedPeriod} tip="How long the fixed rate lasts (typically 2 or 5 years)." fieldKey="fixedPeriod" />
            <Field label="Revert Rate" suffix="%" value={revertRate} onChange={setRevertRate} tip="Lender's SVR after the fixed period." fieldKey="revertRate" />
          </div>
          <SummaryBar>
            Loan: {fmt(loanAmount)} · Deposit: {fmt(deposit)} ({effectivePct.toFixed(1)}%) · LTV: {(100 - effectivePct).toFixed(1)}% · Monthly payment: {fmt(Math.round(pmtCalc(loanAmount, fixedRate, mortgageTerm)))}/mo
          </SummaryBar>
        </SubGroup>

        {/* Upfront Costs */}
        <SubGroup title="Upfront Buying Costs">
          <div className="mb-4">
            <Toggle label="First-time buyer" value={isFirstTimeBuyer} onChange={setIsFirstTimeBuyer} tip="FTBs pay no stamp duty up to £425k, reduced rates up to £625k." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5 mb-4">
            <Field
              label={`Stamp Duty ${stampDutyOverride == null ? "(auto)" : "(manual)"}`}
              prefix="£"
              value={stampDutyOverride != null ? stampDutyOverride : Math.round(autoSD)}
              onChange={(v) => setStampDutyOverride(v)}
              tip="Auto-calculated. Edit to override."
            />
            <Field label="Solicitor Fees" prefix="£" value={solicitorFees} onChange={setSolicitorFees} tip="Conveyancing. Usually £1,000–£2,000." fieldKey="solicitorFees" />
            <Field label="Survey" prefix="£" value={surveyFees} onChange={setSurveyFees} tip="Homebuyer's report. Level 2: £400–£700." fieldKey="surveyFees" />
            <Field label="Moving Costs" prefix="£" value={movingCosts} onChange={setMovingCosts} tip="Removal van, packing, everything else." fieldKey="movingCosts" />
          </div>
          {stampDutyOverride != null && (
            <button
              onClick={() => setStampDutyOverride(null)}
              className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors mb-3"
            >
              ↩ Reset to auto ({fmt(autoSD)})
            </button>
          )}
          <SummaryBar>Total upfront: {fmt(totalUpfront)}</SummaryBar>
        </SubGroup>

        {/* Owner-Only Monthly Costs */}
        <SubGroup title="Owner-Only Monthly Costs">
          <p className="text-sm font-serif italic text-muted-foreground mb-5 leading-relaxed">
            Costs only homeowners pay. Renters don't pay these directly.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5 mb-4">
            <Field label="Maintenance" prefix="£" value={maintenance} onChange={setMaintenance} tip="Monthly repair budget. ~1% of property value per year." fieldKey="maintenance" />
            <Field label="Service Charge" prefix="£" value={serviceCharge} onChange={setServiceCharge} tip="For flats: communal areas, management." fieldKey="serviceCharge" />
            <Field label="Buildings Insurance" prefix="£" value={buildingsInsurance} onChange={setBuildingsInsurance} tip="Covers structure. Required by lender." fieldKey="buildingsInsurance" />
            <Field label="Life / Mortgage Protection" prefix="£" value={lifeInsurance} onChange={setLifeInsurance} tip="Pays off mortgage if you die or can't work." fieldKey="lifeInsurance" />
            <Field label="Boiler / Home Cover" prefix="£" value={boilerCover} onChange={setBoilerCover} tip="Emergency cover. £10–£25/mo." fieldKey="boilerCover" />
            <Field label="Ground Rent" prefix="£" value={groundRent} onChange={setGroundRent} tip="Leasehold only. New builds: £0 under 2022 law." fieldKey="groundRent" />
          </div>
          <SummaryBar>Monthly owner costs: {fmt(ongoingMonthly)}</SummaryBar>
        </SubGroup>

        {/* Selling Costs */}
        <SubGroup title="Selling Costs">
          <p className="text-sm font-serif italic text-muted-foreground mb-5 leading-relaxed">
            Deducted from equity. Without these, buying looks artificially better on short horizons.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-5 mb-4">
            <Field label="Estate Agent Fee" suffix="% + VAT" value={estateAgentPct} onChange={setEstateAgentPct} tip="High-street: 1–1.5% + 20% VAT." fieldKey="estateAgentPct" />
            <Field label="Selling Conveyancing" prefix="£" value={sellingConveyancing} onChange={setSellingConveyancing} tip="Legal fees for sale. £1,000–£1,500." fieldKey="sellingConveyancing" />
            <Field label="EPC Certificate" prefix="£" value={epcCost} onChange={setEpcCost} tip="Required before listing. £60–£120." fieldKey="epcCost" />
          </div>
          <SummaryBar>
            Selling cost at current value: ~{fmt(Math.round(propertyValue * (estateAgentPct * 1.2 / 100) + sellingConveyancing + epcCost))}
          </SummaryBar>
        </SubGroup>
      </BuyPropertyPanel>

      {/* CTA Banner */}
      <div className="mt-2 px-5 py-4 rounded-xl bg-brand/8 border border-brand/25 flex items-center gap-4 flex-wrap">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand mb-1">Ready to analyse?</p>
          <p className="text-sm font-serif italic text-muted-foreground">
            Save your buy scenario, then head to Rent vs Buy to pick a flat, set assumptions, and see the full analysis.
          </p>
        </div>
        {canSave && (
          <Button variant="brand" size="sm" onClick={() => setSaveDialog({ section: "buy", config: getBuyConfig() })}>
            Save Scenario
          </Button>
        )}
      </div>

      {/* Dialogs */}
      {saveDialog && <SaveDialog section={saveDialog.section} config={saveDialog.config} onClose={() => setSaveDialog(null)} />}
      {loadDialog && <LoadDialog section={loadDialog} onLoad={applyBuyConfig} onClose={() => setLoadDialog(null)} />}
    </>
  );
}
