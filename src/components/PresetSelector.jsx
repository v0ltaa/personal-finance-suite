import { useState } from "react";
import { cn } from "../lib/utils";
import Field from "./Field";

export default function PresetSelector({ presets, value, onChange }) {
  const [custom, setCustom] = useState(false);
  const active = presets.find((p) => p.value === value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const isActive = !custom && value === p.value;
          return (
            <button
              key={p.label}
              onClick={() => { onChange(p.value); setCustom(false); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all duration-150 border",
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => setCustom(true)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all duration-150 border",
            custom
              ? "bg-brand/10 text-brand border-brand/40"
              : "bg-transparent text-muted-foreground border-border hover:text-foreground"
          )}
        >
          Custom
        </button>
      </div>

      {active && !custom && (
        <p className="text-xs font-serif italic text-muted-foreground">
          {active.desc} — {active.value}% p.a.
        </p>
      )}

      {custom && (
        <div className="max-w-[160px]">
          <Field label="Custom rate" suffix="% p.a." value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
