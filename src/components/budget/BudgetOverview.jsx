import { useState, useMemo } from "react";
import { Card, CardContent } from "../ui/card";
import Modal from "../ui/modal";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { toMonthly, FREQUENCY_OPTIONS, fmtMoney, fmtInputValue, evalFormula } from "../../lib/ukTax";
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { Edit2, Save, Plus, X, FolderOpen, Settings2, Download } from "lucide-react";
import StepIncome from "./StepIncome";

ChartJS.register(ArcElement, ChartTooltip, Legend);

const fmt = fmtMoney;

function effectiveMonthly(item) {
  const monthly = toMonthly(item.amount, item.frequency);
  if (item.name === "Council Tax" && item.singlePerson) return monthly * 0.75;
  return monthly;
}

// ── Ring gauge (card tile) ──

function RingGauge({ label, actual, target, isMin, amount, targetAmount, accentColor, bgClass, borderClass, labelClass }) {
  const pct = Math.min(actual, 100);
  const onTarget = isMin ? actual >= target : actual <= target;
  const close = isMin ? actual >= target - 5 : actual <= target + 5;
  const color = onTarget ? "text-success" : close ? "text-warning" : "text-danger";
  const stroke = onTarget ? "stroke-success" : close ? "stroke-warning" : "stroke-danger";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-xl border px-4 py-3 flex-1 min-w-[100px]", bgClass, borderClass)}>
      <p className={cn("text-[10px] font-bold uppercase tracking-widest", labelClass)}>{label}</p>
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="36" fill="none" strokeWidth="8" className="stroke-muted/60" />
          <circle
            cx="50" cy="50" r="36" fill="none" strokeWidth="8"
            className={cn(stroke, "transition-all duration-500")}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-sm font-bold tabular-nums", color)}>{actual.toFixed(0)}%</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        {amount !== undefined && (
          <p className="text-xs font-semibold tabular-nums text-foreground">{fmt(amount)}</p>
        )}
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {isMin ? "≥" : "≤"}{target}% · {targetAmount !== undefined ? fmt(targetAmount) : ""}
        </p>
      </div>
    </div>
  );
}

// ── Read-only line ──

function LineRow({ label, amount, pct }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground truncate mr-2">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {pct != null && (
          <span className="text-[10px] tabular-nums text-muted-foreground/70 bg-muted px-1 py-0.5 rounded">
            {pct.toFixed(1)}% gross
          </span>
        )}
        <span className="text-xs font-medium tabular-nums">{fmt(amount)}</span>
      </div>
    </div>
  );
}

// ── Editable line item (used inside dialog) ──

function EditableRow({ item, onChange, onRemove }) {
  const [rawInput, setRawInput] = useState(null);

  // Keep raw text while typing so decimals and "=" formulas survive re-renders
  const handleAmountChange = (e) => {
    const raw = e.target.value;
    setRawInput(raw);
    if (raw.startsWith("=")) return;
    const clean = raw.replace(/,/g, "");
    const val = clean === "" ? 0 : Number(clean);
    if (!isNaN(val) && val >= 0) onChange({ ...item, amount: val });
  };

  const handleAmountBlur = () => {
    if (rawInput && rawInput.startsWith("=")) {
      const result = evalFormula(rawInput.slice(1));
      if (!isNaN(result) && result >= 0) {
        onChange({ ...item, amount: Math.round(result * 100) / 100 });
      }
    }
    setRawInput(null);
  };

  return (
    <div className="group flex items-center gap-2 py-1.5">
      <Input
        value={item.name}
        onChange={(e) => onChange({ ...item, name: e.target.value })}
        className="h-8 text-sm flex-1 min-w-0"
      />
      <Input
        type="text"
        inputMode="decimal"
        prefix="£"
        value={rawInput !== null ? rawInput : fmtInputValue(item.amount)}
        onChange={handleAmountChange}
        onBlur={handleAmountBlur}
        onKeyDown={(e) => e.key === "Enter" && handleAmountBlur()}
        placeholder="0"
        className="w-28 h-8 text-sm text-right"
      />
      <Select
        value={item.frequency}
        onChange={(e) => onChange({ ...item, frequency: e.target.value })}
        className="w-auto h-8 text-xs pr-7 pl-2"
      >
        {FREQUENCY_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>/{f.short}</option>
        ))}
      </Select>
      <button
        onClick={onRemove}
        aria-label={`Remove ${item.name || "item"}`}
        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 text-muted-foreground hover:text-danger transition-all p-1 shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Edit dialog ──

function EditDialog({ title, color, items, grouped, onChange, onClose }) {
  const total = items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);

  const handleItemChange = (index, updated) => {
    const next = [...items];
    next[index] = updated;
    onChange(next);
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleAdd = (category) => {
    const newItem = { id: crypto.randomUUID(), name: "", amount: 0, frequency: "monthly" };
    if (category) newItem.category = category;
    onChange([...items, newItem]);
  };

  const groups = useMemo(() => {
    if (!grouped) return null;
    const g = {};
    items.forEach((item, idx) => {
      const cat = item.category || "Other";
      if (!g[cat]) g[cat] = [];
      g[cat].push({ ...item, _idx: idx });
    });
    return g;
  }, [items, grouped]);

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
      }
      ariaLabel={`Edit ${title}`}
      onClose={onClose}
      maxWidth="max-w-lg"
      bodyClassName="pt-3"
      headerExtra={<span className="text-sm font-bold tabular-nums">{fmt(total)}/mo</span>}
    >
          {grouped && groups ? (
            <div className="space-y-4">
              {Object.entries(groups).map(([cat, catItems]) => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{cat}</p>
                  {catItems.map((item) => (
                    <EditableRow
                      key={item.id}
                      item={item}
                      onChange={(updated) => handleItemChange(item._idx, updated)}
                      onRemove={() => handleRemove(item._idx)}
                    />
                  ))}
                  <button
                    onClick={() => handleAdd(cat)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-1.5 mt-0.5"
                  >
                    <Plus size={11} />
                    Add item
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {items.map((item, i) => (
                <EditableRow
                  key={item.id || i}
                  item={item}
                  onChange={(updated) => handleItemChange(i, updated)}
                  onRemove={() => handleRemove(i)}
                />
              ))}
              <button
                onClick={() => handleAdd()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-2"
              >
                <Plus size={11} />
                Add item
              </button>
            </div>
          )}
    </Modal>
  );
}

// ── Read-only category card ──

function CategoryCard({ title, color, accent, items, total, displayTotal, onEdit, children, extraContent }) {
  const filledItems = items ? items.filter((i) => i.amount > 0) : [];
  const hasItems = filledItems.length > 0;
  const shownTotal = displayTotal ?? total;

  return (
    <Card className={cn("break-inside-avoid border-l-2", accent, onEdit && "cursor-pointer hover:border-brand/40 transition-colors")} onClick={onEdit}>
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", color)} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {onEdit && (
          <Edit2 size={12} className="text-muted-foreground" />
        )}
      </div>
      <CardContent className="pt-0 pb-4 px-4">
        {items ? (
          <div className="space-y-0.5">
            {hasItems ? filledItems.map((item, i) => (
              <LineRow
                key={item.id || i}
                label={item.name}
                amount={effectiveMonthly(item)}
              />
            )) : (
              <p className="text-xs text-muted-foreground italic py-1">No items yet</p>
            )}
            {extraContent}
          </div>
        ) : children}
        {shownTotal !== undefined && (
          <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total</span>
            <span className="text-sm font-bold tabular-nums">{fmt(shownTotal)}/mo</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Committed card (read-only, grouped) ──

function CommittedCard({ items, total, onEdit, grossMonthly }) {
  const groupedFilled = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      if (item.amount === 0) return;
      const cat = item.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [items]);

  const hasItems = Object.keys(groupedFilled).length > 0;

  return (
    <Card className="break-inside-avoid border-l-2 border-l-orange-500 cursor-pointer hover:border-brand/40 transition-colors" onClick={onEdit}>
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <h3 className="text-sm font-semibold text-foreground">Committed</h3>
        </div>
        <Edit2 size={12} className="text-muted-foreground" />
      </div>
      <CardContent className="pt-0 pb-4 px-4">
        {hasItems ? Object.entries(groupedFilled).map(([cat, catItems]) => (
          <div key={cat}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mt-1.5 mb-0.5">{cat}</p>
            {catItems.map((item) => {
              const monthly = effectiveMonthly(item);
              const isRent = item.name.toLowerCase().includes("rent");
              const pct = isRent && grossMonthly > 0 ? (monthly / grossMonthly) * 100 : null;
              return <LineRow key={item.id} label={item.name} amount={monthly} pct={pct} />;
            })}
          </div>
        )) : (
          <p className="text-xs text-muted-foreground italic py-1">No items yet</p>
        )}
        <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total</span>
          <span className="text-sm font-bold tabular-nums">{fmt(total)}/mo</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pie chart colors ──

const PIE_COLORS = [
  "hsl(18, 72%, 52%)",   // brand
  "hsl(38, 92%, 50%)",   // amber
  "hsl(210, 60%, 50%)",  // blue
  "hsl(280, 50%, 55%)",  // purple
  "hsl(142, 71%, 40%)",  // green
  "hsl(340, 60%, 55%)",  // pink
  "hsl(180, 50%, 45%)",  // teal
  "hsl(60, 70%, 45%)",   // yellow-green
  "hsl(0, 60%, 55%)",    // red
  "hsl(220, 50%, 60%)",  // slate blue
];

// ── CSV export ──

function exportBudgetCSV(budget, budgetName) {
  const rows = [];
  const inc = budget.income;
  const takeHome = inc.monthlyTakeHome;
  const committed = budget.committedTotal;
  const essentials = budget.essentialsTotal;
  const savings = budget.savingsTotal;
  const lifestyle = budget.lifestyleTotal;
  const totalOutgoings = committed + essentials + savings + lifestyle;
  const unallocated = Math.round((takeHome - totalOutgoings) * 100) / 100;
  const budgetMode = budget.budgetMode || "realistic";
  const budgetRule = budget.budgetRule || { needs: 50, wants: 30, savings: 20, countEmployerMatchInSavings: true };
  const isManual = inc.mode === "manual";

  // Employer match
  const employerMatchMonthly = (() => {
    if (!inc.pensionEmployerMatchEnabled) return 0;
    if (isManual) return inc.pensionEmployerMatchMonthly ?? inc.manualPensionMonthly ?? 0;
    return (inc.grossAnnual ?? 0) * (inc.pensionEmployerMatchPct ?? 0) / 100 / 12;
  })();
  const countMatch = !!(budgetRule.countEmployerMatchInSavings ?? true) && employerMatchMonthly > 0;

  // Effective values (unallocated flows into savings or wants depending on mode)
  const effectiveSavings = savings + (budgetMode === "realistic" && unallocated > 0 ? unallocated : 0);
  const effectiveWants = lifestyle + (budgetMode === "traditional" && unallocated > 0 ? unallocated : 0);
  const pctBase = takeHome + (countMatch ? employerMatchMonthly : 0);
  const needsPct  = pctBase > 0 ? ((committed + essentials) / pctBase) * 100 : 0;
  const wantsPct  = pctBase > 0 ? (effectiveWants / pctBase) * 100 : 0;
  const savingsPct = pctBase > 0 ? ((effectiveSavings + (countMatch ? employerMatchMonthly : 0)) / pctBase) * 100 : 0;
  const needsTarget = takeHome * budgetRule.needs / 100;
  const wantsTarget = takeHome * budgetRule.wants / 100;
  const savingsTarget = takeHome * budgetRule.savings / 100;

  const cell = (v) => (typeof v === "string" && (v.includes(",") || v.includes("\n"))) ? `"${v.replace(/"/g, '""')}"` : String(v ?? "");
  const row = (...cols) => rows.push(cols.map(cell).join(","));
  const blank = () => rows.push("");
  const header = (title) => { blank(); row(title); };

  row(`BUDGET: ${budgetName || "Untitled"}`, "", "", `Exported: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`);
  row(`Mode: ${budgetMode === "realistic" ? "Lifestyle first" : "Savings first"}`, "", "", `Rule: ${budgetRule.needs}/${budgetRule.wants}/${budgetRule.savings}`);
  blank();

  // ── Summary ──
  header("SUMMARY");
  row("Take-home", fmt(takeHome) + "/mo", "", fmt(takeHome * 12) + "/yr");
  row("Total outgoings", fmt(totalOutgoings) + "/mo");
  row("Unallocated", fmt(unallocated) + "/mo", budgetMode === "realistic" ? "(auto-added to savings)" : "(auto-added to wants)");
  row("Daily spend", "£" + ((takeHome - committed - essentials - savings) / 30).toFixed(2));
  if (employerMatchMonthly > 0) {
    row("Employer pension match", fmt(employerMatchMonthly) + "/mo", fmt(employerMatchMonthly * 12) + "/yr", "(outside take-home)");
  }
  blank();

  // ── Budget rule ──
  header(`BUDGET RULE  (${budgetRule.needs} / ${budgetRule.wants} / ${budgetRule.savings})`);
  if (countMatch) row("", "", "", "", "", "* includes employer match in savings");
  row("", "Target %", "Actual %", "Actual £/mo", "Target £/mo", "Status");
  row("Needs",   budgetRule.needs  + "%", needsPct.toFixed(1)  + "%", fmt(committed + essentials), fmt(needsTarget),  needsPct  <= budgetRule.needs  ? "✓ On track" : "✗ Over");
  row("Wants",   budgetRule.wants  + "%", wantsPct.toFixed(1)  + "%", fmt(effectiveWants),          fmt(wantsTarget),  wantsPct  <= budgetRule.wants  ? "✓ On track" : "✗ Over");
  row("Savings", budgetRule.savings + "%", savingsPct.toFixed(1) + "%", fmt(effectiveSavings + (countMatch ? employerMatchMonthly : 0)), fmt(savingsTarget), savingsPct >= budgetRule.savings ? "✓ On track" : "✗ Under");
  row("Savings rate", "", savingsPct.toFixed(1) + "%", "", "", "Annual: " + fmt((effectiveSavings + (countMatch ? employerMatchMonthly : 0)) * 12) + "/yr");
  blank();

  // ── Income ──
  header("INCOME");
  if (isManual) {
    row("Mode", "Manual (take-home entered directly)");
    row("Monthly take-home", fmt(takeHome) + "/mo", fmt(takeHome * 12) + "/yr");
    if ((inc.manualPensionMonthly ?? 0) > 0) {
      row("Your pension contribution", fmt(inc.manualPensionMonthly) + "/mo", fmt(inc.manualPensionMonthly * 12) + "/yr", "(already deducted from take-home)");
    }
  } else {
    row("Mode", "Calculated from salary");
    row("Gross annual salary", fmt(inc.grossAnnual) + "/yr", fmt(inc.grossAnnual / 12) + "/mo");
    if ((inc.pensionPct ?? 0) > 0) {
      const pensionMo = (inc.grossAnnual * inc.pensionPct / 100) / 12;
      row("Pension (salary sacrifice)", inc.pensionPct + "%", fmt(pensionMo) + "/mo", fmt(pensionMo * 12) + "/yr");
    }
    if (inc.studentLoan && inc.studentLoan !== "none") row("Student loan", inc.studentLoan.replace("plan", "Plan "));
    if ((inc.deductions || []).length > 0) {
      row("Other payroll deductions:");
      (inc.deductions || []).forEach((d) => {
        const mo = toMonthly(d.amount, d.frequency);
        if (mo > 0) row("  " + d.name, fmt(d.amount), d.frequency, fmt(mo) + "/mo");
      });
    }
    row("Net take-home", fmt(takeHome) + "/mo", fmt(takeHome * 12) + "/yr");
  }
  if (employerMatchMonthly > 0) {
    row("Employer pension match", fmt(employerMatchMonthly) + "/mo", fmt(employerMatchMonthly * 12) + "/yr", "(free money — outside your take-home)");
  }
  blank();

  // ── Committed ──
  header(`COMMITTED  (${fmt(committed)}/mo  ·  ${fmt(committed * 12)}/yr)`);
  row("Category", "Item", "Amount", "Frequency", "Monthly");
  budget.committed.forEach((item) => {
    const monthly = effectiveMonthly(item);
    if (monthly > 0) row(item.category || "", item.name, fmt(item.amount), item.frequency, fmt(monthly));
  });
  row("", "TOTAL", "", "", fmt(committed), fmt(committed * 12) + "/yr");
  blank();

  // ── Essentials ──
  header(`ESSENTIALS  (${fmt(essentials)}/mo  ·  ${fmt(essentials * 12)}/yr)`);
  row("Item", "Amount", "Frequency", "Monthly");
  budget.essentials.forEach((item) => {
    const monthly = toMonthly(item.amount, item.frequency);
    if (monthly > 0) row(item.name, fmt(item.amount), item.frequency, fmt(monthly));
  });
  row("TOTAL", "", "", fmt(essentials), fmt(essentials * 12) + "/yr");
  blank();

  // ── Savings ──
  const savingsDisplayTotal = effectiveSavings + (countMatch ? employerMatchMonthly : 0);
  header(`SAVINGS  (${fmt(savingsDisplayTotal)}/mo  ·  ${fmt(savingsDisplayTotal * 12)}/yr)`);
  row("Item", "Amount", "Frequency", "Monthly", "Annual", "Note");
  budget.savings.forEach((item) => {
    const monthly = toMonthly(item.amount, item.frequency);
    if (monthly > 0) row(item.name, fmt(item.amount), item.frequency, fmt(monthly), fmt(monthly * 12), "");
  });
  if (budgetMode === "realistic" && unallocated > 0) {
    row("Unallocated (auto-saved)", "", "", fmt(unallocated), fmt(unallocated * 12), "surplus flows to savings");
  }
  if (employerMatchMonthly > 0) {
    row("Employer pension match", "", "", fmt(employerMatchMonthly), fmt(employerMatchMonthly * 12), "outside take-home" + (!countMatch ? " (not in % calc)" : ""));
  }
  row("TOTAL (savings goals)", "", "", fmt(savings), fmt(savings * 12));
  if (unallocated > 0 || employerMatchMonthly > 0) {
    row("TOTAL (effective savings)", "", "", fmt(savingsDisplayTotal), fmt(savingsDisplayTotal * 12));
  }
  blank();

  // ── Lifestyle / Wants ──
  const lifestyleDisplayTotal = effectiveWants;
  header(`LIFESTYLE / WANTS  (${fmt(lifestyleDisplayTotal)}/mo  ·  ${fmt(lifestyleDisplayTotal * 12)}/yr)`);
  row("Item", "Amount", "Frequency", "Monthly");
  budget.discretionary.forEach((item) => {
    const monthly = toMonthly(item.amount, item.frequency);
    if (monthly > 0) row(item.name, fmt(item.amount), item.frequency, fmt(monthly));
  });
  if (budgetMode === "traditional" && unallocated > 0) {
    row("Unallocated (auto-added)", "", "", fmt(unallocated), "surplus flows to wants");
  }
  row("TOTAL", "", "", fmt(lifestyleDisplayTotal), fmt(lifestyleDisplayTotal * 12) + "/yr");

  const csv = rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(budgetName || "budget").replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main overview ──

export default function BudgetOverview({ budget, budgetName, onSave, onLoad, onReset, onSettings, onChangeIncome, onChangeCommitted, onChangeEssentials, onChangeSavings, onChangeDiscretionary }) {
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingIncome, setEditingIncome] = useState(false);

  const takeHome = budget.income.monthlyTakeHome;
  const committed = budget.committedTotal;
  const essentials = budget.essentialsTotal;
  const savings = budget.savingsTotal;
  const lifestyle = budget.lifestyleTotal;
  const totalOutgoings = committed + essentials + savings + lifestyle;
  const unallocated = Math.round((takeHome - totalOutgoings) * 100) / 100;

  const budgetRule = budget.budgetRule || { needs: 50, wants: 30, savings: 20, countEmployerMatchInSavings: true };
  const budgetMode = budget.budgetMode || "realistic";

  // Unallocated flows into savings (lifestyle-first) or wants (savings-first)
  const effectiveSavings = savings + (budgetMode === "realistic" && unallocated > 0 ? unallocated : 0);
  const effectiveWants = lifestyle + (budgetMode === "traditional" && unallocated > 0 ? unallocated : 0);

  const needsTarget = takeHome * budgetRule.needs / 100;
  const wantsTarget = takeHome * budgetRule.wants / 100;
  const savingsTarget = takeHome * budgetRule.savings / 100;

  const incomeInfo = budget.income;
  const isManual = incomeInfo.mode === "manual";

  // Employer match monthly amount — calc mode uses gross %, manual mode uses explicit field
  const employerMatchMonthly = (() => {
    if (!incomeInfo.pensionEmployerMatchEnabled) return 0;
    if (isManual) return incomeInfo.pensionEmployerMatchMonthly ?? incomeInfo.manualPensionMonthly ?? 0;
    return (incomeInfo.grossAnnual ?? 0) * (incomeInfo.pensionEmployerMatchPct ?? 0) / 100 / 12;
  })();

  // For % calculations: optionally include employer match in savings
  const countMatch = !!(budgetRule.countEmployerMatchInSavings ?? true) && employerMatchMonthly > 0;
  // The "base" for percentage calculations — takeHome + employer match if counting it
  const pctBase = takeHome + (countMatch ? employerMatchMonthly : 0);
  const savingsPctAdj = pctBase > 0 ? ((effectiveSavings + (countMatch ? employerMatchMonthly : 0)) / pctBase) * 100 : 0;
  const needsPctAdj = pctBase > 0 ? ((committed + essentials) / pctBase) * 100 : 0;
  const wantsPctAdj = pctBase > 0 ? (effectiveWants / pctBase) * 100 : 0;

  const compound = (monthly, years) => {
    let total = 0;
    for (let m = 0; m < years * 12; m++) {
      total = (total + monthly) * (1 + 0.07 / 12);
    }
    return total;
  };

  // ── Pie chart data ──

  // 1. Needs / Wants / Savings split
  const splitData = useMemo(() => {
    const needs = committed + essentials;
    const segments = [];
    if (needs > 0) segments.push({ label: "Needs", value: needs, color: "hsl(18, 72%, 52%)" });
    if (effectiveWants > 0) segments.push({ label: "Wants", value: effectiveWants, color: "hsl(280, 50%, 55%)" });
    const savingsForPie = effectiveSavings + (countMatch ? employerMatchMonthly : 0);
    if (savingsForPie > 0) segments.push({ label: "Savings", value: savingsForPie, color: "hsl(210, 60%, 50%)" });
    return {
      labels: segments.map((s) => s.label),
      datasets: [{
        data: segments.map((s) => s.value),
        backgroundColor: segments.map((s) => s.color),
        borderWidth: 2,
        borderColor: "hsl(40, 30%, 97%)",
      }],
    };
  }, [committed, essentials, effectiveWants, effectiveSavings, countMatch, employerMatchMonthly]);

  // 2. Individual category breakdown
  const categoryData = useMemo(() => {
    const cats = [];
    // Group committed by category
    const committedGroups = {};
    budget.committed.forEach((item) => {
      if (item.amount === 0) return;
      const cat = item.category || "Other";
      committedGroups[cat] = (committedGroups[cat] || 0) + effectiveMonthly(item);
    });
    Object.entries(committedGroups).forEach(([cat, val]) => cats.push({ label: cat, value: val }));

    // Essentials as one
    if (essentials > 0) cats.push({ label: "Essentials", value: essentials });

    // Individual lifestyle items
    budget.discretionary.forEach((item) => {
      const v = toMonthly(item.amount, item.frequency);
      if (v > 0) cats.push({ label: item.name, value: v });
    });

    // Savings items
    budget.savings.forEach((item) => {
      const v = toMonthly(item.amount, item.frequency);
      if (v > 0) cats.push({ label: item.name, value: v });
    });

    if (unallocated > 0) cats.push({ label: "Unallocated", value: unallocated });

    return {
      labels: cats.map((c) => c.label),
      datasets: [{
        data: cats.map((c) => c.value),
        backgroundColor: cats.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
        borderWidth: 2,
        borderColor: "hsl(40, 30%, 97%)",
      }],
    };
  }, [budget.committed, budget.discretionary, budget.savings, essentials, unallocated]);

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 10,
          padding: 10,
          font: { family: "'Instrument Sans', sans-serif", size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
            return `${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
          },
        },
      },
    },
    cutout: "55%",
  };

  // Edit dialog config
  const editConfigs = {
    committed: { title: "Committed", color: "bg-brand", items: budget.committed, onChange: onChangeCommitted, grouped: true },
    essentials: { title: "Essentials", color: "bg-warning", items: budget.essentials, onChange: onChangeEssentials, grouped: false },
    savings: { title: "Savings", color: "bg-blue-500", items: budget.savings, onChange: onChangeSavings, grouped: false },
    lifestyle: { title: "Lifestyle", color: "bg-purple-500", items: budget.discretionary, onChange: onChangeDiscretionary, grouped: false },
  };

  const activeEdit = editingCategory ? editConfigs[editingCategory] : null;

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl text-foreground">
            {budgetName || "Budget Overview"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">All figures are monthly</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="brand" size="sm" onClick={onSave} className="gap-1.5">
            <Save size={13} />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={onLoad} className="gap-1.5">
            <FolderOpen size={13} />
            Load
          </Button>
          <Button variant="outline" size="sm" onClick={onSettings} className="gap-1.5">
            <Settings2 size={14} />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportBudgetCSV(budget, budgetName)} className="gap-1.5">
            <Download size={13} />
            Export
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
            <Plus size={13} />
            New
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Take-home</p>
          <p className="text-lg font-bold tabular-nums text-success">{fmt(takeHome)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Outgoings</p>
          <p className="text-lg font-bold tabular-nums">{fmt(totalOutgoings)}</p>
        </div>
        <div className={cn(
          "border rounded-lg px-4 py-3",
          unallocated >= 0 ? "bg-success/5 border-success/20" : "bg-danger/5 border-danger/20"
        )}>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Unallocated</p>
          <p className={cn("text-lg font-bold tabular-nums", unallocated >= 0 ? "text-success" : "text-danger")}>
            {fmt(unallocated)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Daily spend</p>
          <p className="text-lg font-bold tabular-nums">
            £{((takeHome - committed - essentials - savings) / 30).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Budget rule gauges + insights */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex gap-3">
              <RingGauge
                label="Needs" actual={needsPctAdj} target={budgetRule.needs} isMin={false}
                amount={committed + essentials} targetAmount={needsTarget}
                bgClass="bg-orange-500/5" borderClass="border-orange-500/25" labelClass="text-orange-600 dark:text-orange-400"
              />
              <RingGauge
                label="Wants" actual={wantsPctAdj} target={budgetRule.wants} isMin={false}
                amount={effectiveWants} targetAmount={wantsTarget}
                bgClass="bg-purple-500/5" borderClass="border-purple-500/25" labelClass="text-purple-600 dark:text-purple-400"
              />
              <RingGauge
                label="Savings" actual={savingsPctAdj} target={budgetRule.savings} isMin={true}
                amount={effectiveSavings + (countMatch ? employerMatchMonthly : 0)} targetAmount={savingsTarget}
                bgClass="bg-blue-500/5" borderClass="border-blue-500/25" labelClass="text-blue-600 dark:text-blue-400"
              />
            </div>
            <div className="hidden sm:block w-px bg-border self-stretch" />
            <div className="flex flex-wrap gap-x-6 gap-y-2 flex-1 min-w-0">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Savings rate</p>
                <p className="text-sm font-bold tabular-nums">{savingsPctAdj.toFixed(1)}%</p>
              </div>
              {effectiveSavings > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Annual savings</p>
                  <p className="text-sm font-bold tabular-nums">{fmt((effectiveSavings + (countMatch ? employerMatchMonthly : 0)) * 12)}/yr</p>
                </div>
              )}
              {savings > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Projected (7%)</p>
                  <p className="text-xs tabular-nums">5yr: {fmt(compound(savings, 5))} · 10yr: {fmt(compound(savings, 10))}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Rule</p>
                <p className="text-sm font-bold tabular-nums">{budgetRule.needs}/{budgetRule.wants}/{budgetRule.savings}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category cards — masonry layout */}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-4 space-y-4">
        {/* Income */}
        <Card
          className={cn("break-inside-avoid border-l-2 border-l-green-500", onChangeIncome && "cursor-pointer hover:border-brand/40 transition-colors")}
          onClick={onChangeIncome ? () => setEditingIncome(true) : undefined}
        >
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <h3 className="text-sm font-semibold text-foreground">Income</h3>
            </div>
            {onChangeIncome && <Edit2 size={12} className="text-muted-foreground" />}
          </div>
          <CardContent className="pt-0 pb-4 px-4">
            {isManual ? (
              <LineRow label="Manual take-home" amount={takeHome} />
            ) : (
              <>
                <LineRow label={`Gross salary (${fmt(incomeInfo.grossAnnual)}/yr)`} amount={incomeInfo.grossAnnual / 12} />
                {incomeInfo.pensionPct > 0 && (
                  <LineRow label={`Your pension (${incomeInfo.pensionPct}% salary sacrifice)`} amount={incomeInfo.grossAnnual * incomeInfo.pensionPct / 100 / 12} />
                )}
                {incomeInfo.pensionEmployerMatchEnabled && employerMatchMonthly > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-success truncate mr-2">Employer pension match</span>
                    <span className="text-xs font-medium tabular-nums text-success shrink-0">+{fmt(employerMatchMonthly)}</span>
                  </div>
                )}
                {incomeInfo.studentLoan !== "none" && (
                  <div className="py-1">
                    <span className="text-xs text-muted-foreground">Student loan: {incomeInfo.studentLoan.replace("plan", "Plan ")}</span>
                  </div>
                )}
              </>
            )}
            <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Net take-home</span>
              <span className="text-sm font-bold tabular-nums text-success">{fmt(takeHome)}/mo</span>
            </div>
          </CardContent>
        </Card>

        <CommittedCard items={budget.committed} total={committed} onEdit={() => setEditingCategory("committed")} grossMonthly={isManual ? null : (incomeInfo.grossAnnual ?? 0) / 12} />

        <CategoryCard title="Essentials" color="bg-warning" accent="border-l-orange-400" items={budget.essentials} total={essentials} onEdit={() => setEditingCategory("essentials")} />

        <Card className="break-inside-avoid border-l-2 border-l-blue-500 cursor-pointer hover:border-brand/40 transition-colors" onClick={() => setEditingCategory("savings")}>
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold text-foreground">Savings</h3>
            </div>
            <Edit2 size={12} className="text-muted-foreground" />
          </div>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="space-y-0.5">
              {budget.savings.filter((i) => i.amount > 0).length > 0 ? (
                budget.savings.filter((i) => i.amount > 0).map((item, i) => (
                  <LineRow key={item.id || i} label={item.name} amount={toMonthly(item.amount, item.frequency)} />
                ))
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingCategory("savings"); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-1"
                >
                  <Plus size={12} />
                  Add a savings goal
                </button>
              )}
              {budgetMode === "realistic" && unallocated > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-success truncate mr-2">Auto-saved surplus</span>
                  <span className="text-xs font-medium tabular-nums text-success shrink-0">+{fmt(unallocated)}</span>
                </div>
              )}
              {incomeInfo.pensionEmployerMatchEnabled && employerMatchMonthly > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-success truncate mr-2">Employer pension match</span>
                  <span className="text-xs font-medium tabular-nums text-success shrink-0">+{fmt(employerMatchMonthly)}</span>
                </div>
              )}
            </div>
            <div className="border-t border-border mt-2 pt-2 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total</span>
                <span className="text-sm font-bold tabular-nums">
                  {fmt(countMatch ? effectiveSavings + employerMatchMonthly : effectiveSavings)}/mo
                </span>
              </div>
              {countMatch ? (
                <p className="text-[10px] text-muted-foreground text-right">
                  {fmt(effectiveSavings)} from take-home + {fmt(employerMatchMonthly)} employer match
                </p>
              ) : (
                incomeInfo.pensionEmployerMatchEnabled && employerMatchMonthly > 0 && (
                  <p className="text-[10px] text-muted-foreground text-right">
                    +{fmt(employerMatchMonthly)}/mo employer match outside take-home
                  </p>
                )
              )}
            </div>
          </CardContent>
        </Card>

        <CategoryCard
          title="Lifestyle" color="bg-purple-500" accent="border-l-purple-500"
          items={budget.discretionary}
          total={lifestyle}
          displayTotal={budgetMode === "traditional" && unallocated > 0 ? effectiveWants : lifestyle}
          onEdit={() => setEditingCategory("lifestyle")}
          extraContent={budgetMode === "traditional" && unallocated > 0 ? (
            <div className="mt-2 rounded-md border border-dashed border-purple-400/50 bg-purple-500/5 px-3 py-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">Unallocated (auto-added)</p>
                <p className="text-[10px] text-muted-foreground">Surplus added to wants</p>
              </div>
              <span className="text-xs font-bold tabular-nums text-purple-600 dark:text-purple-400 shrink-0">+{fmt(unallocated)}/mo</span>
            </div>
          ) : null}
        />
      </div>

      {/* Cash flow pie charts */}
      {takeHome > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <div className="p-4 pb-2">
              <h3 className="text-sm font-semibold text-foreground">Needs · Wants · Savings</h3>
            </div>
            <CardContent className="pt-0 pb-4 px-4">
              <div className="h-64">
                <Doughnut data={splitData} options={pieOptions} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <div className="p-4 pb-2">
              <h3 className="text-sm font-semibold text-foreground">By Category</h3>
            </div>
            <CardContent className="pt-0 pb-4 px-4">
              <div className="h-64">
                <Doughnut data={categoryData} options={pieOptions} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit dialog */}
      {activeEdit && (
        <EditDialog
          title={activeEdit.title}
          color={activeEdit.color}
          items={activeEdit.items}
          grouped={activeEdit.grouped}
          onChange={activeEdit.onChange}
          onClose={() => setEditingCategory(null)}
        />
      )}

      {/* Income edit dialog */}
      {editingIncome && onChangeIncome && (
        <Modal title="Edit Income" onClose={() => setEditingIncome(false)} maxWidth="max-w-xl">
          <StepIncome
            income={budget.income}
            onChange={onChangeIncome}
            onContinue={() => setEditingIncome(false)}
            continueLabel="Done"
          />
        </Modal>
      )}
    </div>
  );
}
