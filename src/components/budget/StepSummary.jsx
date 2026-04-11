import { useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { toMonthly } from "../../lib/ukTax";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";
import Tip from "../Tip";
import { Edit2, RotateCcw, Save } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

const fmt = (n) => "£" + Math.round(n).toLocaleString("en-GB");

function RingGauge({ label, actual, target, isMin }) {
  const pct = Math.min(actual, 100);
  const onTarget = isMin ? actual >= target : actual <= target;
  const close = isMin ? actual >= target - 5 : actual <= target + 5;
  const color = onTarget ? "text-success" : close ? "text-warning" : "text-danger";
  const stroke = onTarget ? "stroke-success" : close ? "stroke-warning" : "stroke-danger";

  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="50" cy="50" r="40" fill="none" strokeWidth="8"
            className={cn(stroke, "transition-all duration-500")}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-bold tabular-nums", color)}>{actual.toFixed(0)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          Target: {isMin ? "≥" : "≤"}{target}%
        </p>
      </div>
    </div>
  );
}

function WarningCard({ children }) {
  return (
    <div className="flex items-start gap-2 py-2 px-3 bg-warning/5 border border-warning/20 rounded-lg text-xs text-warning">
      <span className="shrink-0 mt-0.5">!</span>
      <span>{children}</span>
    </div>
  );
}

export default function StepSummary({ budget, onEdit, onSave, onReset, onViewOverview }) {
  const takeHome = budget.income.monthlyTakeHome;
  const committed = budget.committedTotal;
  const essentials = budget.essentialsTotal;
  const savings = budget.savingsTotal;
  const lifestyle = budget.lifestyleTotal;
  const totalOutgoings = committed + essentials + savings + lifestyle;
  const unallocated = takeHome - totalOutgoings;
  const dailyDiscretionary = (takeHome - committed - essentials - savings) / 30;

  // 50/30/20 breakdown
  const needsPct = takeHome > 0 ? ((committed + essentials) / takeHome) * 100 : 0;
  const wantsPct = takeHome > 0 ? (lifestyle / takeHome) * 100 : 0;
  const savingsPct = takeHome > 0 ? (savings / takeHome) * 100 : 0;

  // Annual projections
  const annualSavings = savings * 12;
  const growthRate = 0.07;
  const compound = (monthly, years) => {
    let total = 0;
    for (let m = 0; m < years * 12; m++) {
      total = (total + monthly) * (1 + growthRate / 12);
    }
    return total;
  };

  const proj5 = compound(savings, 5);
  const proj10 = compound(savings, 10);
  const proj20 = compound(savings, 20);

  // Emergency fund
  const efItem = budget.savings.find((i) => i.name === "Emergency fund");
  const efMonthly = efItem ? toMonthly(efItem.amount, efItem.frequency) : 0;
  const monthlyExpenses = committed + essentials;
  const efTarget = monthlyExpenses * 3;
  const efMonths = efMonthly > 0 ? Math.ceil(efTarget / efMonthly) : null;

  // LISA
  const lisaItem = budget.savings.find((i) => i.name === "LISA");
  const lisaMonthly = lisaItem ? toMonthly(lisaItem.amount, lisaItem.frequency) : 0;
  const lisaAnnual = Math.min(lisaMonthly * 12, 4000);
  const lisaWithBonus = lisaAnnual * 1.25;
  // Project to age 50, assume user is ~25 (25 years of contributions)
  const lisaProj = lisaMonthly > 0 ? compound(Math.min(lisaMonthly, 333.33) * 1.25, 25) : 0;

  // Housing % check
  const housingItem = budget.committed.find(
    (i) => i.category === "Housing" && (i.name === "Rent" || i.name === "Mortgage")
  );
  const housingMonthly = housingItem ? toMonthly(housingItem.amount, housingItem.frequency) : 0;
  const housingPct = takeHome > 0 ? (housingMonthly / takeHome) * 100 : 0;

  // Waterfall chart
  const waterfallData = {
    labels: ["Take-home", "Committed", "Essentials", "Savings", "Lifestyle", "Unallocated"],
    datasets: [
      {
        label: "Amount",
        data: [takeHome, committed, essentials, savings, lifestyle, Math.max(0, unallocated)],
        backgroundColor: [
          "hsl(142, 71%, 40%)",    // green
          "hsl(18, 72%, 52%)",     // brand
          "hsl(38, 92%, 50%)",     // amber
          "hsl(210, 60%, 50%)",    // blue
          "hsl(280, 50%, 55%)",    // purple
          "hsl(142, 71%, 40%)",    // green (unallocated)
        ],
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => fmt(ctx.raw),
        },
      },
    },
    scales: {
      y: {
        display: false,
        beginAtZero: true,
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Instrument Sans', sans-serif", size: 11 },
        },
      },
    },
  };

  // Warnings
  const warnings = [];
  if (housingPct > 30 && housingMonthly > 0) {
    warnings.push(`Housing is ${housingPct.toFixed(0)}% of your take-home (guideline: under 30%).`);
  }
  if (efMonthly === 0) {
    warnings.push("No emergency fund allocated. Consider setting aside even a small amount.");
  }
  if (savingsPct < 10 && savings > 0) {
    warnings.push(`Savings rate is ${savingsPct.toFixed(0)}%. Consider aiming for at least 10%.`);
  }
  if (savingsPct === 0) {
    warnings.push("You haven't allocated any savings yet.");
  }
  if (unallocated > 50) {
    warnings.push(`You have ${fmt(unallocated)}/mo unallocated. Consider putting it towards savings or your emergency fund.`);
  }
  if (lisaMonthly > 0 && lisaMonthly < 333.33) {
    warnings.push(`LISA contributions aren't maxed. Adding ${fmt(333.33 - lisaMonthly)}/mo more would get you the full £1,000 annual bonus.`);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">Your Budget</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Here's where every pound goes.
        </p>
      </div>

      {/* 1. Waterfall chart */}
      <Card>
        <CardHeader>
          <CardTitle>Budget breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <Bar data={waterfallData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* 2. 50/30/20 reality check */}
      <Card>
        <CardHeader>
          <CardTitle>
            The 50/30/20 reality check
            <Tip text="From Elizabeth Warren & Amelia Warren Tyagi's 'All Your Worth' (2005): 50% on needs, 30% on wants, 20% on savings. Widely adopted by MoneySavingExpert, NerdWallet, and the Money Advice Service (now MoneyHelper — moneyhelper.org.uk/budget-planner). It's a starting framework, not gospel — if you're on a lower income, needs may take 60%+ and that's normal. The point is awareness: know the split, then decide what trade-offs work for you." />
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            This is a guideline, not a rule. Everyone's situation is different.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-around flex-wrap gap-4">
            <RingGauge label="Needs" actual={needsPct} target={50} isMin={false} />
            <RingGauge label="Wants" actual={wantsPct} target={30} isMin={false} />
            <RingGauge label="Savings" actual={savingsPct} target={20} isMin={true} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Key numbers */}
      <Card>
        <CardHeader>
          <CardTitle>Key numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Monthly take-home</p>
              <p className="text-lg font-bold tabular-nums text-success">{fmt(takeHome)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total outgoings</p>
              <p className="text-lg font-bold tabular-nums">{fmt(totalOutgoings)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Savings</p>
              <p className="text-lg font-bold tabular-nums">
                {fmt(savings)} <span className="text-sm text-muted-foreground">({savingsPct.toFixed(0)}%)</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Daily discretionary</p>
              <p className="text-lg font-bold tabular-nums">£{dailyDiscretionary.toFixed(2)}/day</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Annual savings</p>
              <p className="text-lg font-bold tabular-nums">{fmt(annualSavings)}/yr</p>
            </div>
            {savings > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">With 7% growth</p>
                <p className="text-sm tabular-nums">
                  5yr: {fmt(proj5)} · 10yr: {fmt(proj10)} · 20yr: {fmt(proj20)}
                </p>
              </div>
            )}
            {efMonths && (
              <div>
                <p className="text-xs text-muted-foreground">Emergency fund</p>
                <p className="text-sm font-medium">{efMonths} months until 3-month buffer</p>
              </div>
            )}
            {lisaMonthly > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">LISA projection</p>
                <p className="text-sm font-medium">~{fmt(lisaProj)} by age 50</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Things to consider</h3>
          {warnings.map((w, i) => (
            <WarningCard key={i}>{w}</WarningCard>
          ))}
        </div>
      )}

      {/* 5. Save & continue */}
      <Card className="border-brand/30 bg-brand/5">
        <CardContent className="py-5">
          <h3 className="font-semibold text-foreground mb-1">Save your budget</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Save to keep it, then see everything on one screen.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="lg" onClick={onSave} className="gap-2">
              <Save size={16} />
              Save Budget
            </Button>
            {onViewOverview && (
              <Button variant="outline" size="lg" onClick={onViewOverview} className="gap-2">
                View Overview
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 6. Secondary actions */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="md" onClick={onReset} className="gap-2">
              <RotateCcw size={14} />
              Start Fresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Income", "Committed", "Essentials", "Savings", "Lifestyle"].map((step, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                onClick={() => onEdit(i)}
                className="gap-1 text-muted-foreground"
              >
                <Edit2 size={12} />
                Edit {step}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
