import { useState } from "react";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { FREQUENCY_OPTIONS, toMonthly } from "../../lib/ukTax";
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

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    const val = raw === "" ? 0 : Math.max(0, Number(raw));
    if (!isNaN(val)) onChange({ ...item, amount: val });
  };

  const handleNameChange = (e) => {
    onChange({ ...item, name: e.target.value });
  };

  const handleFrequencyChange = (e) => {
    onChange({ ...item, frequency: e.target.value });
  };

  return (
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
          inputMode="numeric"
          prefix="£"
          value={item.amount === 0 ? "" : item.amount.toLocaleString("en-GB")}
          onChange={handleAmountChange}
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
                /{f.value.slice(0, 2)}
              </option>
            ))}
          </Select>
        )}

        {showFrequency && item.frequency !== "monthly" && item.amount > 0 && (
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
            = £{Math.round(monthly).toLocaleString("en-GB")}/mo
          </span>
        )}

        {removable && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-danger"
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
