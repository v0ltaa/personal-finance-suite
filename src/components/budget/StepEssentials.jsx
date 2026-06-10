import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { toMonthly, fmtMoney } from "../../lib/ukTax";
import BudgetLineItem from "./BudgetLineItem";
import Tip from "../Tip";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";

const fmt = fmtMoney;

export default function StepEssentials({ items, onChange, takeHome, committedTotal, onContinue, onBack }) {
  const total = items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  const surplus = Math.round((takeHome - committedTotal - total) * 100) / 100;

  const helpers = {
    Groceries: "UK average for a single person is roughly £200–250/mo",
    "Household supplies": "Cleaning products, toiletries, etc",
  };

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
        name: "New item",
        amount: 0,
        frequency: "monthly",
      },
    ]);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          The basics you control
          <Tip text="Still 'needs' in the 50/30/20 rule, but unlike committed costs you have real control over the amount. The key question: could you survive without it? If not, it's an essential need, not a want. ONS data (ons.gov.uk/familyspending) puts the UK average grocery spend at roughly £60/week for one person. MoneySavingExpert's Demotivator tool can help benchmark your supermarket spending." />
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          You need to spend on these, but the amount is up to you.
        </p>
      </div>

      <div className="space-y-0.5 border border-border rounded-lg px-3 py-2">
        {items.map((item) => (
          <BudgetLineItem
            key={item.id}
            item={item}
            onChange={(updated) => handleItemChange(item.id, updated)}
            onRemove={() => handleItemRemove(item.id)}
            helper={helpers[item.name]}
          />
        ))}
        <button
          onClick={handleAddItem}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-2 px-1"
        >
          <Plus size={12} />
          Add item
        </button>
      </div>

      {/* Totals */}
      <div className="space-y-3">
        <Card className="border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total essential variable</span>
              <span className="text-lg font-bold tabular-nums">{fmt(total)}/mo</span>
            </div>
          </CardContent>
        </Card>

        {/* THE SURPLUS — the most important number */}
        <Card className={cn(
          "border-2",
          surplus >= 0 ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5"
        )}>
          <CardContent className="py-6 text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Your Surplus
            </p>
            <p className={cn(
              "text-3xl sm:text-4xl font-bold tabular-nums transition-all duration-300",
              surplus >= 0 ? "text-success" : "text-danger"
            )}>
              {fmt(surplus)}/mo
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This is the money you have left to save, invest, and enjoy.
            </p>
          </CardContent>
        </Card>
      </div>

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
