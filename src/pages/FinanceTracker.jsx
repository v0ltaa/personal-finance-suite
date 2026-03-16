import { useState, useEffect, useMemo } from "react";
import { C, fonts, fmt, fmtK } from "../lib/tokens";
import { pmtCalc } from "../lib/calc";
import { useIsMobile, useAuth, useInflationSettings } from "../lib/hooks";
import { loadProperties, loadScenarios } from "../lib/supabase";
import { SaveDialog, LoadDialog } from "../components/ScenarioManager";
import Field from "../components/Field";
import Section from "../components/Section";
import Stat from "../components/Stat";
import Toggle from "../components/Toggle";
import InteractiveChart from "../components/InteractiveChart";
import SummaryBar from "../components/SummaryBar";

// ── Affordability thresholds (calibrated for young urban professionals) ──

const HOUSING_THRESHOLDS = [
  { max: 35, label: "Great", color: C.green },
  { max: 45, label: "Normal", color: C.accent },
  { max: 55, label: "Tight", color: "#e67e00" },
  { max: 100, label: "Stretched", color: C.red },
];

const SAVINGS_THRESHOLDS = [
  { max: 5, label: "Tight", color: C.red },
  { max: 10, label: "Okay", color: "#e67e00" },
  { max: 20, label: "Good", color: C.accent },
  { max: 100, label: "Great", color: C.green },
];

function getThreshold(value, thresholds) {
  for (const t of thresholds) {
    if (value <= t.max) return t;
  }
  return thresholds[thresholds.length - 1];
}

// ── Council tax monthly estimates by band (London average) ──

const COUNCIL_TAX = { A: 100, B: 117, C: 133, D: 150, E: 183, F: 217, G: 250, H: 300 };

// ── Default suggested budget ratios (% of post-housing income) ──

const DEFAULT_RATIOS = {
  utilities: 10,
  transport: 10,
  food: 20,
  lifestyle: 15,
  financial: 25,
  irregular: 8,
};

// ── Inline sub-components ──

function PropertyCard({ property, isSelected, onClick, mobile }) {
  const isRent = property.listing_type === "rent";
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px", minWidth: mobile ? "100%" : 220,
      border: `1.5px solid ${isSelected ? C.text : C.border}`,
      background: isSelected ? C.text : "transparent",
      cursor: "pointer", textAlign: "left", transition: "all 0.15s", flexShrink: 0,
    }}>
      <div style={{
        width: 36, height: 36, flexShrink: 0,
        background: isSelected ? "rgba(255,255,255,0.1)" : C.bg,
        border: `1px solid ${isSelected ? "rgba(255,255,255,0.2)" : C.borderLight}`,
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {property.photo_url ? (
          <img src={property.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "rgba(255,255,255,0.4)" : C.textFaint} strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: fonts.serif, fontSize: 13, color: isSelected ? C.bg : C.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {property.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span style={{
            fontSize: 8, fontFamily: fonts.sans, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", padding: "1px 5px",
            background: isSelected ? "rgba(255,255,255,0.15)" : (isRent ? C.accentLight : C.greenBg),
            color: isSelected ? "rgba(255,255,255,0.6)" : (isRent ? C.accent : C.green),
          }}>
            {isRent ? "Rent" : "Buy"}
          </span>
          <span style={{
            fontFamily: fonts.sans, fontSize: 10,
            color: isSelected ? "rgba(255,255,255,0.45)" : C.textLight,
          }}>
            {property.price ? (isRent ? `${fmt(property.price)}/mo` : fmt(property.price)) : "No price"}
          </span>
        </div>
      </div>
      {isSelected && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function BudgetBar({ actual, suggested, label }) {
  if (!suggested || suggested <= 0) return null;
  const ratio = actual / suggested;
  const barColor = ratio > 1.5 ? C.red : ratio > 1.2 ? C.accent : C.green;
  const pct = Math.min(ratio * 100, 200);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{
        fontSize: 9, color: C.textLight, fontFamily: fonts.sans, width: 70,
        textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, flexShrink: 0,
      }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: C.borderLight, position: "relative" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: barColor, transition: "width 0.3s" }} />
        {/* Suggested marker line at 100% */}
        <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1.5, background: C.textFaint }} />
      </div>
      <span style={{
        fontSize: 10, color: barColor, fontFamily: fonts.sans, fontWeight: 600,
        minWidth: 35, textAlign: "right",
      }}>
        {Math.round(ratio * 100)}%
      </span>
    </div>
  );
}

function CategoryFields({ items, labels, state, onChange, prefix = "£", suffix, mobile }) {
  const grid = {
    display: "grid",
    gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(155px, 1fr))",
    gap: mobile ? "16px" : "20px 32px",
  };
  return (
    <div style={grid}>
      {items.map((key) => (
        <Field
          key={key}
          label={labels[key] || key}
          value={state[key]}
          onChange={(v) => onChange(key, v)}
          prefix={prefix}
          suffix={suffix}
        />
      ))}
    </div>
  );
}

function ComparisonTable({ primary, compare, mobile }) {
  const rows = [
    { label: "Housing Cost", a: fmt(primary.housingTotal), b: fmt(compare.housingTotal), delta: compare.housingTotal - primary.housingTotal, isMoney: true },
    { label: "Housing %", a: `${primary.housingPct.toFixed(1)}%`, b: `${compare.housingPct.toFixed(1)}%`, delta: compare.housingPct - primary.housingPct, suffix: "pp" },
    { label: "Disposable", a: fmt(primary.disposable), b: fmt(compare.disposable), delta: compare.disposable - primary.disposable, isMoney: true },
    { label: "Savings Rate", a: `${primary.savingsRate.toFixed(1)}%`, b: `${compare.savingsRate.toFixed(1)}%`, delta: compare.savingsRate - primary.savingsRate, suffix: "pp" },
  ];
  const cellStyle = { padding: "10px 12px", fontFamily: fonts.serif, fontSize: 14, color: C.text };
  const headerStyle = { ...cellStyle, fontSize: 9, fontFamily: fonts.sans, fontWeight: 600, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1.5px solid ${C.border}` }}>
            <th style={headerStyle}></th>
            <th style={headerStyle}>Current</th>
            <th style={headerStyle}>Compare</th>
            <th style={headerStyle}>Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const deltaColor = r.label === "Housing Cost" || r.label === "Housing %"
              ? (r.delta > 0 ? C.red : r.delta < 0 ? C.green : C.textMid)
              : (r.delta < 0 ? C.red : r.delta > 0 ? C.green : C.textMid);
            const deltaStr = r.isMoney
              ? `${r.delta >= 0 ? "+" : ""}${fmt(r.delta)}`
              : `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}${r.suffix || ""}`;
            return (
              <tr key={r.label} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ ...cellStyle, fontSize: 11, fontFamily: fonts.sans, fontWeight: 600, color: C.textMid }}>{r.label}</td>
                <td style={cellStyle}>{r.a}</td>
                <td style={cellStyle}>{r.b}</td>
                <td style={{ ...cellStyle, color: deltaColor, fontWeight: 500 }}>{deltaStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ──

export default function FinanceTracker() {
  const mobile = useIsMobile();
  const { user } = useAuth();

  // ── Data loading ──
  const [properties, setProperties] = useState([]);
  const [buyScenarios, setBuyScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Property selection ──
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);

  // ── Income ──
  const [monthlyIncome, setMonthlyIncome] = useState(2800);

  // ── Housing overrides + council tax ──
  const [housingOverrides, setHousingOverrides] = useState({});
  const [councilTaxBand, setCouncilTaxBand] = useState("C");

  // ── Budget categories ──
  const [utilities, setUtilities] = useState({ gas: 60, electric: 70, water: 35, broadband: 30, mobile: 25 });
  const [transport, setTransport] = useState({ publicTransport: 160, carPayment: 0, fuel: 0, carInsurance: 0, parking: 0 });
  const [food, setFood] = useState({ groceries: 200, diningOut: 100, workLunch: 60, takeaways: 40 });
  const [lifestyle, setLifestyle] = useState({ gym: 30, clothing: 50, haircuts: 20, subscriptions: 25, socialising: 120, hobbies: 30 });
  const [financial, setFinancial] = useState({ studentLoan: 0, otherDebt: 0, pensionExtra: 0, emergencyFund: 100, investments: 100 });
  const [irregular, setIrregular] = useState({ holidays: 100, gifts: 30, homeRepairs: 40 });

  // ── Annual toggle ──
  const [annualView, setAnnualView] = useState(false);
  const mul = annualView ? 12 : 1;
  const per = annualView ? "/yr" : "/mo";

  // ── Budget ratio settings (% of post-housing income) ──
  const [ratios, setRatios] = useState({ ...DEFAULT_RATIOS });
  const updateRatio = (key, val) => setRatios((r) => ({ ...r, [key]: val }));

  // ── Commute autofill ──
  const [commuteDays, setCommuteDays] = useState(5);

  // ── Projection config ──
  const [investReturnRate, setInvestReturnRate] = useState(7);
  const [projectionYears, setProjectionYears] = useState(10);

  // ── Inflation adjustment (shared with Rent vs Buy via localStorage) ──
  const { inflationRate, setInflationRate, inflationAdjusted, setInflationAdjusted } = useInflationSettings();

  // ── Compare mode ──
  const [compareMode, setCompareMode] = useState(false);
  const [comparePropertyId, setComparePropertyId] = useState(null);
  const [compareScenarioId, setCompareScenarioId] = useState(null);

  // ── Save/Load dialogs ──
  const [saveDialog, setSaveDialog] = useState(false);
  const [loadDialog, setLoadDialog] = useState(false);

  // ── Field labels ──
  const utilityLabels = { gas: "Gas", electric: "Electric", water: "Water", broadband: "Broadband", mobile: "Mobile" };
  const transportLabels = { publicTransport: "Public Transport", carPayment: "Car Payment", fuel: "Fuel", carInsurance: "Car Insurance", parking: "Parking" };
  const foodLabels = { groceries: "Groceries", diningOut: "Dining Out", workLunch: "Work Lunch", takeaways: "Takeaways" };
  const lifestyleLabels = { gym: "Gym / Fitness", clothing: "Clothing", haircuts: "Haircuts / Beauty", subscriptions: "Subscriptions", socialising: "Socialising", hobbies: "Hobbies" };
  const financialLabels = { studentLoan: "Student Loan", otherDebt: "Other Debt", pensionExtra: "Extra Pension", emergencyFund: "Emergency Fund", investments: "Investments / ISA" };
  const irregularLabels = { holidays: "Holidays", gifts: "Gifts", homeRepairs: "Home / Repairs" };

  // ── Category updater factory ──
  const updateCat = (setter) => (key, value) => setter((prev) => ({ ...prev, [key]: value }));

  // ── Load data on mount ──
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([loadProperties(), loadScenarios("buy")]).then(([p, b]) => {
      setProperties(p.data || []);
      setBuyScenarios(b.data || []);
      setLoading(false);
    });
  }, [user]);

  // ── Selected property and scenario objects ──
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) || null;
  const selectedScenario = buyScenarios.find((s) => s.id === selectedScenarioId) || null;

  // ── Auto-select first buy scenario when a buy property is picked ──
  useEffect(() => {
    if (selectedProperty?.listing_type === "buy" && !selectedScenarioId && buyScenarios.length > 0) {
      setSelectedScenarioId(buyScenarios[0].id);
    }
  }, [selectedProperty, selectedScenarioId, buyScenarios]);

  // ── Housing cost computation ──
  const housingCosts = useMemo(() => {
    if (!selectedProperty) return { total: 0, breakdown: {}, autoValues: {} };

    let base = {};
    if (selectedProperty.listing_type === "rent") {
      base.rent = selectedProperty.price || 0;
      base.councilTax = COUNCIL_TAX[councilTaxBand] || 133;
      base.contentsInsurance = 15;
    } else {
      const cfg = selectedScenario?.config || {};
      const propPrice = selectedProperty.price || cfg.propertyValue || 250000;
      const deposit = cfg.depositMode === "pct"
        ? propPrice * ((cfg.depositPct || 10) / 100)
        : (cfg.depositCash || 0);
      const loanAmount = Math.max(0, propPrice - deposit);
      base.mortgage = Math.round(pmtCalc(loanAmount, cfg.fixedRate || 4.5, cfg.mortgageTerm || 25));
      base.serviceCharge = cfg.serviceCharge || 0;
      base.groundRent = cfg.groundRent || 0;
      base.buildingsInsurance = cfg.buildingsInsurance || 0;
      base.maintenance = cfg.maintenance || 0;
      base.councilTax = COUNCIL_TAX[councilTaxBand] || 133;
      base.contentsInsurance = 15;
    }

    const merged = { ...base, ...housingOverrides };
    const total = Object.values(merged).reduce((s, v) => s + (Number(v) || 0), 0);
    return { total, breakdown: merged, autoValues: base };
  }, [selectedProperty, selectedScenario, councilTaxBand, housingOverrides]);

  // ── Housing field labels ──
  const housingLabels = selectedProperty?.listing_type === "buy"
    ? { mortgage: "Mortgage", serviceCharge: "Service Charge", groundRent: "Ground Rent", buildingsInsurance: "Buildings Insurance", maintenance: "Maintenance", councilTax: "Council Tax", contentsInsurance: "Contents Insurance" }
    : { rent: "Monthly Rent", councilTax: "Council Tax", contentsInsurance: "Contents Insurance" };

  // ── Category totals ──
  const sumObj = (obj) => Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);

  const categoryTotals = useMemo(() => ({
    housing: housingCosts.total,
    utilities: sumObj(utilities),
    transport: sumObj(transport),
    food: sumObj(food),
    lifestyle: sumObj(lifestyle),
    financial: sumObj(financial),
    irregular: sumObj(irregular),
  }), [housingCosts, utilities, transport, food, lifestyle, financial, irregular]);

  // ── Summary metrics ──
  const summary = useMemo(() => {
    const totalExpenses = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
    const savingsItems = (Number(financial.emergencyFund) || 0) + (Number(financial.investments) || 0) + (Number(financial.pensionExtra) || 0);
    const disposable = monthlyIncome - totalExpenses;
    const savingsRate = monthlyIncome > 0 ? (savingsItems / monthlyIncome) * 100 : 0;
    const housingPct = monthlyIncome > 0 ? (categoryTotals.housing / monthlyIncome) * 100 : 0;
    return { totalExpenses, disposable, savingsItems, savingsRate, housingPct };
  }, [monthlyIncome, categoryTotals, financial]);

  // ── Suggested budget (% of post-housing income, using user-editable ratios) ──
  const suggested = useMemo(() => {
    const afterHousing = monthlyIncome - categoryTotals.housing;
    if (afterHousing <= 0) return null;
    return {
      utilities: afterHousing * (ratios.utilities / 100),
      transport: afterHousing * (ratios.transport / 100),
      food:      afterHousing * (ratios.food      / 100),
      lifestyle: afterHousing * (ratios.lifestyle / 100),
      financial: afterHousing * (ratios.financial / 100),
      irregular: afterHousing * (ratios.irregular / 100),
    };
  }, [monthlyIncome, categoryTotals.housing, ratios]);

  // ── Commute suggestion from selected property ──
  const commuteSuggestion = useMemo(() => {
    if (!selectedProperty) return null;
    const cv = selectedProperty.custom_values || {};
    const petrol    = Number(cv.__commute_petrol)    || 0;
    const transport = Number(cv.__commute_transport) || 0;
    const distance  = Number(cv.__commute_distance)  || 0;
    if (!petrol && !transport && !distance) return null;
    const weeksPerMonth = 52 / 12;
    return {
      distance,
      carMonthly:       petrol    > 0 ? Math.round(commuteDays * weeksPerMonth * petrol)    : null,
      transportMonthly: transport > 0 ? Math.round(commuteDays * weeksPerMonth * transport) : null,
    };
  }, [selectedProperty, commuteDays]);

  // ── Savings projection chart data ──
  const projectionData = useMemo(() => {
    const monthlyEmergency = Number(financial.emergencyFund) || 0;
    const monthlyInvest = Number(financial.investments) || 0;
    const monthlyRate = (investReturnRate || 0) / 100 / 12;
    const totalMonthlyExpenses = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
    const emergencyTarget = totalMonthlyExpenses * 6;
    const months = projectionYears * 12;
    const data = [];
    let emergencyBalance = 0;
    let investBalance = 0;

    for (let m = 0; m <= months; m++) {
      data.push({ month: m, emergency: Math.round(emergencyBalance), investments: Math.round(investBalance) });
      if (emergencyBalance < emergencyTarget) {
        emergencyBalance += monthlyEmergency;
        if (emergencyBalance > emergencyTarget) {
          const overflow = emergencyBalance - emergencyTarget;
          emergencyBalance = emergencyTarget;
          investBalance = investBalance * (1 + monthlyRate) + monthlyInvest + overflow;
        } else {
          investBalance = investBalance * (1 + monthlyRate) + monthlyInvest;
        }
      } else {
        investBalance = investBalance * (1 + monthlyRate) + monthlyInvest + monthlyEmergency;
      }
    }
    return data;
  }, [financial.emergencyFund, financial.investments, investReturnRate, projectionYears, categoryTotals]);

  // ── Inflation-adjusted projection data ──
  const displayProjectionData = useMemo(() => {
    if (!inflationAdjusted || !inflationRate) return projectionData;
    const r = inflationRate / 100;
    return projectionData.map((d) => {
      const discount = Math.pow(1 + r, d.month / 12);
      return { ...d, emergency: Math.round(d.emergency / discount), investments: Math.round(d.investments / discount) };
    });
  }, [projectionData, inflationAdjusted, inflationRate]);

  // ── Comparison mode calculations ──
  const compareProperty = properties.find((p) => p.id === comparePropertyId) || null;
  const compareScenarioObj = buyScenarios.find((s) => s.id === compareScenarioId) || null;

  const compareSummary = useMemo(() => {
    if (!compareMode || !compareProperty) return null;
    let compHousingTotal = 0;
    if (compareProperty.listing_type === "rent") {
      compHousingTotal = (compareProperty.price || 0) + (COUNCIL_TAX[councilTaxBand] || 133) + 15;
    } else {
      const cfg = compareScenarioObj?.config || {};
      const propPrice = compareProperty.price || cfg.propertyValue || 250000;
      const deposit = cfg.depositMode === "pct"
        ? propPrice * ((cfg.depositPct || 10) / 100)
        : (cfg.depositCash || 0);
      const loanAmount = Math.max(0, propPrice - deposit);
      const mortgage = Math.round(pmtCalc(loanAmount, cfg.fixedRate || 4.5, cfg.mortgageTerm || 25));
      compHousingTotal = mortgage + (cfg.serviceCharge || 0) + (cfg.groundRent || 0) + (cfg.buildingsInsurance || 0) + (cfg.maintenance || 0) + (COUNCIL_TAX[councilTaxBand] || 133) + 15;
    }
    const nonHousing = Object.values(categoryTotals).reduce((s, v) => s + v, 0) - categoryTotals.housing;
    const compTotal = compHousingTotal + nonHousing;
    const compDisposable = monthlyIncome - compTotal;
    const savingsItems = (Number(financial.emergencyFund) || 0) + (Number(financial.investments) || 0) + (Number(financial.pensionExtra) || 0);
    const compHousingPct = monthlyIncome > 0 ? (compHousingTotal / monthlyIncome) * 100 : 0;
    const compSavingsRate = monthlyIncome > 0 ? (savingsItems / monthlyIncome) * 100 : 0;
    return { housingTotal: compHousingTotal, housingPct: compHousingPct, disposable: compDisposable, savingsRate: compSavingsRate };
  }, [compareMode, compareProperty, compareScenarioObj, categoryTotals, monthlyIncome, financial, councilTaxBand]);

  const primarySummaryForCompare = useMemo(() => ({
    housingTotal: categoryTotals.housing,
    housingPct: summary.housingPct,
    disposable: summary.disposable,
    savingsRate: summary.savingsRate,
  }), [categoryTotals.housing, summary]);

  // ── Save/Load config ──
  const getBudgetConfig = () => ({
    monthlyIncome, selectedPropertyId, selectedScenarioId, councilTaxBand, housingOverrides,
    utilities, transport, food, lifestyle, financial, irregular, investReturnRate, projectionYears,
    ratios, commuteDays,
  });

  const applyBudgetConfig = (cfg) => {
    if (cfg.monthlyIncome != null) setMonthlyIncome(cfg.monthlyIncome);
    if (cfg.selectedPropertyId) setSelectedPropertyId(cfg.selectedPropertyId);
    if (cfg.selectedScenarioId) setSelectedScenarioId(cfg.selectedScenarioId);
    if (cfg.councilTaxBand) setCouncilTaxBand(cfg.councilTaxBand);
    if (cfg.housingOverrides) setHousingOverrides(cfg.housingOverrides);
    if (cfg.utilities) setUtilities(cfg.utilities);
    if (cfg.transport) setTransport(cfg.transport);
    if (cfg.food) setFood(cfg.food);
    if (cfg.lifestyle) setLifestyle(cfg.lifestyle);
    if (cfg.financial) setFinancial(cfg.financial);
    if (cfg.irregular) setIrregular(cfg.irregular);
    if (cfg.investReturnRate != null) setInvestReturnRate(cfg.investReturnRate);
    if (cfg.projectionYears != null) setProjectionYears(cfg.projectionYears);
    if (cfg.ratios) setRatios(cfg.ratios);
    if (cfg.commuteDays != null) setCommuteDays(cfg.commuteDays);
  };

  // ── CSV Export ──
  const exportCSV = () => {
    const rows = [["Category", "Item", "Monthly (£)"]];
    const add = (cat, items, labels) => {
      for (const [key, val] of Object.entries(items)) {
        rows.push([cat, labels[key] || key, Number(val) || 0]);
      }
    };
    add("Housing", housingCosts.breakdown, housingLabels);
    add("Utilities", utilities, utilityLabels);
    add("Transport", transport, transportLabels);
    add("Food & Drink", food, foodLabels);
    add("Lifestyle", lifestyle, lifestyleLabels);
    add("Financial", financial, financialLabels);
    add("Irregular", irregular, irregularLabels);
    rows.push([]);
    rows.push(["Summary", "Monthly Income", monthlyIncome]);
    rows.push(["Summary", "Total Expenses", Math.round(summary.totalExpenses)]);
    rows.push(["Summary", "Disposable", Math.round(summary.disposable)]);
    rows.push(["Summary", "Housing %", summary.housingPct.toFixed(1) + "%"]);
    rows.push(["Summary", "Savings Rate", summary.savingsRate.toFixed(1) + "%"]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "budget-breakdown.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Handle property selection ──
  const handleSelectProperty = (prop) => {
    const newId = selectedPropertyId === prop.id ? null : prop.id;
    setSelectedPropertyId(newId);
    setHousingOverrides({});
    if (newId && prop.listing_type === "buy" && buyScenarios.length > 0) {
      setSelectedScenarioId(buyScenarios[0].id);
    } else if (!newId || prop.listing_type === "rent") {
      setSelectedScenarioId(null);
    }
  };

  // ── Auth guard ──
  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, marginBottom: 12 }}>Personal Finance Tracker</h2>
        <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>Sign in to track your budget against properties.</p>
      </div>
    );
  }

  // ── Threshold colours ──
  const housingThreshold = getThreshold(summary.housingPct, HOUSING_THRESHOLDS);
  const savingsThreshold = getThreshold(summary.savingsRate, SAVINGS_THRESHOLDS);

  // ── Grid style ──
  const grid = {
    display: "grid",
    gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(155px, 1fr))",
    gap: mobile ? "16px" : "20px 32px",
  };

  const selectStyle = {
    border: `1.5px solid ${C.border}`, background: "transparent", padding: "8px 12px",
    fontFamily: fonts.serif, fontSize: 16, color: C.text, outline: "none",
    cursor: "pointer", width: "100%",
  };

  return (
    <div>
      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, margin: 0, fontSize: mobile ? 20 : 22 }}>
          Personal Finance Tracker
        </h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Toggle label={annualView ? "Annual" : "Monthly"} value={annualView} onChange={setAnnualView} />
          <button onClick={exportCSV} style={{
            padding: "7px 14px", border: `1.5px solid ${C.border}`, background: "transparent",
            fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, color: C.textMid,
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Export CSV</button>
        </div>
      </div>

      {/* ── Property Selector ── */}
      <Section title="SELECT PROPERTY" canSave={!!user} onSave={() => setSaveDialog(true)} onLoad={() => setLoadDialog(true)}>
        {loading && <div style={{ fontSize: 13, color: C.textLight, fontFamily: fonts.serif }}>Loading properties...</div>}
        {!loading && properties.length === 0 && (
          <SummaryBar>No properties yet. Add some in Gaff Tracker first.</SummaryBar>
        )}
        {!loading && properties.length > 0 && (
          <div style={{
            display: "flex", flexDirection: mobile ? "column" : "row",
            gap: 6, overflowX: mobile ? "visible" : "auto", paddingBottom: 4,
          }}>
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} isSelected={selectedPropertyId === p.id} onClick={() => handleSelectProperty(p)} mobile={mobile} />
            ))}
          </div>
        )}

        {/* Buy scenario picker */}
        {selectedProperty?.listing_type === "buy" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, fontFamily: fonts.sans, marginBottom: 8 }}>
              Buy Scenario (for mortgage calc)
            </div>
            {buyScenarios.length === 0 ? (
              <SummaryBar>No buy scenarios saved. Create one in Buy Scenario first.</SummaryBar>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: 350 }}>
                {buyScenarios.map((s) => {
                  const isSel = selectedScenarioId === s.id;
                  return (
                    <button key={s.id} onClick={() => setSelectedScenarioId(isSel ? null : s.id)} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                      border: `1.5px solid ${isSel ? C.text : C.border}`, background: isSel ? C.text : "transparent",
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: fonts.serif, fontSize: 13, color: isSel ? C.bg : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.config?.propertyName || s.name}
                        </div>
                        <div style={{ fontFamily: fonts.sans, fontSize: 10, color: isSel ? "rgba(255,255,255,0.45)" : C.textLight, marginTop: 1 }}>
                          {s.name}
                        </div>
                      </div>
                      {isSel && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Income ── */}
      <Section title="INCOME">
        <div style={{ maxWidth: 240 }}>
          <Field label="Net Monthly Income" value={monthlyIncome} onChange={setMonthlyIncome} prefix="£" />
        </div>
      </Section>

      {/* ── Budget Settings ── */}
      <Section title="BUDGET SETTINGS">
        <div style={{ fontSize: 11, fontFamily: fonts.sans, color: C.textMid, marginBottom: 16 }}>
          Suggested spend targets as % of post-housing income. Total: {Object.values(ratios).reduce((s, v) => s + (Number(v) || 0), 0)}%
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(6, 1fr)",
          gap: mobile ? "16px" : "20px 32px",
        }}>
          {[
            ["utilities", "Utilities"],
            ["transport", "Transport"],
            ["food", "Food"],
            ["lifestyle", "Lifestyle"],
            ["financial", "Savings"],
            ["irregular", "Irregular"],
          ].map(([key, label]) => (
            <Field key={key} label={label} value={ratios[key]} onChange={(v) => updateRatio(key, v)} suffix="%" />
          ))}
        </div>
        <button onClick={() => setRatios({ ...DEFAULT_RATIOS })} style={{
          marginTop: 12, background: "none", border: "none", color: C.accent,
          fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, cursor: "pointer", padding: 0,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>Reset to defaults</button>
      </Section>

      {/* ── Dashboard Cards ── */}
      {selectedProperty && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: mobile ? 20 : 32,
          padding: "20px 0", marginBottom: 12, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
        }}>
          <Stat label={annualView ? "Annual Expenses" : "Monthly Expenses"} value={fmt(Math.round(summary.totalExpenses * mul))} sub={`of ${fmt(monthlyIncome * mul)} income`} mobile={mobile} />
          <Stat
            label="Housing %"
            value={`${summary.housingPct.toFixed(1)}%`}
            sub={<span style={{ color: housingThreshold.color, fontStyle: "normal", fontWeight: 600, fontFamily: fonts.sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{housingThreshold.label}</span>}
            mobile={mobile}
          />
          <Stat label="Disposable" value={fmt(Math.round(summary.disposable * mul))} sub={summary.disposable >= 0 ? "surplus" : "deficit"} mobile={mobile} />
          <Stat label={annualView ? "Annual Savings" : "Monthly Savings"} value={fmt(Math.round(summary.savingsItems * mul))} mobile={mobile} />
          <Stat
            label="Savings Rate"
            value={`${summary.savingsRate.toFixed(1)}%`}
            sub={<span style={{ color: savingsThreshold.color, fontStyle: "normal", fontWeight: 600, fontFamily: fonts.sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{savingsThreshold.label}</span>}
            mobile={mobile}
          />
        </div>
      )}

      {/* ── Housing Breakdown ── */}
      <Section title="HOUSING" defaultOpen={!!selectedProperty}>
        {!selectedProperty ? (
          <SummaryBar>Select a property above to auto-fill housing costs.</SummaryBar>
        ) : (
          <>
            <div style={grid}>
              {Object.keys(housingLabels).map((key) => (
                <div key={key}>
                  <Field
                    label={housingLabels[key]}
                    value={housingOverrides[key] != null ? housingOverrides[key] : housingCosts.breakdown[key]}
                    onChange={(v) => setHousingOverrides((prev) => ({ ...prev, [key]: v }))}
                    prefix="£"
                    note={housingOverrides[key] != null ? "overridden" : undefined}
                  />
                  {housingOverrides[key] != null && (
                    <button onClick={() => setHousingOverrides((prev) => { const n = { ...prev }; delete n[key]; return n; })} style={{
                      background: "none", border: "none", color: C.accent, fontSize: 10,
                      fontFamily: fonts.sans, cursor: "pointer", padding: "4px 0", fontWeight: 600,
                    }}>Reset to auto ({fmt(housingCosts.autoValues[key] || 0)})</button>
                  )}
                </div>
              ))}
              {/* Council tax band selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, color: C.textLight, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Council Tax Band
                </label>
                <select value={councilTaxBand} onChange={(e) => setCouncilTaxBand(e.target.value)} style={selectStyle}>
                  {Object.entries(COUNCIL_TAX).map(([band, val]) => (
                    <option key={band} value={band}>Band {band} — {fmt(val)}/mo</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16, fontFamily: fonts.serif, fontSize: 14, color: C.textMid }}>
              Total housing: <span style={{ color: C.text, fontWeight: 500 }}>{fmt(housingCosts.total * mul)}{per}</span>
            </div>
          </>
        )}
      </Section>

      {/* ── Utilities ── */}
      <Section title="UTILITIES">
        <CategoryFields items={Object.keys(utilities)} labels={utilityLabels} state={utilities} onChange={updateCat(setUtilities)} mobile={mobile} />
        <div style={{ marginTop: 16, fontFamily: fonts.serif, fontSize: 14, color: C.textMid }}>
          Total: <span style={{ color: C.text, fontWeight: 500 }}>{fmt(categoryTotals.utilities * mul)}{per}</span>
          {suggested && <span style={{ marginLeft: 12, fontSize: 12, color: C.textLight }}>Suggested: ~{fmt(Math.round(suggested.utilities * mul))}</span>}
        </div>
      </Section>

      {/* ── Transport ── */}
      <Section title="TRANSPORT">
        {commuteSuggestion && (
          <div style={{ marginBottom: 16, padding: "12px 14px", background: C.accentLight, border: `1px solid rgba(184,134,11,0.2)` }}>
            <div style={{ fontSize: 10, fontFamily: fonts.sans, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Commute data from {selectedProperty.name}
              {commuteSuggestion.distance > 0 && <span style={{ fontWeight: 400, color: C.textMid }}> · {commuteSuggestion.distance} miles</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
              <div style={{ width: 110 }}>
                <Field label="Days/week" value={commuteDays} onChange={setCommuteDays} />
              </div>
              {commuteSuggestion.carMonthly != null && (
                <div>
                  <div style={{ fontSize: 10, fontFamily: fonts.sans, color: C.textMid, marginBottom: 4 }}>Car: ~{fmt(commuteSuggestion.carMonthly)}/mo</div>
                  <button onClick={() => setTransport((t) => ({ ...t, fuel: commuteSuggestion.carMonthly }))} style={{ padding: "5px 12px", border: `1.5px solid ${C.accent}`, background: "transparent", color: C.accent, fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, cursor: "pointer", textTransform: "uppercase" }}>
                    Apply to fuel
                  </button>
                </div>
              )}
              {commuteSuggestion.transportMonthly != null && (
                <div>
                  <div style={{ fontSize: 10, fontFamily: fonts.sans, color: C.textMid, marginBottom: 4 }}>Public transport: ~{fmt(commuteSuggestion.transportMonthly)}/mo</div>
                  <button onClick={() => setTransport((t) => ({ ...t, publicTransport: commuteSuggestion.transportMonthly }))} style={{ padding: "5px 12px", border: `1.5px solid ${C.accent}`, background: "transparent", color: C.accent, fontSize: 10, fontFamily: fonts.sans, fontWeight: 600, cursor: "pointer", textTransform: "uppercase" }}>
                    Apply to public transport
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <CategoryFields items={Object.keys(transport)} labels={transportLabels} state={transport} onChange={updateCat(setTransport)} mobile={mobile} />
        <div style={{ marginTop: 16, fontFamily: fonts.serif, fontSize: 14, color: C.textMid }}>
          Total: <span style={{ color: C.text, fontWeight: 500 }}>{fmt(categoryTotals.transport * mul)}{per}</span>
          {suggested && <span style={{ marginLeft: 12, fontSize: 12, color: C.textLight }}>Suggested: ~{fmt(Math.round(suggested.transport * mul))}</span>}
        </div>
      </Section>

      {/* ── Food & Drink ── */}
      <Section title="FOOD & DRINK">
        <CategoryFields items={Object.keys(food)} labels={foodLabels} state={food} onChange={updateCat(setFood)} mobile={mobile} />
        <div style={{ marginTop: 16, fontFamily: fonts.serif, fontSize: 14, color: C.textMid }}>
          Total: <span style={{ color: C.text, fontWeight: 500 }}>{fmt(categoryTotals.food * mul)}{per}</span>
          {suggested && <span style={{ marginLeft: 12, fontSize: 12, color: C.textLight }}>Suggested: ~{fmt(Math.round(suggested.food * mul))}</span>}
        </div>
      </Section>

      {/* ── Lifestyle ── */}
      <Section title="LIFESTYLE">
        <CategoryFields items={Object.keys(lifestyle)} labels={lifestyleLabels} state={lifestyle} onChange={updateCat(setLifestyle)} mobile={mobile} />
        <div style={{ marginTop: 16, fontFamily: fonts.serif, fontSize: 14, color: C.textMid }}>
          Total: <span style={{ color: C.text, fontWeight: 500 }}>{fmt(categoryTotals.lifestyle * mul)}{per}</span>
          {suggested && <span style={{ marginLeft: 12, fontSize: 12, color: C.textLight }}>Suggested: ~{fmt(Math.round(suggested.lifestyle * mul))}</span>}
        </div>
      </Section>

      {/* ── Financial ── */}
      <Section title="SAVINGS & DEBT">
        <CategoryFields items={Object.keys(financial)} labels={financialLabels} state={financial} onChange={updateCat(setFinancial)} mobile={mobile} />
        <div style={{ marginTop: 16, fontFamily: fonts.serif, fontSize: 14, color: C.textMid }}>
          Total: <span style={{ color: C.text, fontWeight: 500 }}>{fmt(categoryTotals.financial * mul)}{per}</span>
          {suggested && <span style={{ marginLeft: 12, fontSize: 12, color: C.textLight }}>Suggested: ~{fmt(Math.round(suggested.financial * mul))}</span>}
        </div>
      </Section>

      {/* ── Irregular ── */}
      <Section title="IRREGULAR (MONTHLY AMORTISED)">
        <CategoryFields items={Object.keys(irregular)} labels={irregularLabels} state={irregular} onChange={updateCat(setIrregular)} mobile={mobile} />
        <div style={{ marginTop: 16, fontFamily: fonts.serif, fontSize: 14, color: C.textMid }}>
          Total: <span style={{ color: C.text, fontWeight: 500 }}>{fmt(categoryTotals.irregular * mul)}{per}</span>
          {suggested && <span style={{ marginLeft: 12, fontSize: 12, color: C.textLight }}>Suggested: ~{fmt(Math.round(suggested.irregular * mul))}</span>}
        </div>
      </Section>

      {/* ── Budget Summary ── */}
      <Section title="BUDGET SUMMARY" defaultOpen>
        {suggested && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: fonts.sans, color: C.textMid, marginBottom: 12 }}>
              Actual vs suggested spend (line marks the suggested amount)
            </div>
            <BudgetBar actual={categoryTotals.utilities} suggested={suggested.utilities} label="Utilities" />
            <BudgetBar actual={categoryTotals.transport} suggested={suggested.transport} label="Transport" />
            <BudgetBar actual={categoryTotals.food} suggested={suggested.food} label="Food" />
            <BudgetBar actual={categoryTotals.lifestyle} suggested={suggested.lifestyle} label="Lifestyle" />
            <BudgetBar actual={categoryTotals.financial} suggested={suggested.financial} label="Savings" />
            <BudgetBar actual={categoryTotals.irregular} suggested={suggested.irregular} label="Irregular" />
          </div>
        )}

        <div style={{
          display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr",
          gap: 16, padding: "16px 0", borderTop: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: fonts.sans, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>Total In {per}</div>
            <div style={{ fontSize: 22, fontFamily: fonts.serif, color: C.green }}>{fmt(monthlyIncome * mul)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: fonts.sans, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>Total Out {per}</div>
            <div style={{ fontSize: 22, fontFamily: fonts.serif, color: C.text }}>{fmt(Math.round(summary.totalExpenses * mul))}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: fonts.sans, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>
              {summary.disposable >= 0 ? "Surplus" : "Deficit"} {per}
            </div>
            <div style={{ fontSize: 22, fontFamily: fonts.serif, color: summary.disposable >= 0 ? C.green : C.red }}>
              {fmt(Math.round(Math.abs(summary.disposable) * mul))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Savings Projection ── */}
      <Section title="SAVINGS PROJECTION">
        <div style={{ display: "flex", flexWrap: "wrap", gap: mobile ? 16 : 32, marginBottom: 8 }}>
          <div style={{ width: 155 }}>
            <Field label="Return Rate" value={investReturnRate} onChange={setInvestReturnRate} suffix="% p.a." />
          </div>
          <div style={{ width: 155 }}>
            <Field label="Projection" value={projectionYears} onChange={setProjectionYears} suffix="years" />
          </div>
          <div style={{ width: 155 }}>
            <Field label="Assumed Inflation" value={inflationRate} onChange={setInflationRate} suffix="% p.a." tip="Bank of England target is 2%. Used to calculate real (today's money) values." />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Toggle
            label="Show in today's money (inflation-adjusted)"
            value={inflationAdjusted}
            onChange={setInflationAdjusted}
            tip="Inflation-adjusted values show what your future savings would be worth in today's purchasing power. At 2% inflation over 10 years, £100k nominal is worth ~£82k in today's money."
          />
        </div>
        {(Number(financial.emergencyFund) > 0 || Number(financial.investments) > 0) && projectionData.length > 2 && (
          <InteractiveChart
            data={displayProjectionData}
            keys={["emergency", "investments"]}
            colors={[C.accent, C.green]}
            labels={["Emergency Fund", "Investments"]}
            title="Projected Growth"
            mobile={mobile}
            formatY={fmtK}
            inflationAdjusted={inflationAdjusted}
          />
        )}
        {Number(financial.emergencyFund) === 0 && Number(financial.investments) === 0 && (
          <SummaryBar>Set emergency fund or investment contributions above to see projections.</SummaryBar>
        )}
      </Section>

      {/* ── Comparison Mode ── */}
      <Section title="PROPERTY COMPARISON" defaultOpen={compareMode}>
        <div style={{ marginBottom: 16 }}>
          <Toggle label="Compare with another property" value={compareMode} onChange={setCompareMode} />
        </div>

        {compareMode && (
          <>
            <div style={{
              display: "flex", flexDirection: mobile ? "column" : "row",
              gap: 6, overflowX: mobile ? "visible" : "auto", paddingBottom: 8, marginBottom: 16,
            }}>
              {properties.filter((p) => p.id !== selectedPropertyId).map((p) => (
                <PropertyCard key={p.id} property={p} isSelected={comparePropertyId === p.id} onClick={() => {
                  setComparePropertyId(comparePropertyId === p.id ? null : p.id);
                  if (p.listing_type === "buy" && buyScenarios.length > 0) setCompareScenarioId(buyScenarios[0].id);
                  else setCompareScenarioId(null);
                }} mobile={mobile} />
              ))}
            </div>

            {/* Buy scenario picker for compare property */}
            {compareProperty?.listing_type === "buy" && buyScenarios.length > 0 && (
              <div style={{ marginBottom: 16, maxWidth: 350 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, fontWeight: 600, fontFamily: fonts.sans, marginBottom: 8 }}>
                  Compare Buy Scenario
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {buyScenarios.map((s) => {
                    const isSel = compareScenarioId === s.id;
                    return (
                      <button key={s.id} onClick={() => setCompareScenarioId(isSel ? null : s.id)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                        border: `1.5px solid ${isSel ? C.text : C.border}`, background: isSel ? C.text : "transparent",
                        cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: fonts.serif, fontSize: 13, color: isSel ? C.bg : C.text }}>{s.config?.propertyName || s.name}</div>
                        </div>
                        {isSel && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {compareSummary && selectedProperty && (
              <ComparisonTable primary={primarySummaryForCompare} compare={compareSummary} mobile={mobile} />
            )}
            {compareMode && !compareProperty && (
              <SummaryBar>Select a second property above to compare.</SummaryBar>
            )}
          </>
        )}
      </Section>

      {/* ── Footer ── */}
      <div style={{ textAlign: "center", padding: "24px 0 48px", fontSize: 11, fontFamily: fonts.sans, color: C.textFaint }}>
        Defaults based on typical young professional spending in a major city. Adjust to match your actual spending.
      </div>

      {/* ── Save/Load Dialogs ── */}
      {saveDialog && <SaveDialog section="budget" config={getBudgetConfig()} onClose={() => setSaveDialog(false)} />}
      {loadDialog && <LoadDialog section="budget" onLoad={applyBudgetConfig} onClose={() => setLoadDialog(false)} />}
    </div>
  );
}
