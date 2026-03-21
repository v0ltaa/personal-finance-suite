import Tip from "./Tip";

export default function Toggle({ label, value, onChange, tip }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
      <div
        onClick={() => onChange(!value)}
        className={[
          "relative w-9 h-5 rounded-full shrink-0 transition-colors duration-200",
          value ? "bg-brand" : "bg-input border border-border",
        ].join(" ")}
      >
        <span className={[
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
          value ? "left-[18px]" : "left-0.5",
        ].join(" ")} />
      </div>
      <span className="text-sm font-medium text-foreground group-hover:text-foreground/90 transition-colors">
        {label}
      </span>
      {tip && <Tip text={tip} />}
    </label>
  );
}
