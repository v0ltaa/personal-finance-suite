import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { label: "Income", short: "1" },
  { label: "Committed", short: "2" },
  { label: "Essentials", short: "3" },
  { label: "Savings", short: "4" },
  { label: "Lifestyle", short: "5" },
  { label: "Summary", short: "6" },
];

export default function ProgressIndicator({ currentStep, onStepClick, completedSteps }) {
  return (
    <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-3 px-1">
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = completedSteps.includes(i);
        const isClickable = isCompleted || i <= Math.max(...completedSteps, 0);

        return (
          <button
            key={i}
            onClick={() => isClickable && onStepClick(i)}
            disabled={!isClickable}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
              "transition-all duration-150",
              isActive && "bg-brand text-white shadow-sm",
              !isActive && isCompleted && "bg-success/10 text-success hover:bg-success/20 cursor-pointer",
              !isActive && !isCompleted && isClickable && "bg-muted text-muted-foreground hover:bg-muted/70 cursor-pointer",
              !isClickable && "bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            {isCompleted && !isActive ? (
              <Check size={12} className="shrink-0" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-current/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </span>
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
