import { useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { toMonthly, fmtMoney } from "../../lib/ukTax";

function effectiveMonthly(item) {
  const monthly = toMonthly(item.amount, item.frequency);
  if (item.name === "Council Tax" && item.singlePerson) return monthly * 0.75;
  return monthly;
}
import BudgetLineItem from "./BudgetLineItem";
import Tip from "../Tip";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Plus } from "lucide-react";

const fmt = fmtMoney;

function CategoryGroup({ category, items, onItemChange, onItemRemove, onAddItem, helpers }) {
  const [open, setOpen] = useState(true);
  const total = items.reduce((s, i) => s + effectiveMonthly(i), 0);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm font-semibold text-foreground">{category}</span>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs font-medium text-muted-foreground">{fmt(total)}/mo</span>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-0.5">
          {items.map((item) => (
            <BudgetLineItem
              key={item.id}
              item={item}
              onChange={(updated) => onItemChange(item.id, updated)}
              onRemove={() => onItemRemove(item.id)}
              helper={helpers?.[item.name]}
            />
          ))}
          <button
            onClick={onAddItem}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-2 px-1"
          >
            <Plus size={12} />
            Add item
          </button>
        </div>
      )}
    </div>
  );
}

export default function StepCommitted({ items, onChange, takeHome, onContinue, onBack }) {
  const categories = [...new Set(items.map((i) => i.category))];
  const total = items.reduce((s, i) => s + effectiveMonthly(i), 0);
  const pctOfTakeHome = takeHome > 0 ? (total / takeHome) * 100 : 0;

  const helpers = {
    "Council Tax": "Single person? You get 25% off",
    "Car insurance": "Enter your annual premium — we'll show the monthly equivalent",
    "Pet costs": "Food, litter, insurance, vet plan",
    "Debt repayments": "Credit card minimums, personal loans",
  };

  const handleItemChange = (id, updated) => {
    onChange(items.map((i) => (i.id === id ? updated : i)));
  };

  const handleItemRemove = (id) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const handleAddItem = (category) => {
    const newItem = {
      id: crypto.randomUUID(),
      category,
      name: "New item",
      amount: 0,
      frequency: "monthly",
    };
    onChange([...items, newItem]);
  };

  const [newCategory, setNewCategory] = useState("");
  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    const item = {
      id: crypto.randomUUID(),
      category: newCategory.trim(),
      name: "New item",
      amount: 0,
      frequency: "monthly",
    };
    onChange([...items, item]);
    setNewCategory("");
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          The non-negotiables
          <Tip text="These are fixed 'needs' in Elizabeth Warren's 50/30/20 rule (from 'All Your Worth', 2005) — costs locked in by contract or obligation. MoneySavingExpert calls these 'priority bills': rent/mortgage, council tax, energy, insurance. You can't skip them without serious consequences. The 50% target covers these plus essentials (step 3). Martin Lewis's Budget Planner (moneysavingexpert.com/banking/budget-planning) uses a similar split." />
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Things you must pay every month, no matter what.
        </p>
      </div>

      <div className="space-y-3">
        {categories.map((cat) => (
          <CategoryGroup
            key={cat}
            category={cat}
            items={items.filter((i) => i.category === cat)}
            onItemChange={handleItemChange}
            onItemRemove={handleItemRemove}
            onAddItem={() => handleAddItem(cat)}
            helpers={helpers}
          />
        ))}
      </div>

      {/* Add new category */}
      <div className="flex items-center gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
          placeholder="Add new category..."
          className="h-8 text-sm flex-1"
        />
        <Button variant="outline" size="sm" onClick={handleAddCategory} disabled={!newCategory.trim()}>
          <Plus size={14} className="mr-1" />
          Add
        </Button>
      </div>

      {/* Totals */}
      <Card className={cn("border", pctOfTakeHome > 50 ? "border-warning/30 bg-warning/5" : "border-border")}>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total committed costs</span>
            <span className="text-lg font-bold tabular-nums">{fmt(total)}/mo</span>
          </div>
          {takeHome > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">% of take-home</span>
              <Badge variant={pctOfTakeHome > 50 ? "warning" : "muted"}>
                {pctOfTakeHome.toFixed(0)}%
              </Badge>
            </div>
          )}
          {pctOfTakeHome > 50 && (
            <p className="text-xs text-warning">
              Your committed costs are {pctOfTakeHome.toFixed(0)}% of your take-home. The general
              guideline is to keep these under 50%.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2 pt-2">
        {onBack ? (
          <Button variant="outline" size="lg" onClick={onBack} className="gap-2">
            <ArrowLeft size={16} />
            Back
          </Button>
        ) : <span />}
        <Button variant="brand" size="lg" onClick={onContinue} className="gap-2">
          Continue
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
