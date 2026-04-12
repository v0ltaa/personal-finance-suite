import { useMemo, useState } from "react";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { calcMonthlyTakeHome, STUDENT_LOAN_OPTIONS, toMonthly, fmtMoney, fmtInputValue, evalFormula } from "../../lib/ukTax";
import BudgetLineItem from "./BudgetLineItem";
import Tip from "../Tip";
import { ArrowRight, Plus } from "lucide-react";

const fmt = fmtMoney;

export default function StepIncome({ income, onChange, onContinue }) {
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
  if (income.monthlyTakeHome !== monthlyTakeHome) {
    Promise.resolve().then(() => onChange({ ...income, monthlyTakeHome }));
  }

  const [grossRaw, setGrossRaw] = useState(null);
  const [manualRaw, setManualRaw] = useState(null);

  const handleGrossChange = (e) => {
    const raw = e.target.value;
    if (raw.startsWith("=")) { setGrossRaw(raw); return; }
    setGrossRaw(null);
    const clean = raw.replace(/,/g, "");
    const val = clean === "" ? 0 : Math.max(0, Number(clean));
    if (!isNaN(val)) update("grossAnnual", val);
  };
  const handleGrossBlur = () => {
    if (grossRaw?.startsWith("=")) {
      const r = evalFormula(grossRaw.slice(1));
      if (!isNaN(r) && r >= 0) update("grossAnnual", Math.round(r * 100) / 100);
      setGrossRaw(null);
    }
  };

  const handleManualChange = (e) => {
    const raw = e.target.value;
    if (raw.startsWith("=")) { setManualRaw(raw); return; }
    setManualRaw(null);
    const clean = raw.replace(/,/g, "");
    const val = clean === "" ? 0 : Math.max(0, Number(clean));
    if (!isNaN(val)) update("manualTakeHome", val);
  };
  const handleManualBlur = () => {
    if (manualRaw?.startsWith("=")) {
      const r = evalFormula(manualRaw.slice(1));
      if (!isNaN(r) && r >= 0) update("manualTakeHome", Math.round(r * 100) / 100);
      setManualRaw(null);
    }
  };

  const handleDeductionChange = (id, updated) => {
    update("deductions", income.deductions.map((d) => (d.id === id ? updated : d)));
  };

  const handleDeductionRemove = (id) => {
    update("deductions", income.deductions.filter((d) => d.id !== id));
  };

  const handleDeductionAdd = () => {
    update("deductions", [
      ...income.deductions,
      { id: crypto.randomUUID(), name: "New deduction", amount: 0, frequency: "monthly" },
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
              {(income.deductions || []).map((item) => (
                <BudgetLineItem
                  key={item.id}
                  item={item}
                  onChange={(updated) => handleDeductionChange(item.id, updated)}
                  onRemove={() => handleDeductionRemove(item.id)}
                  showFrequency={false}
                />
              ))}
              <button
                onClick={handleDeductionAdd}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand transition-colors py-2 px-1"
              >
                <Plus size={12} />
                Add deduction
              </button>
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

      <div className="flex justify-end pt-2">
        <Button
          variant="brand"
          size="lg"
          onClick={onContinue}
          disabled={!canContinue}
          className="gap-2"
        >
          Continue
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
