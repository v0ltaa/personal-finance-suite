import { useState, useEffect, useMemo } from "react";
import { fmt, fmtK } from "../lib/tokens";
import { pmtCalc } from "../lib/calc";
import { useIsMobile, useAuth, useInflationSettings } from "../lib/hooks";
import { loadProperties, loadScenarios } from "../lib/supabase";
import { SaveDialog, LoadDialog } from "../components/ScenarioManager";
import { cn } from "../lib/utils";
import Field from "../components/Field";
import Section from "../components/Section";
import Stat from "../components/Stat";
import Toggle from "../components/Toggle";
import InteractiveChart from "../components/InteractiveChart";
import SummaryBar from "../components/SummaryBar";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

// ── Affordability thresholds (calibrated for young urban professionals) ──

const HOUSING_THRESHOLDS = [
  { max: 35, label: "Great", variant: "success" },
  { max: 45, label: "Normal", variant: "warning" },
  { max: 55, label: "Tight", variant: "warning" },
  { max: 100, label: "Stretched", variant: "danger" },
];

const SAVINGS_THRESHOLDS = [
  { max: 5, label: "Tight", variant: "danger" },
  { max: 10, label: "Okay", variant: "warning" },
  { max: 20, label: "Good", variant: "secondary" },
  { max: 100, label: "Great", variant: "success" },
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
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 border text-left transition-all duration-150 shrink-0 rounded-none",
        mobile ? "w-full" : "min-w-[220px]",
        isSelected
          ? "border-foreground bg-foreground"
          : "border-border bg-transparent hover:border-brand/40"
      )}
    >
      <div
        className={cn(
          "w-9 h-9 shrink-0 border overflow-hidden flex items-center justify-center",
          isSelected ? "bg-brand/10 border-border" : "bg-background border-border/40"
        )}
      >
        {property.photo_url ? (
          <img src={property.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg
            width="16"
            height="16"
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
          {property.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={cn(
              "text-[8px] font-bold uppercase tracking-[0.08em] px-1.5 py-px",
              isSelected
                ? "bg-brand/20 text-background"
                : isRent
                  ? "bg-brand/10 text-brand"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            )}
          >
            {isRent ? "Rent" : "Buy"}
          </span>
          <span
            className={cn(
              "text-[10px]",
              isSelected ? "text-background/70" : "text-muted-foreground"
            )}
          >
            {property.price ? (isRent ? `${fmt(property.price)}/mo` : fmt(property.price)) : "No price"}
          </span>
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
}

function BudgetBar({ actual, suggested, label }) {
  if (!suggested || suggested <= 0) return null;
  const ratio = actual / suggested;
  const pct = Math.min(ratio * 100, 200);
  const barColorClass = ratio > 1.5
    ? "bg-red-500"
    : ratio > 1.2
      ? "bg-amber-500"
      : "bg-green-500";
  const textColorClass = ratio > 1.5
    ? "text-red-500"
    : ratio > 1.2
      ? "text-amber-500"
      : "text-green-600";
  return (
    <div className="flex items-center gap-2.5 mb-1.5">
      <span className="text-[9px] text-muted-foreground w-[70px] uppercase tracking-[0.06em] font-semibold shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-border/50 relative">
        <div
          className={cn("h-full transition-[width] duration-300", barColorClass)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {/* Suggested marker line at 100% */}
        <div className="absolute left-1/2 -top-0.5 -bottom-0.5 w-px bg-muted-foreground/30" />
      </div>
      <span className={cn("text-[10px] font-semibold min-w-[35px] text-right", textColorClass)}>
        {Math.round(ratio * 100)}%
      </span>
    </div>
  );
}

function CategoryFields({ items, labels, state, onChange, prefix = "£", suffix, mobile }) {
  return (
    <div className={cn(
      "grid",
      mobile
        ? "grid-cols-1 gap-4"
        : "grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-x-8 gap-y-5"
    )}>
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="p-3 text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.08em] text-left"></th>
            <th className="p-3 text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.08em] text-left">Current</th>
            <th className="p-3 text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.08em] text-left">Compare</th>
            <th className="p-3 text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.08em] text-left">Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isHousingMetric = r.label === "Housing Cost" || r.label === "Housing %";
            const deltaColorClass = isHousingMetric
              ? r.delta > 0 ? "text-red-500" : r.delta < 0 ? "text-green-600" : "text-muted-foreground"
              : r.delta < 0 ? "text-red-500" : r.delta > 0 ? "text-green-600" : "text-muted-foreground";
            const deltaStr = r.isMoney
              ? `${r.delta >= 0 ? "+" : ""}${fmt(r.delta)}`
              : `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}${r.suffix || ""}`;
            return (
              <tr key={r.label} className="border-b border-border/50">
                <td className="p-3 text-[11px] font-semibold text-muted-foreground">{r.label}</td>
                <td className="p-3 font-serif text-sm text-foreground">{r.a}</td>
                <td className="p-3 font-serif text-sm text-foreground">{r.b}</td>
                <td className={cn("p-3 font-serif text-sm font-medium", deltaColorClass)}>{deltaStr}</td>
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
      <div className="text-center py-20 px-5">
        <h2 className="font-serif font-normal text-foreground mb-3 text-xl">Personal Finance Tracker</h2>
        <p className="font-serif text-muted-foreground italic">Sign in to track your budget against properties.</p>
      </div>
    );
  }

  // ── Threshold variants ──
  const housingThreshold = getThreshold(summary.housingPct, HOUSING_THRESHOLDS);
  const savingsThreshold = getThreshold(summary.savingsRate, SAVINGS_THRESHOLDS);

  const gridClass = cn(
    "grid",
    mobile
      ? "grid-cols-1 gap-4"
      : "grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-x-8 gap-y-5"
  );

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="flex justify-between items-center mb-8">
        <h2 className={cn("font-serif font-normal text-foreground m-0", mobile ? "text-xl" : "text-[22px]")}>
          Personal Finance Tracker
        </h2>
        <div className="flex gap-2 items-center">
          <Toggle label={annualView ? "Annual" : "Monthly"} value={annualView} onChange={setAnnualView} />
          <Button variant="outline" size="sm" onClick={exportCSV} className="text-[10px] uppercase tracking-wider">
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Property Selector ── */}
      <Section title="SELECT PROPERTY" canSave={!!user} onSave={() => setSaveDialog(true)} onLoad={() => setLoadDialog(true)}>
        {loading && (
          <div className="text-sm text-muted-foreground font-serif">Loading properties...</div>
        )}
        {!loading && properties.length === 0 && (
          <SummaryBar>No properties yet. Add some in Gaff Tracker first.</SummaryBar>
        )}
        {!loading && properties.length > 0 && (
          <div className={cn(
            "flex gap-1.5 pb-1",
            mobile ? "flex-col" : "flex-row overflow-x-auto"
          )}>
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                isSelected={selectedPropertyId === p.id}
                onClick={() => handleSelectProperty(p)}
                mobile={mobile}
              />
            ))}
          </div>
        )}

        {/* Buy scenario picker */}
        {selectedProperty?.listing_type === "buy" && (
          <div className="mt-4">
            <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand mb-2">
              Buy Scenario (for mortgage calc)
            </div>
            {buyScenarios.length === 0 ? (
              <SummaryBar>No buy scenarios saved. Create one in Buy Scenario first.</SummaryBar>
            ) : (
              <div className="flex flex-col gap-1.5 max-w-[350px]">
                {buyScenarios.map((s) => {
                  const isSel = selectedScenarioId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedScenarioId(isSel ? null : s.id)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 border text-left transition-all duration-150 rounded-none",
                        isSel
                          ? "border-foreground bg-foreground"
                          : "border-border bg-transparent hover:border-brand/40"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "font-serif text-[13px] overflow-hidden text-ellipsis whitespace-nowrap",
                          isSel ? "text-background" : "text-foreground"
                        )}>
                          {s.config?.propertyName || s.name}
                        </div>
                        <div className={cn(
                          "text-[10px] mt-px",
                          isSel ? "text-background/45" : "text-muted-foreground"
                        )}>
                          {s.name}
                        </div>
                      </div>
                      {isSel && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
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
        <div className="max-w-[240px]">
          <Field label="Net Monthly Income" value={monthlyIncome} onChange={setMonthlyIncome} prefix="£" />
        </div>
      </Section>

      {/* ── Budget Settings ── */}
      <Section title="BUDGET SETTINGS">
        <div className="text-[11px] text-muted-foreground mb-4">
          Suggested spend targets as % of post-housing income. Total: {Object.values(ratios).reduce((s, v) => s + (Number(v) || 0), 0)}%
        </div>
        <div className={cn(
          "grid",
          mobile
            ? "grid-cols-2 gap-4"
            : "grid-cols-6 gap-x-8 gap-y-5"
        )}>
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
        <button
          onClick={() => setRatios({ ...DEFAULT_RATIOS })}
          className="mt-3 bg-transparent border-none text-brand text-[10px] font-semibold cursor-pointer p-0 uppercase tracking-[0.06em] hover:opacity-70 transition-opacity"
        >
          Reset to defaults
        </button>
      </Section>

      {/* ── Dashboard Cards ── */}
      {selectedProperty && (
        <div className={cn(
          "flex flex-wrap py-5 mb-3 border-t border-b border-border",
          mobile ? "gap-5" : "gap-8"
        )}>
          <Stat
            label={annualView ? "Annual Expenses" : "Monthly Expenses"}
            value={fmt(Math.round(summary.totalExpenses * mul))}
            sub={`of ${fmt(monthlyIncome * mul)} income`}
            mobile={mobile}
          />
          <Stat
            label="Housing %"
            value={`${summary.housingPct.toFixed(1)}%`}
            sub={<Badge variant={housingThreshold.variant}>{housingThreshold.label}</Badge>}
            mobile={mobile}
          />
          <Stat
            label="Disposable"
            value={fmt(Math.round(summary.disposable * mul))}
            sub={summary.disposable >= 0 ? "surplus" : "deficit"}
            mobile={mobile}
          />
          <Stat
            label={annualView ? "Annual Savings" : "Monthly Savings"}
            value={fmt(Math.round(summary.savingsItems * mul))}
            mobile={mobile}
          />
          <Stat
            label="Savings Rate"
            value={`${summary.savingsRate.toFixed(1)}%`}
            sub={<Badge variant={savingsThreshold.variant}>{savingsThreshold.label}</Badge>}
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
            <div className={gridClass}>
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
                    <button
                      onClick={() => setHousingOverrides((prev) => { const n = { ...prev }; delete n[key]; return n; })}
                      className="bg-transparent border-none text-brand text-[10px] cursor-pointer py-1 px-0 font-semibold hover:opacity-70 transition-opacity"
                    >
                      Reset to auto ({fmt(housingCosts.autoValues[key] || 0)})
                    </button>
                  )}
                </div>
              ))}
              {/* Council tax band selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Council Tax Band
                </label>
                <select
                  value={councilTaxBand}
                  onChange={(e) => setCouncilTaxBand(e.target.value)}
                  className="border border-border bg-transparent px-3 py-2 font-serif text-base text-foreground outline-none cursor-pointer w-full"
                >
                  {Object.entries(COUNCIL_TAX).map(([band, val]) => (
                    <option key={band} value={band}>Band {band} — {fmt(val)}/mo</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 font-serif text-sm text-muted-foreground">
              Total housing:{" "}
              <span className="text-foreground font-medium">{fmt(housingCosts.total * mul)}{per}</span>
            </div>
          </>
        )}
      </Section>

      {/* ── Utilities ── */}
      <Section title="UTILITIES">
        <CategoryFields items={Object.keys(utilities)} labels={utilityLabels} state={utilities} onChange={updateCat(setUtilities)} mobile={mobile} />
        <div className="mt-4 font-serif text-sm text-muted-foreground">
          Total: <span className="text-foreground font-medium">{fmt(categoryTotals.utilities * mul)}{per}</span>
          {suggested && (
            <span className="ml-3 text-xs text-muted-foreground/70">
              Suggested: ~{fmt(Math.round(suggested.utilities * mul))}
            </span>
          )}
        </div>
      </Section>

      {/* ── Transport ── */}
      <Section title="TRANSPORT">
        {commuteSuggestion && (
          <div className="mb-4 px-3.5 py-3 bg-brand/5 border border-brand/20">
            <div className="text-[10px] font-bold text-brand uppercase tracking-[0.08em] mb-2.5">
              Commute data from {selectedProperty.name}
              {commuteSuggestion.distance > 0 && (
                <span className="font-normal text-muted-foreground"> · {commuteSuggestion.distance} miles</span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="w-[110px]">
                <Field label="Days/week" value={commuteDays} onChange={setCommuteDays} />
              </div>
              {commuteSuggestion.carMonthly != null && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">Car: ~{fmt(commuteSuggestion.carMonthly)}/mo</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransport((t) => ({ ...t, fuel: commuteSuggestion.carMonthly }))}
                    className="text-[10px] uppercase border-brand text-brand hover:bg-brand/5"
                  >
                    Apply to fuel
                  </Button>
                </div>
              )}
              {commuteSuggestion.transportMonthly != null && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">Public transport: ~{fmt(commuteSuggestion.transportMonthly)}/mo</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransport((t) => ({ ...t, publicTransport: commuteSuggestion.transportMonthly }))}
                    className="text-[10px] uppercase border-brand text-brand hover:bg-brand/5"
                  >
                    Apply to public transport
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        <CategoryFields items={Object.keys(transport)} labels={transportLabels} state={transport} onChange={updateCat(setTransport)} mobile={mobile} />
        <div className="mt-4 font-serif text-sm text-muted-foreground">
          Total: <span className="text-foreground font-medium">{fmt(categoryTotals.transport * mul)}{per}</span>
          {suggested && (
            <span className="ml-3 text-xs text-muted-foreground/70">
              Suggested: ~{fmt(Math.round(suggested.transport * mul))}
            </span>
          )}
        </div>
      </Section>

      {/* ── Food & Drink ── */}
      <Section title="FOOD & DRINK">
        <CategoryFields items={Object.keys(food)} labels={foodLabels} state={food} onChange={updateCat(setFood)} mobile={mobile} />
        <div className="mt-4 font-serif text-sm text-muted-foreground">
          Total: <span className="text-foreground font-medium">{fmt(categoryTotals.food * mul)}{per}</span>
          {suggested && (
            <span className="ml-3 text-xs text-muted-foreground/70">
              Suggested: ~{fmt(Math.round(suggested.food * mul))}
            </span>
          )}
        </div>
      </Section>

      {/* ── Lifestyle ── */}
      <Section title="LIFESTYLE">
        <CategoryFields items={Object.keys(lifestyle)} labels={lifestyleLabels} state={lifestyle} onChange={updateCat(setLifestyle)} mobile={mobile} />
        <div className="mt-4 font-serif text-sm text-muted-foreground">
          Total: <span className="text-foreground font-medium">{fmt(categoryTotals.lifestyle * mul)}{per}</span>
          {suggested && (
            <span className="ml-3 text-xs text-muted-foreground/70">
              Suggested: ~{fmt(Math.round(suggested.lifestyle * mul))}
            </span>
          )}
        </div>
      </Section>

      {/* ── Financial ── */}
      <Section title="SAVINGS & DEBT">
        <CategoryFields items={Object.keys(financial)} labels={financialLabels} state={financial} onChange={updateCat(setFinancial)} mobile={mobile} />
        <div className="mt-4 font-serif text-sm text-muted-foreground">
          Total: <span className="text-foreground font-medium">{fmt(categoryTotals.financial * mul)}{per}</span>
          {suggested && (
            <span className="ml-3 text-xs text-muted-foreground/70">
              Suggested: ~{fmt(Math.round(suggested.financial * mul))}
            </span>
          )}
        </div>
      </Section>

      {/* ── Irregular ── */}
      <Section title="IRREGULAR (MONTHLY AMORTISED)">
        <CategoryFields items={Object.keys(irregular)} labels={irregularLabels} state={irregular} onChange={updateCat(setIrregular)} mobile={mobile} />
        <div className="mt-4 font-serif text-sm text-muted-foreground">
          Total: <span className="text-foreground font-medium">{fmt(categoryTotals.irregular * mul)}{per}</span>
          {suggested && (
            <span className="ml-3 text-xs text-muted-foreground/70">
              Suggested: ~{fmt(Math.round(suggested.irregular * mul))}
            </span>
          )}
        </div>
      </Section>

      {/* ── Budget Summary ── */}
      <Section title="BUDGET SUMMARY" defaultOpen>
        {suggested && (
          <div className="mb-5">
            <div className="text-[11px] text-muted-foreground mb-3">
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

        <div className={cn(
          "grid gap-4 pt-4 border-t border-border",
          mobile ? "grid-cols-1" : "grid-cols-3"
        )}>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">
              Total In {per}
            </div>
            <div className="text-[22px] font-serif text-green-600">{fmt(monthlyIncome * mul)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">
              Total Out {per}
            </div>
            <div className="text-[22px] font-serif text-foreground">{fmt(Math.round(summary.totalExpenses * mul))}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">
              {summary.disposable >= 0 ? "Surplus" : "Deficit"} {per}
            </div>
            <div className={cn(
              "text-[22px] font-serif",
              summary.disposable >= 0 ? "text-green-600" : "text-red-500"
            )}>
              {fmt(Math.round(Math.abs(summary.disposable) * mul))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Savings Projection ── */}
      <Section title="SAVINGS PROJECTION">
        <div className={cn(
          "flex flex-wrap mb-2",
          mobile ? "gap-4" : "gap-8"
        )}>
          <div className="w-[155px]">
            <Field label="Return Rate" value={investReturnRate} onChange={setInvestReturnRate} suffix="% p.a." />
          </div>
          <div className="w-[155px]">
            <Field label="Projection" value={projectionYears} onChange={setProjectionYears} suffix="years" />
          </div>
          <div className="w-[155px]">
            <Field label="Assumed Inflation" value={inflationRate} onChange={setInflationRate} suffix="% p.a." tip="Bank of England target is 2%. Used to calculate real (today's money) values." />
          </div>
        </div>
        <div className="mb-4">
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
            colors={["var(--warning)", "var(--success)"]}
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
        <div className="mb-4">
          <Toggle label="Compare with another property" value={compareMode} onChange={setCompareMode} />
        </div>

        {compareMode && (
          <>
            <div className={cn(
              "flex gap-1.5 pb-2 mb-4",
              mobile ? "flex-col" : "flex-row overflow-x-auto"
            )}>
              {properties.filter((p) => p.id !== selectedPropertyId).map((p) => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  isSelected={comparePropertyId === p.id}
                  onClick={() => {
                    setComparePropertyId(comparePropertyId === p.id ? null : p.id);
                    if (p.listing_type === "buy" && buyScenarios.length > 0) setCompareScenarioId(buyScenarios[0].id);
                    else setCompareScenarioId(null);
                  }}
                  mobile={mobile}
                />
              ))}
            </div>

            {/* Buy scenario picker for compare property */}
            {compareProperty?.listing_type === "buy" && buyScenarios.length > 0 && (
              <div className="mb-4 max-w-[350px]">
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-brand mb-2">
                  Compare Buy Scenario
                </div>
                <div className="flex flex-col gap-1.5">
                  {buyScenarios.map((s) => {
                    const isSel = compareScenarioId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setCompareScenarioId(isSel ? null : s.id)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 border text-left transition-all duration-150 rounded-none",
                          isSel
                            ? "border-foreground bg-foreground"
                            : "border-border bg-transparent hover:border-brand/40"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "font-serif text-[13px]",
                            isSel ? "text-background" : "text-foreground"
                          )}>
                            {s.config?.propertyName || s.name}
                          </div>
                        </div>
                        {isSel && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
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
      <div className="text-center py-6 pb-12 text-[11px] text-muted-foreground/50">
        Defaults based on typical young professional spending in a major city. Adjust to match your actual spending.
      </div>

      {/* ── Save/Load Dialogs ── */}
      {saveDialog && <SaveDialog section="budget" config={getBudgetConfig()} onClose={() => setSaveDialog(false)} />}
      {loadDialog && <LoadDialog section="budget" onLoad={applyBudgetConfig} onClose={() => setLoadDialog(false)} />}
    </div>
  );
}
