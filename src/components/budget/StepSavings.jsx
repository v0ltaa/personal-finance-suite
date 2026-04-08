import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { toMonthly } from "../../lib/ukTax";
import BudgetLineItem from "./BudgetLineItem";
import Tip from "../Tip";
import { ArrowRight, Plus } from "lucide-react";

const fmt = (n) => "£" + Math.round(n).toLocaleString("en-GB");

function EmergencyFundIndicator({ monthlyAmount, monthlyExpenses }) {
  if (monthlyAmount <= 0 || monthlyExpenses <= 0) return null;
  const target = monthlyExpenses * 3;
  const months = Math.ceil(target / monthlyAmount);
  return (
    <p className="text-xs text-muted-foreground mt-1">
      At this rate, you'll have 3 months of expenses saved in{" "}
      <span className="font-semibold text-foreground">{months} months</span>{" "}
      (target: {fmt(target)})
    </p>
  );
}

function LisaIndicator({ monthlyAmount }) {
  if (monthlyAmount <= 0) return null;
  const annual = monthlyAmount * 12;
  const capped = Math.min(annual, 4000);
  const bonus = capped * 0.25;
  return (
    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
      <p>
        {fmt(capped)}/yr contribution + {fmt(bonus)} bonus = {fmt(capped + bonus)} total
      </p>
      {annual > 4000 && (
        <p className="text-warning">
          Max £4,000/yr — you're contributing {fmt(annual)}/yr. The excess won't get the bonus.
        </p>
      )}
    </div>
  );
}

export default function StepSavings({ items, onChange, takeHome, surplus, committedTotal, essentialsTotal, onContinue }) {
  const total = items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  const savingsRate = takeHome > 0 ? (total / takeHome) * 100 : 0;
  const funMoney = surplus - total;
  const dailyBudget = funMoney / 30;
  const monthlyExpenses = committedTotal + essentialsTotal;

  const helpers = {
    "Emergency fund": null, // Custom indicator below
    LISA: "Max £4,000/yr (£333/mo). You get a 25% bonus — £1,000 free per year.",
    "ISA / Investments": "Stocks & shares ISA, index funds, etc",
    "Other savings": "Holiday fund, house deposit, specific goals",
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
        name: "New savings goal",
        amount: 0,
        frequency: "monthly",
      },
    ]);
  };

  const rateVariant = savingsRate >= 10 ? "success" : savingsRate > 0 ? "warning" : "muted";
  const rateLabel = savingsRate >= 20 ? "Excellent" : savingsRate >= 10 ? "Solid" : savingsRate > 0 ? "Consider saving more" : "";

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          Secure your future before you spend
          <Tip text="'Pay yourself first' — a principle from George S. Clason's 'The Richest Man in Babylon' (1926). We put savings before lifestyle spending deliberately: if you wait to save what's left over, there's never anything left. The 50/30/20 rule allocates 20% here. Martin Lewis recommends building a 3-month emergency fund first (moneysavingexpert.com/savings/emergency-fund), then using tax-free wrappers like ISAs (up to £20k/yr) and LISAs (gov.uk/lifetime-isa)." />
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set aside savings and investments from your surplus before allocating fun money.
        </p>
      </div>

      <div className="space-y-0.5 border border-border rounded-lg px-3 py-2">
        {items.map((item) => {
          const monthly = toMonthly(item.amount, item.frequency);
          return (
            <div key={item.id}>
              <BudgetLineItem
                item={item}
                onChange={(updated) => handleItemChange(item.id, updated)}
                onRemove={() => handleItemRemove(item.id)}
                helper={helpers[item.name]}
                showFrequency={false}
              />
              {item.name === "Emergency fund" && (
                <div className="pl-1 pb-1">
                  <EmergencyFundIndicator
                    monthlyAmount={monthly}
                    monthlyExpenses={monthlyExpenses}
                  />
                </div>
              )}
              {item.name === "LISA" && (
                <div className="pl-1 pb-1">
                  <LisaIndicator monthlyAmount={monthly} />
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={handleAddItem}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-2 px-1"
        >
          <Plus size={12} />
          Add savings goal
        </button>
      </div>

      {/* Savings summary */}
      <Card className="border-border">
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total savings</span>
            <span className="text-lg font-bold tabular-nums">{fmt(total)}/mo</span>
          </div>
          {takeHome > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Savings rate</span>
              <div className="flex items-center gap-2">
                <Badge variant={rateVariant}>{savingsRate.toFixed(0)}%</Badge>
                {rateLabel && <span className="text-xs text-muted-foreground">{rateLabel}</span>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fun Money */}
      <Card className={cn(
        "border-2",
        funMoney >= 0 ? "border-brand/30 bg-brand/5" : "border-danger/40 bg-danger/5"
      )}>
        <CardContent className="py-6 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Fun Money
          </p>
          <p className={cn(
            "text-3xl sm:text-4xl font-bold tabular-nums",
            funMoney >= 0 ? "text-brand" : "text-danger"
          )}>
            {fmt(funMoney)}/mo
          </p>
          <p className="text-lg font-semibold text-muted-foreground mt-1 tabular-nums">
            £{dailyBudget.toFixed(2)}/day
          </p>
          {funMoney < 0 && (
            <p className="text-xs text-danger mt-2">
              Your savings exceed your surplus. Go back and adjust.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button variant="brand" size="lg" onClick={onContinue} className="gap-2">
          Continue
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
