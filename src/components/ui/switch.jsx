import { cn } from "../../lib/utils";

export function Switch({ checked, onChange, className, label, size = "md" }) {
  const sizes = {
    sm: { track: "w-8 h-4", thumb: "w-3 h-3", translate: "translate-x-4" },
    md: { track: "w-10 h-5", thumb: "w-4 h-4", translate: "translate-x-5" },
  };
  const s = sizes[size] ?? sizes.md;

  return (
    <label className={cn("flex items-center gap-2 cursor-pointer select-none", className)}>
      <div
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative inline-flex items-center rounded-full transition-colors duration-200",
          s.track,
          checked ? "bg-brand" : "bg-input border border-border"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200",
            s.thumb,
            checked ? s.translate : "translate-x-0.5"
          )}
        />
      </div>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}
