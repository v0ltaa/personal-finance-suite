import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative flex items-center">
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full appearance-none rounded-lg border border-input bg-background",
          "px-3 pr-8 py-2 text-sm text-foreground",
          "transition-colors duration-150 cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-3 text-muted-foreground pointer-events-none"
      />
    </div>
  );
});
