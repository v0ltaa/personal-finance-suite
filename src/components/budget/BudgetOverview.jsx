import { useState, useMemo } from "react";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { toMonthly, FREQUENCY_OPTIONS } from "../../lib/ukTax";
import { Edit2, Save, RotateCcw, Plus, X } from "lucide-react";

const fmt = (n) => "£" + Math.round(n).toLocaleString("en-GB");

// ── Ring gauge (compact) ──

function RingGauge({ label, actual, target, isMin }) {
  const pct = Math.min(actual, 100);
  const onTarget = isMin ? actual >= target : actual <= target;
  const close = isMin ? actual >= target - 5 : actual <= target + 5;
  const color = onTarget ? "text-success" : close ? "text-warning" : "text-danger";
  const stroke = onTarget ? "stroke-success" : close ? "stroke-warning" : "stroke-danger";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="36" fill="none" strokeWidth="7" className="stroke-muted" />
          <circle
            cx="50" cy="50" r="36" fill="none" strokeWidth="7"
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
      <p className="text-[10px] font-medium text-muted-foreground">{label} {isMin ? "≥" : "≤"}{target}%</p>
    </div>
  );
}

// ── Read-only line ──

function LineRow({ label, amount }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground truncate mr-2">{label}</span>
      <span className="text-xs font-medium tabular-nums shrink-0">{fmt(amount)}</span>
    </div>
  );
}

// ── Editable line item (used inside dialog) ──

function EditableRow({ item, onChange, onRemove }) {
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    const val = raw === "" ? 0 : Math.max(0, Number(raw));
    if (!isNaN(val)) onChange({ ...item, amount: val });
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
        inputMode="numeric"
        prefix="£"
        value={item.amount === 0 ? "" : item.amount.toLocaleString("en-GB")}
        onChange={handleAmountChange}
        placeholder="0"
        className="w-28 h-8 text-sm text-right"
      />
      <Select
        value={item.frequency}
        onChange={(e) => onChange({ ...item, frequency: e.target.value })}
        className="w-auto h-8 text-xs pr-7 pl-2"
      >
        {FREQUENCY_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>/{f.value.slice(0, 2)}</option>
        ))}
      </Select>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger transition-all p-1 shrink-0"
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

  // Group items by category if grouped
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <Card className="w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tabular-nums">{fmt(total)}/mo</span>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X size={14} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pt-3">
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
        </div>
      </Card>
    </div>
  );
}

// ── Read-only category card ──

function CategoryCard({ title, color, items, total, onEdit, children }) {
  const filledItems = items ? items.filter((i) => i.amount > 0) : [];
  const hasItems = filledItems.length > 0;

  return (
    <Card className={cn("break-inside-avoid", onEdit && "cursor-pointer hover:border-brand/40 transition-colors")} onClick={onEdit}>
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
                amount={toMonthly(item.amount, item.frequency)}
              />
            )) : (
              <p className="text-xs text-muted-foreground italic py-1">No items yet</p>
            )}
          </div>
        ) : children}
        {total !== undefined && (
          <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total</span>
            <span className="text-sm font-bold tabular-nums">{fmt(total)}/mo</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Committed card (read-only, grouped) ──

function CommittedCard({ items, total, onEdit }) {
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
    <Card className="break-inside-avoid cursor-pointer hover:border-brand/40 transition-colors" onClick={onEdit}>
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
            {catItems.map((item) => (
              <LineRow key={item.id} label={item.name} amount={toMonthly(item.amount, item.frequency)} />
            ))}
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

// ── Main overview ──

export default function BudgetOverview({ budget, budgetName, onSave, onReset, onChangeCommitted, onChangeEssentials, onChangeSavings, onChangeDiscretionary }) {
  const [editingCategory, setEditingCategory] = useState(null);

  const takeHome = budget.income.monthlyTakeHome;
  const committed = budget.committedTotal;
  const essentials = budget.essentialsTotal;
  const savings = budget.savingsTotal;
  const lifestyle = budget.lifestyleTotal;
  const totalOutgoings = committed + essentials + savings + lifestyle;
  const unallocated = takeHome - totalOutgoings;

  const needsPct = takeHome > 0 ? ((committed + essentials) / takeHome) * 100 : 0;
  const wantsPct = takeHome > 0 ? (lifestyle / takeHome) * 100 : 0;
  const savingsPct = takeHome > 0 ? (savings / takeHome) * 100 : 0;

  const incomeInfo = budget.income;
  const isManual = incomeInfo.mode === "manual";

  const compound = (monthly, years) => {
    let total = 0;
    for (let m = 0; m < years * 12; m++) {
      total = (total + monthly) * (1 + 0.07 / 12);
    }
    return total;
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
        <div className="flex items-center gap-2">
          <Button variant="brand" size="sm" onClick={onSave} className="gap-1.5">
            <Save size={13} />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw size={13} />
            New Budget
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

      {/* 50/30/20 gauges + insights inline */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex gap-5">
              <RingGauge label="Needs" actual={needsPct} target={50} isMin={false} />
              <RingGauge label="Wants" actual={wantsPct} target={30} isMin={false} />
              <RingGauge label="Savings" actual={savingsPct} target={20} isMin={true} />
            </div>
            <div className="hidden sm:block w-px bg-border self-stretch" />
            <div className="flex flex-wrap gap-x-6 gap-y-2 flex-1 min-w-0">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Savings rate</p>
                <p className="text-sm font-bold tabular-nums">{savingsPct.toFixed(1)}%</p>
              </div>
              {savings > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Annual savings</p>
                  <p className="text-sm font-bold tabular-nums">{fmt(savings * 12)}/yr</p>
                </div>
              )}
              {savings > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Projected (7%)</p>
                  <p className="text-xs tabular-nums">5yr: {fmt(compound(savings, 5))} · 10yr: {fmt(compound(savings, 10))}</p>
                </div>
              )}
              <div className="w-full max-w-xs">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Allocated</p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                  <div
                    className={cn("h-1.5 rounded-full transition-all", unallocated >= 0 ? "bg-success" : "bg-danger")}
                    style={{ width: `${Math.min(100, takeHome > 0 ? (totalOutgoings / takeHome) * 100 : 0)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {takeHome > 0 ? ((totalOutgoings / takeHome) * 100).toFixed(0) : 0}% of take-home
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category cards — masonry layout */}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-4 space-y-4">
        {/* Income (read-only) */}
        <Card className="break-inside-avoid">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <h3 className="text-sm font-semibold text-foreground">Income</h3>
            </div>
          </div>
          <CardContent className="pt-0 pb-4 px-4">
            {isManual ? (
              <LineRow label="Manual take-home" amount={takeHome} />
            ) : (
              <>
                <LineRow label={`Gross salary (${fmt(incomeInfo.grossAnnual)}/yr)`} amount={incomeInfo.grossAnnual / 12} />
                {incomeInfo.pensionPct > 0 && (
                  <LineRow label={`Pension (${incomeInfo.pensionPct}%)`} amount={incomeInfo.grossAnnual * incomeInfo.pensionPct / 100 / 12} />
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

        <CommittedCard items={budget.committed} total={committed} onEdit={() => setEditingCategory("committed")} />

        <CategoryCard title="Essentials" color="bg-warning" items={budget.essentials} total={essentials} onEdit={() => setEditingCategory("essentials")} />

        <CategoryCard title="Savings" color="bg-blue-500" items={budget.savings} total={savings} onEdit={() => setEditingCategory("savings")} />

        <CategoryCard title="Lifestyle" color="bg-purple-500" items={budget.discretionary} total={lifestyle} onEdit={() => setEditingCategory("lifestyle")} />
      </div>

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
    </div>
  );
}
