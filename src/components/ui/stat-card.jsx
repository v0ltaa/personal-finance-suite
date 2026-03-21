import { cn } from "../../lib/utils";

export function StatCard({ label, value, sub, trend, accent, className }) {
  const trendColor = trend === "up"
    ? "text-success"
    : trend === "down"
    ? "text-danger"
    : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border bg-card p-4",
        accent && "border-brand/30 bg-brand/5",
        className
      )}
    >
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className={cn(
        "text-2xl font-serif tracking-tight text-foreground",
        accent && "text-brand"
      )}>
        {value}
      </p>
      {sub && (
        <p className={cn("text-xs", trendColor)}>
          {sub}
        </p>
      )}
    </div>
  );
}
