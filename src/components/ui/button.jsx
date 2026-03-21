import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  brand: "bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm",
  outline: "border border-border bg-transparent hover:bg-muted text-foreground",
  ghost: "bg-transparent hover:bg-muted text-foreground",
  muted: "bg-muted text-muted-foreground hover:bg-muted/70",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  link: "underline-offset-4 hover:underline text-foreground p-0 h-auto",
};

const sizes = {
  sm: "h-8 px-3 text-xs rounded-md gap-1.5",
  md: "h-9 px-4 text-sm rounded-lg gap-2",
  lg: "h-10 px-5 text-sm rounded-lg gap-2",
  icon: "h-9 w-9 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-md",
};

export const Button = forwardRef(function Button(
  { className, variant = "default", size = "md", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-medium font-sans",
        "transition-colors duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant] ?? variants.default,
        sizes[size] ?? sizes.md,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
