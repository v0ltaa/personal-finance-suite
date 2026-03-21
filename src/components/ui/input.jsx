import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export const Input = forwardRef(function Input({ className, type = "text", prefix, suffix, ...props }, ref) {
  if (prefix || suffix) {
    return (
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-sm text-muted-foreground pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            "flex h-9 w-full rounded-lg border border-input bg-background",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            prefix && "pl-7",
            suffix && "pr-10",
            "px-3 py-2",
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-sm text-muted-foreground pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2",
        "text-sm text-foreground placeholder:text-muted-foreground",
        "transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

export function Label({ className, children, ...props }) {
  return (
    <label
      className={cn("text-xs font-medium text-muted-foreground leading-none", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function FormField({ label, hint, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
