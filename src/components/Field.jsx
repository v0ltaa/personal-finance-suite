import { useState } from "react";
import { sliderRanges } from "../lib/calc";
import { cn } from "../lib/utils";
import Tip from "./Tip";

export default function Field({ label, value, onChange, prefix, suffix, tip, note, sliderMode, fieldKey }) {
  const [focused, setFocused] = useState(false);
  const range = fieldKey && sliderRanges[fieldKey];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
          {tip && <Tip text={tip} />}
        </label>
        {note && <span className="text-xs text-muted-foreground font-serif italic">{note}</span>}
      </div>

      <div className={cn(
        "flex items-center border-b-2 pb-2 transition-colors duration-150",
        focused ? "border-brand" : "border-border"
      )}>
        {prefix && (
          <span className="text-muted-foreground text-base font-serif mr-2 shrink-0">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="bg-transparent border-none outline-none text-foreground text-lg font-serif w-full"
        />
        {suffix && (
          <span className="text-muted-foreground text-xs font-sans ml-2 shrink-0">{suffix}</span>
        )}
      </div>

      {sliderMode && range && (
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value || 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full mt-1 h-1 cursor-pointer accent-brand"
        />
      )}
    </div>
  );
}
