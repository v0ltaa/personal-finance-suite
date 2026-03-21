import { cn } from "../lib/utils";

export default function Stat({ label, value, sub, accent }) {
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn(
        "text-2xl sm:text-3xl font-serif font-normal leading-none tracking-tight text-foreground",
        accent && "text-brand"
      )}>
        {value}
      </p>
      {sub && (
        <p className="text-xs font-serif italic text-muted-foreground mt-1">{sub}</p>
      )}
    </div>
  );
}
