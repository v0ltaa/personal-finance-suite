import { useEffect, useMemo, useState } from "react";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { calcMonthlyTakeHome, STUDENT_LOAN_OPTIONS, toMonthly, fmtMoney, fmtInputValue, evalFormula } from "../../lib/ukTax";
import BudgetLineItem from "./BudgetLineItem";
import Tip from "../Tip";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";

const fmt = fmtMoney;

// ── Annual leave purchase quick-add ──
// Salary sacrifice: buy N days, deducted equally over 11 months (Feb–Dec)
function AnnualLeaveHelper({ grossAnnual, onAdd }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(5);

  const dailyRate = grossAnnual / 260;
  const totalCost = dailyRate * days;
  const monthlyDeduction = Math.round((totalCost / 11) * 100) / 100;

  const handleAdd = () => {
    onAdd({
      id: crypto.randomUUID(),
      name: `Annual leave purchase (${days} days)`,
      amount: monthlyDeduction,
      frequency: "monthly",
    });
    setOpen(false);
    setDays(5);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-2 px-1"
      >
        <Plus size={12} />
        Buy annual leave
      </button>
    );
  }

  return (
    <div className="border-t border-border/60 mt-1 pt-2 space-y-2 animate-fade-in">
      <p className="text-xs font-medium text-foreground px-1">Buy annual leave</p>
      <p className="text-[11px] text-muted-foreground px-1">
        Salary sacrifice — cost spread over 11 months (Feb–Dec)
      </p>
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-1.5 flex-1">
          <Input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            suffix="days"
            className="w-28 h-8 text-sm"
          />
        </div>
        {grossAnnual > 0 && (
          <p className="text-xs text-muted-foreground shrink-0">
            = {fmt(monthlyDeduction)}/mo
            <span className="text-[10px] block text-muted-foreground/70">({fmt(totalCost)} total)</span>
          </p>
        )}
      </div>
      <div className="flex gap-2 px-1 pb-1">
        <Button size="sm" variant="brand" onClick={handleAdd} className="h-7 text-xs px-3">
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-7 text-xs px-3">
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function StepIncome({ income, onChange, onContinue, onBack, continueLabel = "Continue" }) {
  const isManual = income.mode === "manual";

  // Sum deduction line items into a single monthly total
  const deductionsTotal = useMemo(
    () => (income.deductions || []).reduce((s, d) => s + toMonthly(d.amount, d.frequency), 0),
    [income.deductions]
  );

  const result = useMemo(
    () => calcMonthlyTakeHome({ ...income, otherDeductions: deductionsTotal }),
    [income.grossAnnual, income.pensionPct, income.studentLoan, deductionsTotal]
  );

  const update = (field, value) => {
    onChange({ ...income, [field]: value });
  };

  // Determine effective take-home
  const monthlyTakeHome = isManual ? income.manualTakeHome : result.monthlyTakeHome;

  // Sync calculated take-home back to parent state
  useEffect(() => {
    if (income.monthlyTakeHome !== monthlyTakeHome) {
      onChange({ ...income, monthlyTakeHome });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyTakeHome]);

  const [grossRaw, setGrossRaw] = useState(null);
  const [manualRaw, setManualRaw] = useState(null);

  // Keep raw text while typing so decimals and "=" formulas survive re-renders
  const handleGrossChange = (e) => {
    const raw = e.target.value;
    setGrossRaw(raw);
    if (raw.startsWith("=")) return;
    const clean = raw.replace(/,/g, "");
    const val = clean === "" ? 0 : Number(clean);
    if (!isNaN(val) && val >= 0) update("grossAnnual", val);
  };
  const handleGrossBlur = () => {
    if (grossRaw?.startsWith("=")) {
      const r = evalFormula(grossRaw.slice(1));
      if (!isNaN(r) && r >= 0) update("grossAnnual", Math.round(r * 100) / 100);
    }
    setGrossRaw(null);
  };

  const handleManualChange = (e) => {
    const raw = e.target.value;
    setManualRaw(raw);
    if (raw.startsWith("=")) return;
    const clean = raw.replace(/,/g, "");
    const val = clean === "" ? 0 : Number(clean);
    if (!isNaN(val) && val >= 0) update("manualTakeHome", val);
  };
  const handleManualBlur = () => {
    if (manualRaw?.startsWith("=")) {
      const r = evalFormula(manualRaw.slice(1));
      if (!isNaN(r) && r >= 0) update("manualTakeHome", Math.round(r * 100) / 100);
    }
    setManualRaw(null);
  };

  const deductionsList = income.deductions || [];

  const handleDeductionChange = (id, updated) => {
    update("deductions", deductionsList.map((d) => (d.id === id ? updated : d)));
  };

  const handleDeductionRemove = (id) => {
    update("deductions", deductionsList.filter((d) => d.id !== id));
  };

  const handleDeductionAdd = (item) => {
    update("deductions", [
      ...deductionsList,
      item || { id: crypto.randomUUID(), name: "New deduction", amount: 0, frequency: "monthly" },
    ]);
  };

  const canContinue = isManual ? income.manualTakeHome > 0 : income.grossAnnual > 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
          What do you actually take home?
          <Tip text="We start here because your take-home pay is the ceiling for everything else. Every pound in this budget must come from this number. Tax bands are from HMRC 2025/26 rates. If the estimate doesn't match your payslip, use 'I know my take-home' — MoneySavingExpert's tax calculator (moneysavingexpert.com/tax-calculator) is another good cross-reference." />
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your salary details and we'll calculate your monthly take-home pay.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => update("mode", "calculator")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
            !isManual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Calculate from salary
        </button>
        <button
          onClick={() => update("mode", "manual")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
            isManual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          I know my take-home
        </button>
      </div>

      {isManual ? (
        /* ── Manual mode ── */
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Monthly take-home pay</label>
            <Input
              type="text"
              inputMode="decimal"
              prefix="£"
              value={manualRaw !== null ? manualRaw : fmtInputValue(income.manualTakeHome)}
              onChange={handleManualChange}
              onBlur={handleManualBlur}
              onKeyDown={(e) => e.key === "Enter" && handleManualBlur()}
              placeholder="e.g. 2,100"
              className="text-lg h-11"
            />
            <p className="text-xs text-muted-foreground">
              The amount that hits your bank account each month, after tax, NI, pension, and any other payroll deductions.
            </p>
          </div>

          {/* Optional pension — so it shows in savings tile */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Your pension contribution (optional)</label>
            <Input
              type="number"
              min={0}
              prefix="£"
              suffix="/mo"
              value={income.manualPensionMonthly || ""}
              onChange={(e) => update("manualPensionMonthly", Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="w-48 h-9"
            />
            <p className="text-xs text-muted-foreground">
              Already deducted from your take-home — enter it here so it shows in your savings summary.
            </p>
          </div>

          {/* Employer match — shown if pension amount entered */}
          {(income.manualPensionMonthly ?? 0) > 0 && (
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Employer pension match</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your employer matches your pension contribution</p>
                </div>
                <button
                  type="button"
                  onClick={() => update("pensionEmployerMatchEnabled", !income.pensionEmployerMatchEnabled)}
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors shrink-0",
                    income.pensionEmployerMatchEnabled ? "bg-brand" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                    income.pensionEmployerMatchEnabled ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </button>
              </div>
              {income.pensionEmployerMatchEnabled && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-medium text-muted-foreground">Employer match amount</label>
                  <Input
                    type="number"
                    min={0}
                    prefix="£"
                    suffix="/mo"
                    value={income.pensionEmployerMatchMonthly ?? income.manualPensionMonthly ?? 0}
                    onChange={(e) => update("pensionEmployerMatchMonthly", Math.max(0, Number(e.target.value) || 0))}
                    className="w-48 h-9"
                  />
                  <p className="text-xs text-muted-foreground">
                    Free money — added to your pension on top of your take-home.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Calculator mode ── */
        <div className="space-y-4 animate-fade-in">
          {/* Gross salary */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Gross annual salary</label>
            <Input
              type="text"
              inputMode="decimal"
              prefix="£"
              value={grossRaw !== null ? grossRaw : fmtInputValue(income.grossAnnual)}
              onChange={handleGrossChange}
              onBlur={handleGrossBlur}
              onKeyDown={(e) => e.key === "Enter" && handleGrossBlur()}
              placeholder="e.g. 32,000"
              className="text-lg h-11"
            />
          </div>

          {/* Pension */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Pension contribution (salary sacrifice)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={income.pensionPct}
                onChange={(e) => update("pensionPct", Number(e.target.value))}
                className="flex-1 accent-brand"
              />
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  min={0}
                  max={40}
                  value={income.pensionPct}
                  onChange={(e) => update("pensionPct", Math.min(40, Math.max(0, Number(e.target.value))))}
                  suffix="%"
                  className="w-20 h-8 text-sm text-right"
                />
              </div>
            </div>
            {income.grossAnnual > 0 && (
              <p className="text-xs text-muted-foreground">
                {fmt(result.annualPension)}/yr ({fmt(result.annualPension / 12)}/mo)
              </p>
            )}
          </div>

          {/* Employer pension match */}
          {income.pensionPct > 0 && (
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Employer pension match</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your employer matches your salary sacrifice pension contribution</p>
                </div>
                <button
                  type="button"
                  onClick={() => update("pensionEmployerMatchEnabled", !income.pensionEmployerMatchEnabled)}
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors shrink-0",
                    income.pensionEmployerMatchEnabled ? "bg-brand" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                    income.pensionEmployerMatchEnabled ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </button>
              </div>
              {income.pensionEmployerMatchEnabled && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-medium text-muted-foreground">Employer match %</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={income.pensionEmployerMatchPct ?? income.pensionPct}
                      onChange={(e) => update("pensionEmployerMatchPct", Number(e.target.value))}
                      className="flex-1 accent-brand"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      value={income.pensionEmployerMatchPct ?? income.pensionPct}
                      onChange={(e) => update("pensionEmployerMatchPct", Math.min(40, Math.max(0, Number(e.target.value))))}
                      suffix="%"
                      className="w-20 h-8 text-sm text-right"
                    />
                  </div>
                  {income.grossAnnual > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Employer adds {fmt(income.grossAnnual * (income.pensionEmployerMatchPct ?? income.pensionPct) / 100 / 12)}/mo to your pension (free money — not from your take-home)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Student loan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Student loan plan</label>
            <Select
              value={income.studentLoan}
              onChange={(e) => update("studentLoan", e.target.value)}
              className="w-full sm:w-48"
            >
              {STUDENT_LOAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            {result.annualStudentLoan > 0 && (
              <p className="text-xs text-muted-foreground">
                {fmt(result.annualStudentLoan)}/yr repayment
              </p>
            )}
          </div>

          {/* Other deductions — line items */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Other payroll deductions
              <Tip text="Pre-tax salary sacrifice deductions — cycle to work (gov.uk/cycle-to-work-scheme), childcare vouchers, health insurance, share schemes. These reduce your taxable income, so you save on tax and NI. Check your payslip under 'deductions before tax'." />
            </label>
            <div className="border border-border rounded-lg px-3 py-2 space-y-0.5">
              {deductionsList.map((item) => (
                <BudgetLineItem
                  key={item.id}
                  item={item}
                  onChange={(updated) => handleDeductionChange(item.id, updated)}
                  onRemove={() => handleDeductionRemove(item.id)}
                  showFrequency={false}
                />
              ))}
              <button
                onClick={() => handleDeductionAdd()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-2 px-1"
              >
                <Plus size={12} />
                Add deduction
              </button>
              {/* Annual leave purchase quick-add */}
              {income.grossAnnual > 0 && (
                <AnnualLeaveHelper
                  grossAnnual={income.grossAnnual}
                  onAdd={(item) => handleDeductionAdd(item)}
                />
              )}
            </div>
            {deductionsTotal > 0 && (
              <p className="text-xs text-muted-foreground">
                Total: {fmt(deductionsTotal)}/mo deducted before tax
              </p>
            )}
          </div>
        </div>
      )}

      {/* Take-home display */}
      {canContinue && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="py-5 text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Monthly take-home pay
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-success tabular-nums">
              {fmt(monthlyTakeHome)}
            </p>
            {!isManual && (
              <p className="text-xs text-muted-foreground mt-2">
                {fmt(result.annualNet)}/yr after tax, NI{result.annualStudentLoan > 0 ? ", student loan" : ""} & pension
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!isManual && (
        <p className="text-xs text-muted-foreground italic">
          Check your payslip — this is an estimate. Your actual take-home may differ slightly.
        </p>
      )}

      <div className="flex justify-between gap-2 pt-2">
        {onBack ? (
          <Button variant="outline" size="lg" onClick={onBack} className="gap-2">
            <ArrowLeft size={16} />
            Back
          </Button>
        ) : <span />}
        <Button
          variant="brand"
          size="lg"
          onClick={onContinue}
          disabled={!canContinue}
          className="gap-2"
        >
          {continueLabel}
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
