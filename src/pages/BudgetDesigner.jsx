import { useState, useMemo, useCallback } from "react";
import { useIsMobile } from "../lib/hooks";
import { toMonthly } from "../lib/ukTax";
import { cn } from "../lib/utils";
import ProgressIndicator from "../components/budget/ProgressIndicator";
import BudgetSidebar from "../components/budget/BudgetSidebar";
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
import { Save, FolderOpen, Trash2, X } from "lucide-react";

// ── Default data ──

const DEFAULT_INCOME = {
  grossAnnual: 0,
  pensionPct: 5,
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
  { id: crypto.randomUUID(), category: "Communications", name: "Streaming subscriptions", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Transport", name: "Car finance / loan", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Transport", name: "Fuel / travel pass", amount: 0, frequency: "monthly" },
  { id: crypto.randomUUID(), category: "Transport", name: "Car insurance", amount: 0, frequency: "annual" },
  { id: crypto.randomUUID(), category: "Other Committed", name: "Gym membership", amount: 0, frequency: "monthly" },
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
  { id: crypto.randomUUID(), name: "Hobbies", amount: 0, frequency: "monthly", monzoCategory: "Shopping" },
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

// ── Sum helpers ──

function sumMonthly(items) {
  return items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
}

// ── Main component ──

export default function BudgetDesigner() {
  const isMobile = useIsMobile();

  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Budget state
  const [income, setIncome] = useState(DEFAULT_INCOME);
  const [committed, setCommitted] = useState(
    DEFAULT_COMMITTED.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );
  const [essentials, setEssentials] = useState(
    DEFAULT_ESSENTIALS.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );
  const [savings, setSavings] = useState(
    DEFAULT_SAVINGS.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );
  const [discretionary, setDiscretionary] = useState(
    DEFAULT_DISCRETIONARY.map((i) => ({ ...i, id: crypto.randomUUID() }))
  );

  // View mode: "wizard" or "overview"
  const [viewMode, setViewMode] = useState("wizard");

  // Save dialog
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [budgetName, setBudgetName] = useState("");
  const [loadedBudgetId, setLoadedBudgetId] = useState(null);

  // Computed totals
  const committedTotal = useMemo(() => sumMonthly(committed), [committed]);
  const essentialsTotal = useMemo(() => sumMonthly(essentials), [essentials]);
  const savingsTotal = useMemo(() => sumMonthly(savings), [savings]);
  const lifestyleTotal = useMemo(() => sumMonthly(discretionary), [discretionary]);
  const takeHome = income.monthlyTakeHome;
  const surplus = takeHome - committedTotal - essentialsTotal;
  const funMoney = surplus - savingsTotal;

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
  }), [income, committed, essentials, savings, discretionary, committedTotal, essentialsTotal, savingsTotal, lifestyleTotal]);

  // Navigation
  const goToStep = useCallback((s) => {
    setStep(s);
    setViewMode("wizard");
  }, []);
  const continueToNext = useCallback(() => {
    setCompletedSteps((prev) => [...new Set([...prev, step])]);
    setStep((s) => s + 1);
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
    setIncome(budget.income);
    setCommitted(budget.committed);
    setEssentials(budget.essentials);
    setSavings(budget.savings);
    setDiscretionary(budget.discretionary);
    setBudgetName(budget.name || "");
    setLoadedBudgetId(budget.id);
    setCompletedSteps([0, 1, 2, 3, 4]);
    setViewMode("overview");
    setShowLoad(false);
  };

  const handleDelete = (id) => {
    const budgets = loadBudgets().filter((b) => b.id !== id);
    saveBudgets(budgets);
  };

  const handleReset = () => {
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

  // ── Render step content ──
  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepIncome income={income} onChange={setIncome} onContinue={continueToNext} />;
      case 1:
        return (
          <StepCommitted
            items={committed}
            onChange={setCommitted}
            takeHome={takeHome}
            onContinue={continueToNext}
          />
        );
      case 2:
        return (
          <StepEssentials
            items={essentials}
            onChange={setEssentials}
            takeHome={takeHome}
            committedTotal={committedTotal}
            onContinue={continueToNext}
          />
        );
      case 3:
        return (
          <StepSavings
            items={savings}
            onChange={setSavings}
            takeHome={takeHome}
            surplus={surplus}
            committedTotal={committedTotal}
            essentialsTotal={essentialsTotal}
            onContinue={continueToNext}
          />
        );
      case 4:
        return (
          <StepLifestyle
            items={discretionary}
            onChange={setDiscretionary}
            funMoney={funMoney}
            onContinue={continueToNext}
          />
        );
      case 5:
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

  const savedBudgets = showLoad ? loadBudgets() : [];

  // Overview mode — full-width grid
  if (viewMode === "overview") {
    return (
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        <BudgetOverview
          budget={budgetSummary}
          budgetName={budgetName}
          onSave={() => setShowSave(true)}
          onReset={handleReset}
          onChangeCommitted={setCommitted}
          onChangeEssentials={setEssentials}
          onChangeSavings={setSavings}
          onChangeDiscretionary={setDiscretionary}
        />

        {/* Save dialog with overwrite/save-as-new */}
        {showSave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSave(false)}>
            <Card className="w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <CardContent className="py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Save Budget</h3>
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowSave(false)}>
                    <X size={14} />
                  </Button>
                </div>
                <Input
                  value={budgetName}
                  onChange={(e) => setBudgetName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave(!!loadedBudgetId)}
                  placeholder="e.g. April 2026"
                  autoFocus
                />
                <div className="flex gap-2">
                  {loadedBudgetId && (
                    <Button variant="brand" size="md" onClick={() => handleSave(true)} disabled={!budgetName.trim()} className="flex-1 gap-2">
                      <Save size={14} />
                      Overwrite
                    </Button>
                  )}
                  <Button
                    variant={loadedBudgetId ? "outline" : "brand"}
                    size="md"
                    onClick={() => handleSave(false)}
                    disabled={!budgetName.trim()}
                    className="flex-1 gap-2"
                  >
                    <Save size={14} />
                    Save as New
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Load dialog */}
        {showLoad && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowLoad(false)}>
            <Card className="w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <CardContent className="py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Saved Budgets</h3>
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowLoad(false)}>
                    <X size={14} />
                  </Button>
                </div>
                {savedBudgets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No saved budgets yet.</p>
                ) : (
                  <div className="space-y-2">
                    {savedBudgets.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
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
                          onClick={() => handleDelete(b.id)}
                          className="text-muted-foreground hover:text-danger"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-serif text-xl sm:text-2xl text-foreground">Budget Designer</h1>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setShowLoad(true)} className="gap-1.5 text-muted-foreground">
            <FolderOpen size={14} />
            <span className="hidden sm:inline">Load</span>
          </Button>
        </div>
      </div>

      {/* Progress */}
      <ProgressIndicator
        currentStep={step}
        onStepClick={goToStep}
        completedSteps={completedSteps}
      />

      {/* Mobile sidebar */}
      {isMobile && step < 5 && (
        <BudgetSidebar budget={budgetSummary} currentStep={step} isMobile />
      )}

      {/* Main layout */}
      <div className={cn("mt-4", !isMobile && step < 5 && "flex gap-6")}>
        {/* Step content */}
        <div className={cn("flex-1 min-w-0", !isMobile && step < 5 && "max-w-2xl")}>
          {renderStep()}
        </div>

        {/* Desktop sidebar */}
        {!isMobile && step < 5 && (
          <div className="w-64 shrink-0">
            <BudgetSidebar budget={budgetSummary} currentStep={step} />
          </div>
        )}
      </div>

      {/* Save dialog */}
      {showSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSave(false)}>
          <Card className="w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <CardContent className="py-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Save Budget</h3>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowSave(false)}>
                  <X size={14} />
                </Button>
              </div>
              <Input
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="e.g. April 2026"
                autoFocus
              />
              <Button variant="brand" size="md" onClick={handleSave} disabled={!budgetName.trim()} className="w-full gap-2">
                <Save size={14} />
                Save
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Load dialog */}
      {showLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowLoad(false)}>
          <Card className="w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardContent className="py-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Saved Budgets</h3>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowLoad(false)}>
                  <X size={14} />
                </Button>
              </div>
              {savedBudgets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No saved budgets yet.</p>
              ) : (
                <div className="space-y-2">
                  {savedBudgets.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
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
                        onClick={() => handleDelete(b.id)}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
