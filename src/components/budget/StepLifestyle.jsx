import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { toMonthly, fmtMoney } from "../../lib/ukTax";
import BudgetLineItem from "./BudgetLineItem";
import Tip from "../Tip";
import { ArrowRight, Plus } from "lucide-react";

const fmt = fmtMoney;

const DEFAULT_MONZO_MAP = {
  "Eating out / Drinks": "Eating Out",
  "Shopping / Clothes": "Shopping",
  Entertainment: "Entertainment",
  Hobbies: "Shopping",
  Gifts: "Shopping",
  "Buffer / Miscellaneous": "General",
};

export default function StepLifestyle({ items, onChange, funMoney, onContinue }) {
  const total = items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  const remaining = Math.round((funMoney - total) * 100) / 100;
  const pctUsed = funMoney > 0 ? (total / funMoney) * 100 : 0;
  const overBudget = remaining < 0;

  const handleItemChange = (id, updated) => {
    onChange(items.map((i) => (i.id === id ? updated : i)));
  };

  const handleItemRemove = (id) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const handleAddItem = () => {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        name: "New category",
        amount: 0,
        frequency: "monthly",
        monzoCategory: "General",
      },
    ]);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          How you want to live
          <Tip text="These are your 'wants' — the 30% in the 50/30/20 rule. Could you survive without it? Then it's a want, not a need. That doesn't mean it's unimportant — it means you have freedom to shape this around what makes you happy. If you use Monzo, Starling, or another app that categorises spending, check your last 3 months to see where your money actually goes — it's often very different from what you'd guess. MoneySavingExpert's spending tracker tips: moneysavingexpert.com/banking/budget-planning." />
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Divide your fun money across the things you enjoy.
        </p>
      </div>

      {/* Budget bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Allocated</span>
          <span>{fmt(total)} of {fmt(funMoney)}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              overBudget ? "bg-danger" : pctUsed > 90 ? "bg-warning" : "bg-brand"
            )}
            style={{ width: `${Math.min(100, pctUsed)}%` }}
          />
        </div>
        {overBudget && (
          <p className="text-xs text-danger">
            {fmt(Math.abs(remaining))} over your fun money budget — go back and adjust savings or
            essentials, or accept a tighter month.
          </p>
        )}
      </div>

      <div className="space-y-0.5 border border-border rounded-lg px-3 py-2">
        {items.map((item) => (
          <BudgetLineItem
            key={item.id}
            item={item}
            onChange={(updated) => handleItemChange(item.id, updated)}
            onRemove={() => handleItemRemove(item.id)}
            showFrequency={false}
          />
        ))}
        <button
          onClick={handleAddItem}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-2 px-1"
        >
          <Plus size={12} />
          Add category
        </button>
      </div>

      {remaining > 0 && (
        <Card className="border-border">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Unallocated fun money</span>
              <span className="text-sm font-semibold text-success tabular-nums">{fmt(remaining)}/mo</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="brand" size="lg" onClick={onContinue} className="gap-2">
          See your budget
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
