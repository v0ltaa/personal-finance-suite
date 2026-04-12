import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { fmtMoney } from "../../lib/ukTax";
import Tip from "../Tip";
import { ArrowRight } from "lucide-react";

const fmt = fmtMoney;

const BUDGET_RULE_PRESETS = [
  { label: "50 / 30 / 20", needs: 50, wants: 30, savings: 20 },
  { label: "60 / 20 / 20", needs: 60, wants: 20, savings: 20 },
  { label: "60 / 30 / 10", needs: 60, wants: 30, savings: 10 },
  { label: "70 / 20 / 10", needs: 70, wants: 20, savings: 10 },
  { label: "80 / 10 / 10", needs: 80, wants: 10, savings: 10 },
];

export default function StepSetup({ budgetMode, onBudgetModeChange, budgetRule, onBudgetRuleChange, takeHome, onContinue }) {
  const ruleTotal = budgetRule.needs + budgetRule.wants + budgetRule.savings;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          How do you want to budget?
          <Tip text="There's no single right way. 'Savings first' follows the 'pay yourself first' principle — you set savings targets before lifestyle spending. 'Lifestyle first' is more realistic for most people — plan what you actually spend, then save the rest. Pick whichever feels more natural." />
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose your approach and set your budget rule before we start.
        </p>
      </div>

      {/* Budget approach */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Budget approach</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onBudgetModeChange("realistic")}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all",
              budgetMode === "realistic"
                ? "border-brand bg-brand/5"
                : "border-border hover:border-brand/40"
            )}
          >
            <p className="text-sm font-semibold text-foreground">Lifestyle first</p>
            <p className="text-xs text-muted-foreground mt-1">
              Plan your spending, then save what's left. More realistic for most people.
            </p>
          </button>
          <button
            onClick={() => onBudgetModeChange("traditional")}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all",
              budgetMode === "traditional"
                ? "border-brand bg-brand/5"
                : "border-border hover:border-brand/40"
            )}
          >
            <p className="text-sm font-semibold text-foreground">Savings first</p>
            <p className="text-xs text-muted-foreground mt-1">
              Set savings targets first, spend what remains. 'Pay yourself first' principle.
            </p>
          </button>
        </div>
      </div>

      {/* Budget rule */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground">Budget rule (Needs / Wants / Savings)</label>

        {/* Custom inputs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Needs %</label>
            <Input
              type="number"
              min="0" max="100"
              value={budgetRule.needs}
              onChange={(e) => onBudgetRuleChange({ ...budgetRule, needs: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              suffix="%"
              className="h-10 text-center text-sm font-bold"
            />
            {takeHome > 0 && (
              <p className="text-[10px] text-muted-foreground text-center tabular-nums">
                {fmt(takeHome * budgetRule.needs / 100)}/mo
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Wants %</label>
            <Input
              type="number"
              min="0" max="100"
              value={budgetRule.wants}
              onChange={(e) => onBudgetRuleChange({ ...budgetRule, wants: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              suffix="%"
              className="h-10 text-center text-sm font-bold"
            />
            {takeHome > 0 && (
              <p className="text-[10px] text-muted-foreground text-center tabular-nums">
                {fmt(takeHome * budgetRule.wants / 100)}/mo
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Savings %</label>
            <Input
              type="number"
              min="0" max="100"
              value={budgetRule.savings}
              onChange={(e) => onBudgetRuleChange({ ...budgetRule, savings: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              suffix="%"
              className="h-10 text-center text-sm font-bold"
            />
            {takeHome > 0 && (
              <p className="text-[10px] text-muted-foreground text-center tabular-nums">
                {fmt(takeHome * budgetRule.savings / 100)}/mo
              </p>
            )}
          </div>
        </div>

        {ruleTotal !== 100 && (
          <p className="text-[10px] text-warning text-center">
            Totals {ruleTotal}% — should add up to 100%
          </p>
        )}

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_RULE_PRESETS.map((preset) => {
            const isActive = budgetRule.needs === preset.needs && budgetRule.wants === preset.wants && budgetRule.savings === preset.savings;
            return (
              <button
                key={preset.label}
                onClick={() => onBudgetRuleChange({ needs: preset.needs, wants: preset.wants, savings: preset.savings })}
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

      <div className="flex justify-end pt-2">
        <Button variant="brand" size="lg" onClick={onContinue} className="gap-2">
          Continue
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
