import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useIsMobile } from "../lib/hooks";
import { toMonthly, fmtMoney } from "../lib/ukTax";
const fmt = fmtMoney;
import { cn } from "../lib/utils";
import ProgressIndicator from "../components/budget/ProgressIndicator";
import BudgetSidebar from "../components/budget/BudgetSidebar";
import StepSetup from "../components/budget/StepSetup";
import StepIncome from "../components/budget/StepIncome";
import StepCommitted from "../components/budget/StepCommitted";
import StepEssentials from "../components/budget/StepEssentials";
import StepSavings from "../components/budget/StepSavings";
import StepLifestyle from "../components/budget/StepLifestyle";
import StepSummary from "../components/budget/StepSummary";
import BudgetOverview from "../components/budget/BudgetOverview";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import Modal from "../components/ui/modal";
import { Save, FolderOpen, Trash2, FilePlus, Settings2 } from "lucide-react";

// ── Default data ──

const DEFAULT_INCOME = {
  grossAnnual: 0,
  pensionPct: 5,
  pensionEmployerMatchEnabled: false,
  pensionEmployerMatchPct: 5,
  manualPensionMonthly: 0,
  studentLoan: "none",
  deductions: [
    { id: crypto.randomUUID(), name: "Cycle to work", amount: 0, frequency: "monthly" },
    { id: crypto.randomUUID(), name: "Childcare vouchers", amount: 0, frequency: "monthly" },
  ],
  mode: "calculator", // "calculator" or "manual"
  manualTakeHome: 0,
  monthlyTakeHome: 0,
};

const DEFAULT_COMMITTED = [
  { id: crypto.randomUUID(), category: "Housing", name: "Rent", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Housing", name: "Council Tax", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Utilities", name: "Gas & Electric", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Utilities", name: "Water", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Communications", name: "Internet", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Communications", name: "Phone contract", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Transport", name: "Car finance / loan", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Transport", name: "Fuel / travel pass", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Transport", name: "Car insurance", amount: 0, frequency: "annual" },
  { id: crypto.randomUUID(), category: "Other Committed", name: "Pet costs", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Other Committed", name: "Debt repayments", amount: 0, frequency: "monthly" },
];

const DEFAULT_ESSENTIALS = [
  { id: crypto.randomUUID(), name: "Groceries", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), name: "Household supplies", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), name: "Health & supplements", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), name: "Haircuts / personal care", amount: 0, frequency: "monthly" },
];

const DEFAULT_SAVINGS = [
  { id: crypto.randomUUID(), name: "Emergency fund", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), name: "LISA", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), name: "ISA / Investments", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), name: "Other savings", amount: 0, frequency: "monthly" },
];

const DEFAULT_DISCRETIONARY = [
  { id: crypto.randomUUID(), name: "Eating out / Drinks", amount: 0, frequency: "monthly", monzoCategory: "Eating Out" },
  { id: crypto.randomUUID(), name: "Shopping / Clothes", amount: 0, frequency: "monthly", monzoCategory: "Shopping" },
  { id: crypto.randomUUID(), name: "Entertainment", amount: 0, frequency: "monthly", monzoCategory: "Entertainment" },
  { id: crypto.randomUUID(), name: "Subscriptions", amount: 0, frequency: "monthly", monzoCategory: "Bills" },
  { id: crypto.randomUUID(), name: "Gym / Fitness", amount: 0, frequency: "monthly", monzoCategory: "Personal Care" },
  { id: crypto.randomUUID(), name: "Hobbies", amount: 0, frequency: "monthly", monzoCategory: "Shopping" },
  { id: crypto.randomUUID(), name: "Holidays", amount: 0, frequency: "annual", monzoCategory: "Holidays" },
  { id: crypto.randomUUID(), name: "Sink funds", amount: 0, frequency: "monthly", monzoCategory: "General" },
  { id: crypto.randomUUID(), name: "Gifts", amount: 0, frequency: "monthly", monzoCategory: "Shopping" },
  { id: crypto.randomUUID(), name: "Buffer / Miscellaneous", amount: 0, frequency: "monthly", monzoCategory: "General" },
];

function freshDefaults() {
  return {
    income: {
      ...DEFAULT_INCOME,
      deductions: DEFAULT_INCOME.deductions.map((d) => ({ ...d, id: crypto.randomUUID() })),
    },
    committed: DEFAULT_COMMITTED.map((i) => ({ ...i, id: crypto.randomUUID() })),
    essentials: DEFAULT_ESSENTIALS.map((i) => ({ ...i, id: crypto.randomUUID() })),
    savings: DEFAULT_SAVINGS.map((i) => ({ ...i, id: crypto.randomUUID() })),
    discretionary: DEFAULT_DISCRETIONARY.map((i) => ({ ...i, id: crypto.randomUUID() })),
  };
}

// ── localStorage helpers ──

const STORAGE_KEY = "budget_designer";

function loadBudgets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).budgets || [] : [];
  } catch {
    return [];
  }
}

function saveBudgets(budgets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ budgets }));
}

function getLastBudget() {
  const budgets = loadBudgets();
  if (budgets.length === 0) return null;
  return budgets.reduce((latest, b) =>
    !latest || (b.updatedAt && b.updatedAt > latest.updatedAt) ? b : latest
  , null);
}

// ── Sum helpers ──

function effectiveMonthly(item) {
  const monthly = toMonthly(item.amount, item.frequency);
  if (item.name === "Council Tax" && item.singlePerson) return monthly * 0.75;
  return monthly;
}

function sumMonthly(items) {
  return items.reduce((s, i) => s + effectiveMonthly(i), 0);
}

// ── Main component ──

export default function BudgetDesigner() {
  const isMobile = useIsMobile();

  // Try to load the most recent saved budget on first render
  const [initialBudget] = useState(() => getLastBudget());

  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(() =>
    initialBudget ? [0, 1, 2, 3, 4, 5] : []
  );

  // Budget state
  const [income, setIncome] = useState(() =>
    initialBudget?.income
      ? { pensionEmployerMatchEnabled: false, pensionEmployerMatchPct: 5, manualPensionMonthly: 0, deductions: [], ...initialBudget.income }
      : DEFAULT_INCOME
  );
  const [committed, setCommitted] = useState(() =>
    initialBudget?.committed || DEFAULT_COMMITTED.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );
  const [essentials, setEssentials] = useState(() =>
    initialBudget?.essentials || DEFAULT_ESSENTIALS.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );
  const [savings, setSavings] = useState(() =>
    initialBudget?.savings || DEFAULT_SAVINGS.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );
  const [discretionary, setDiscretionary] = useState(() =>
    initialBudget?.discretionary || DEFAULT_DISCRETIONARY.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );

  // View mode: "wizard" or "overview"
  const [viewMode, setViewMode] = useState(() => initialBudget ? "overview" : "wizard");

  // Budget approach: "traditional" (savings before lifestyle) or "realistic" (lifestyle before savings)
  const [budgetMode, setBudgetMode] = useState(() => initialBudget?.budgetMode || "realistic");
  // Budget rule: needs/wants/savings percentages
  const [budgetRule, setBudgetRule] = useState(() => ({
    needs: 50, wants: 30, savings: 20, countEmployerMatchInSavings: true,
    ...(initialBudget?.budgetRule || {}),
  }));

  // Save dialog
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [budgetName, setBudgetName] = useState(() => initialBudget?.name || "");
  const [loadedBudgetId, setLoadedBudgetId] = useState(() => initialBudget?.id || null);
  // Bumped after deletes so lists re-read localStorage
  const [budgetsVersion, setBudgetsVersion] = useState(0);

  // Computed totals
  const committedTotal = useMemo(() => sumMonthly(committed), [committed]);
  const essentialsTotal = useMemo(() => sumMonthly(essentials), [essentials]);
  const savingsTotal = useMemo(() => sumMonthly(savings), [savings]);
  const lifestyleTotal = useMemo(() => sumMonthly(discretionary), [discretionary]);
  const takeHome = income.monthlyTakeHome;
  const surplus = takeHome - committedTotal - essentialsTotal;
  const funMoney = surplus - savingsTotal;

  // In realistic mode, "balance" = takeHome - committed - essentials - lifestyle
  const balanceAfterWants = takeHome - committedTotal - essentialsTotal - lifestyleTotal;

  const budgetSummary = useMemo(() => ({
    income,
    committed,
    essentials,
    savings,
    discretionary,
    committedTotal,
    essentialsTotal,
    savingsTotal,
    lifestyleTotal,
    budgetMode,
    budgetRule,
  }), [income, committed, essentials, savings, discretionary, committedTotal, essentialsTotal, savingsTotal, lifestyleTotal, budgetMode, budgetRule]);

  // Navigation
  const goToStep = useCallback((s) => {
    setStep(s);
    setViewMode("wizard");
  }, []);
  const continueToNext = useCallback(() => {
    setCompletedSteps((prev) => [...new Set([...prev, step])]);
    setStep((s) => s + 1);
  }, [step]);
  const goBack = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Scroll to top when moving between steps (skip initial mount)
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (prevStepRef.current !== step) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      prevStepRef.current = step;
    }
  }, [step]);

  // Save / Load / Reset
  const buildBudgetData = (id) => ({
    id: id || crypto.randomUUID(),
    name: budgetName.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    income: { ...income },
    committed: committed.map((i) => ({ ...i, monthlyAmount: toMonthly(i.amount, i.frequency) })),
    essentials: essentials.map((i) => ({ ...i, monthlyAmount: toMonthly(i.amount, i.frequency) })),
    savings: savings.map((i) => ({ ...i, monthlyAmount: toMonthly(i.amount, i.frequency) })),
    discretionary: discretionary.map((i) => ({ ...i, monthlyAmount: toMonthly(i.amount, i.frequency) })),
    budgetMode,
    budgetRule,
  });

  const handleSave = (overwrite = false) => {
    if (!budgetName.trim()) return;
    let budgets = loadBudgets();
    if (overwrite && loadedBudgetId) {
      budgets = budgets.map((b) =>
        b.id === loadedBudgetId ? buildBudgetData(loadedBudgetId) : b
      );
    } else {
      const newBudget = buildBudgetData();
      budgets.push(newBudget);
      setLoadedBudgetId(newBudget.id);
    }
    saveBudgets(budgets);
    setShowSave(false);
    setViewMode("overview");
  };

  const handleLoad = (budget) => {
    // Merge with defaults so old saved budgets pick up any new income fields
    setIncome({
      pensionEmployerMatchEnabled: false,
      pensionEmployerMatchPct: 5,
      manualPensionMonthly: 0,
      deductions: [],
      ...budget.income,
    });
    setCommitted(budget.committed);
    setEssentials(budget.essentials);
    setSavings(budget.savings);
    setDiscretionary(budget.discretionary);
    setBudgetName(budget.name || "");
    setLoadedBudgetId(budget.id);
    if (budget.budgetMode) setBudgetMode(budget.budgetMode);
    if (budget.budgetRule) setBudgetRule(budget.budgetRule);
    setCompletedSteps([0, 1, 2, 3, 4, 5]);
    setViewMode("overview");
    setShowLoad(false);
  };

  const handleDelete = (id) => {
    const target = loadBudgets().find((b) => b.id === id);
    if (!window.confirm(`Delete "${target?.name || "this budget"}"? This can't be undone.`)) return;
    saveBudgets(loadBudgets().filter((b) => b.id !== id));
    if (id === loadedBudgetId) setLoadedBudgetId(null);
    setBudgetsVersion((v) => v + 1);
  };

  const handleReset = () => {
    if (!window.confirm("Start a fresh budget? Unsaved changes will be lost.")) return;
    const defaults = freshDefaults();
    setIncome(defaults.income);
    setCommitted(defaults.committed);
    setEssentials(defaults.essentials);
    setSavings(defaults.savings);
    setDiscretionary(defaults.discretionary);
    setStep(0);
    setCompletedSteps([]);
    setBudgetName("");
    setLoadedBudgetId(null);
    setViewMode("wizard");
  };

  // ── Step labels (dynamic based on mode) ──
  const stepLabels = budgetMode === "realistic"
    ? ["Setup", "Income", "Committed", "Essentials", "Lifestyle", "Savings", "Summary"]
    : ["Setup", "Income", "Committed", "Essentials", "Savings", "Lifestyle", "Summary"];

  // ── Render step content ──
  const renderStep = () => {
    const isRealistic = budgetMode === "realistic";

    switch (step) {
      case 0:
        return (
          <StepSetup
            budgetMode={budgetMode}
            onBudgetModeChange={setBudgetMode}
            budgetRule={budgetRule}
            onBudgetRuleChange={setBudgetRule}
            takeHome={takeHome}
            onContinue={continueToNext}
          />
        );
      case 1:
        return <StepIncome income={income} onChange={setIncome} onContinue={continueToNext} onBack={goBack} />;
      case 2:
        return (
          <StepCommitted
            items={committed}
            onChange={setCommitted}
            takeHome={takeHome}
            onContinue={continueToNext}
            onBack={goBack}
          />
        );
      case 3:
        return (
          <StepEssentials
            items={essentials}
            onChange={setEssentials}
            takeHome={takeHome}
            committedTotal={committedTotal}
            onContinue={continueToNext}
            onBack={goBack}
          />
        );
      case 4:
        if (isRealistic) {
          return (
            <StepLifestyle
              items={discretionary}
              onChange={setDiscretionary}
              funMoney={surplus}
              onContinue={continueToNext}
              onBack={goBack}
            />
          );
        }
        return (
          <StepSavings
            items={savings}
            onChange={setSavings}
            takeHome={takeHome}
            surplus={surplus}
            committedTotal={committedTotal}
            essentialsTotal={essentialsTotal}
            income={income}
            onContinue={continueToNext}
            onBack={goBack}
          />
        );
      case 5:
        if (isRealistic) {
          return (
            <StepSavings
              items={savings}
              onChange={setSavings}
              takeHome={takeHome}
              surplus={balanceAfterWants}
              committedTotal={committedTotal}
              essentialsTotal={essentialsTotal}
              lifestyleTotal={lifestyleTotal}
              budgetMode="realistic"
              income={income}
              onContinue={continueToNext}
              onBack={goBack}
            />
          );
        }
        return (
          <StepLifestyle
            items={discretionary}
            onChange={setDiscretionary}
            funMoney={funMoney}
            onContinue={continueToNext}
            onBack={goBack}
          />
        );
      case 6:
        return (
          <StepSummary
            budget={budgetSummary}
            onEdit={goToStep}
            onSave={() => setShowSave(true)}
            onReset={handleReset}
            onViewOverview={() => setViewMode("overview")}
          />
        );
      default:
        return null;
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const savedBudgets = useMemo(() => ((showLoad || showSave) ? loadBudgets() : []), [showLoad, showSave, budgetsVersion]);
  const hasSavedBudgets = loadBudgets().length > 0;
  const isFirstStep = step === 0 && viewMode === "wizard" && completedSteps.length === 0;

  // ── Shared dialogs ──
  const saveDialog = showSave && (
    <Modal title="Save Budget" onClose={() => setShowSave(false)} maxWidth="max-w-sm">
      <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Budget name</label>
            <Input
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && budgetName.trim() && handleSave(!!loadedBudgetId)}
              placeholder="e.g. April 2026"
              autoFocus
            />
          </div>
          {loadedBudgetId ? (
            <div className="space-y-2">
              <Button variant="brand" size="md" onClick={() => handleSave(true)} disabled={!budgetName.trim()} className="w-full gap-2">
                <Save size={14} />
                Save
              </Button>
              <Button variant="outline" size="md" onClick={() => handleSave(false)} disabled={!budgetName.trim()} className="w-full gap-2">
                <FilePlus size={14} />
                Save as Copy
              </Button>
            </div>
          ) : (
            <Button variant="brand" size="md" onClick={() => handleSave(false)} disabled={!budgetName.trim()} className="w-full gap-2">
              <Save size={14} />
              Save
            </Button>
          )}
          {loadedBudgetId && (
            <p className="text-[10px] text-muted-foreground text-center">
              "Save" updates your existing budget. "Save as Copy" creates a new one.
            </p>
          )}
      </div>
    </Modal>
  );

  const loadDialog = showLoad && (
    <Modal title="Your Budgets" onClose={() => setShowLoad(false)} maxWidth="max-w-md" bodyClassName="pt-3">
          {savedBudgets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No saved budgets yet.</p>
          ) : (
            <div className="space-y-2">
              {savedBudgets.map((b) => (
                <div
                  key={b.id}
                  className={cn(
                    "flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors",
                    b.id === loadedBudgetId ? "border-brand/40 bg-brand/5" : "border-border"
                  )}
                >
                  <button onClick={() => handleLoad(b)} className="flex-1 text-left">
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.updatedAt).toLocaleDateString("en-GB")}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(b.id); }}
                    aria-label={`Delete ${b.name}`}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
    </Modal>
  );

  const BUDGET_RULE_PRESETS = [
    { label: "50 / 30 / 20", needs: 50, wants: 30, savings: 20 },
    { label: "60 / 20 / 20", needs: 60, wants: 20, savings: 20 },
    { label: "60 / 30 / 10", needs: 60, wants: 30, savings: 10 },
    { label: "70 / 20 / 10", needs: 70, wants: 20, savings: 10 },
    { label: "80 / 10 / 10", needs: 80, wants: 10, savings: 10 },
  ];

  const settingsDialog = showSettings && (
    <Modal title="Budget Settings" onClose={() => setShowSettings(false)} maxWidth="max-w-sm">
      <div className="space-y-5">
          {/* Budget approach */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Budget approach</label>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setBudgetMode("realistic")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all duration-150 text-center",
                  budgetMode === "realistic" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Lifestyle first
              </button>
              <button
                onClick={() => setBudgetMode("traditional")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all duration-150 text-center",
                  budgetMode === "traditional" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Savings first
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {budgetMode === "realistic"
                ? "Plan your lifestyle spending first, then save whatever's left. More realistic for most people."
                : "Set savings targets first, then spend what remains. Follows the 'pay yourself first' principle."}
            </p>
          </div>

          {/* Budget rule */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground">Budget rule (Needs / Wants / Savings)</label>
            {/* Custom inputs — prominent */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Needs %</label>
                <Input
                  type="number"
                  min="0" max="100"
                  value={budgetRule.needs}
                  onChange={(e) => setBudgetRule({ ...budgetRule, needs: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  suffix="%"
                  className="h-9 text-center text-sm font-bold"
                />
                {takeHome > 0 && (
                  <p className="text-[10px] text-muted-foreground text-center tabular-nums">
                    {fmt(takeHome * budgetRule.needs / 100)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Wants %</label>
                <Input
                  type="number"
                  min="0" max="100"
                  value={budgetRule.wants}
                  onChange={(e) => setBudgetRule({ ...budgetRule, wants: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  suffix="%"
                  className="h-9 text-center text-sm font-bold"
                />
                {takeHome > 0 && (
                  <p className="text-[10px] text-muted-foreground text-center tabular-nums">
                    {fmt(takeHome * budgetRule.wants / 100)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Savings %</label>
                <Input
                  type="number"
                  min="0" max="100"
                  value={budgetRule.savings}
                  onChange={(e) => setBudgetRule({ ...budgetRule, savings: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  suffix="%"
                  className="h-9 text-center text-sm font-bold"
                />
                {takeHome > 0 && (
                  <p className="text-[10px] text-muted-foreground text-center tabular-nums">
                    {fmt(takeHome * budgetRule.savings / 100)}
                  </p>
                )}
              </div>
            </div>
            {budgetRule.needs + budgetRule.wants + budgetRule.savings !== 100 && (
              <p className="text-[10px] text-warning text-center">
                Totals {budgetRule.needs + budgetRule.wants + budgetRule.savings}% — should add up to 100%
              </p>
            )}
            {/* Presets — quick-pick */}
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_RULE_PRESETS.map((preset) => {
                const isActive = budgetRule.needs === preset.needs && budgetRule.wants === preset.wants && budgetRule.savings === preset.savings;
                return (
                  <button
                    key={preset.label}
                    onClick={() => setBudgetRule({ needs: preset.needs, wants: preset.wants, savings: preset.savings })}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all",
                      isActive
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border text-muted-foreground hover:border-brand/40"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Employer match in savings % */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
            <div>
              <p className="text-xs font-medium text-foreground">Count employer pension match in savings %</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Includes your employer's contribution when calculating your savings rate</p>
            </div>
            <button
              type="button"
              onClick={() => setBudgetRule((r) => ({ ...r, countEmployerMatchInSavings: !r.countEmployerMatchInSavings }))}
              className={cn(
                "relative w-10 h-6 rounded-full transition-colors shrink-0",
                budgetRule.countEmployerMatchInSavings ? "bg-brand" : "bg-muted"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                budgetRule.countEmployerMatchInSavings ? "translate-x-4" : "translate-x-0.5"
              )} />
            </button>
          </div>
      </div>
    </Modal>
  );

  // Overview mode — full-width grid
  if (viewMode === "overview") {
    return (
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        <BudgetOverview
          budget={budgetSummary}
          budgetName={budgetName}
          onSave={() => setShowSave(true)}
          onLoad={() => setShowLoad(true)}
          onReset={handleReset}
          onSettings={() => setShowSettings(true)}
          onChangeIncome={setIncome}
          onChangeCommitted={setCommitted}
          onChangeEssentials={setEssentials}
          onChangeSavings={setSavings}
          onChangeDiscretionary={setDiscretionary}
        />
        {saveDialog}
        {loadDialog}
        {settingsDialog}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-serif text-xl sm:text-2xl text-foreground">Budget Designer</h1>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5">
            <Settings2 size={14} />
            Settings
          </Button>
          {hasSavedBudgets && !isFirstStep && (
            <Button variant="outline" size="sm" onClick={() => setShowLoad(true)} className="gap-1.5">
              <FolderOpen size={14} />
              Load
            </Button>
          )}
        </div>
      </div>

      {/* Prominent load card on first visit when saved budgets exist */}
      {isFirstStep && hasSavedBudgets && (
        <Card className="border-brand/30 bg-brand/5 mb-6 cursor-pointer hover:border-brand/50 transition-colors" onClick={() => setShowLoad(true)}>
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                <FolderOpen size={22} className="text-brand" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Continue where you left off</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  You have {loadBudgets().length} saved budget{loadBudgets().length !== 1 ? "s" : ""}. Load one to view or edit it.
                </p>
              </div>
              <Button variant="brand" size="sm" className="shrink-0 gap-1.5">
                <FolderOpen size={14} />
                Load
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      <ProgressIndicator
        currentStep={step}
        onStepClick={goToStep}
        completedSteps={completedSteps}
        stepLabels={stepLabels}
      />

      {/* Mobile sidebar */}
      {isMobile && step < 6 && (
        <BudgetSidebar budget={budgetSummary} currentStep={step} isMobile />
      )}

      {/* Main layout */}
      <div className={cn("mt-4", !isMobile && step < 6 && "flex gap-6")}>
        {/* Step content */}
        <div className={cn("flex-1 min-w-0", !isMobile && step < 6 && "max-w-2xl")}>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Step {step + 1} of {stepLabels.length}
          </p>
          {renderStep()}
        </div>

        {/* Desktop sidebar */}
        {!isMobile && step < 6 && (
          <div className="w-64 shrink-0">
            <BudgetSidebar budget={budgetSummary} currentStep={step} />
          </div>
        )}
      </div>

      {saveDialog}
      {loadDialog}
      {settingsDialog}
    </div>
  );
}
