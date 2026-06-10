import { useState } from "react";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { FREQUENCY_OPTIONS, toMonthly, fmtMoney, fmtInputValue, evalFormula } from "../../lib/ukTax";
import { X, GripVertical } from "lucide-react";

export default function BudgetLineItem({
  item,
  onChange,
  onRemove,
  showFrequency = true,
  helper,
  removable = true,
}) {
  const [editing, setEditing] = useState(false);
  const monthly = toMonthly(item.amount, item.frequency);
  const isEmpty = item.amount === 0;

  const isCouncilTax = item.name === "Council Tax";
  const singlePerson = item.singlePerson || false;
  const effectiveMonthly = isCouncilTax && singlePerson ? monthly * 0.75 : monthly;

  // Keep the raw text while typing so decimals ("130.73") and formulas
  // ("=850/2") aren't reformatted mid-keystroke; format on blur.
  const [rawInput, setRawInput] = useState(null);

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

  const handleAmountKeyDown = (e) => {
    if (e.key === "Enter" && rawInput && rawInput.startsWith("=")) {
      handleAmountBlur();
    }
  };

  const handleNameChange = (e) => {
    onChange({ ...item, name: e.target.value });
  };

  const handleFrequencyChange = (e) => {
    onChange({ ...item, frequency: e.target.value });
  };

  const toggleSinglePerson = () => {
    onChange({ ...item, singlePerson: !singlePerson });
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-start gap-2 sm:gap-3 py-2 px-1 rounded-lg transition-all duration-150",
          isEmpty ? "opacity-50" : "opacity-100",
          "hover:bg-muted/30"
        )}
      >
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={item.name}
              onChange={handleNameChange}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              autoFocus
              className="h-7 text-sm mb-1"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-foreground hover:text-brand transition-colors text-left truncate w-full"
            >
              {item.name}
            </button>
          )}
          {helper && <p className="text-xs text-muted-foreground mt-0.5">{helper}</p>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            type="text"
            inputMode="decimal"
            prefix="£"
            value={rawInput !== null ? rawInput : fmtInputValue(item.amount)}
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
            onKeyDown={handleAmountKeyDown}
            placeholder="0"
            className="w-24 h-8 text-sm text-right"
          />

          {showFrequency && (
            <Select
              value={item.frequency}
              onChange={handleFrequencyChange}
              className="w-auto h-8 text-xs pr-7 pl-2"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  /{f.short}
                </option>
              ))}
            </Select>
          )}

          {showFrequency && item.frequency !== "monthly" && item.amount > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
              = {fmtMoney(effectiveMonthly)}/mo
            </span>
          )}

          {removable && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              aria-label={`Remove ${item.name}`}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-danger"
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Council Tax single person discount toggle */}
      {isCouncilTax && item.amount > 0 && (
        <div className="flex items-center gap-2 pl-1 pb-1">
          <button
            onClick={toggleSinglePerson}
            className={cn(
              "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
              singlePerson ? "bg-brand" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full bg-white transition-transform shadow-sm",
                singlePerson ? "translate-x-3.5" : "translate-x-0.5"
              )}
            />
          </button>
          <span className="text-xs text-muted-foreground">
            Single person (25% off)
            {singlePerson && item.amount > 0 && (
              <span className="ml-1 text-success font-medium">
                {fmtMoney(effectiveMonthly)}/mo
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
