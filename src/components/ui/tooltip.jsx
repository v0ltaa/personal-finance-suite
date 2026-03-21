import { useState } from "react";
import { cn } from "../../lib/utils";

export function Tooltip({ content, children, className }) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && content && (
        <div
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50",
            "w-max max-w-xs px-3 py-2 rounded-lg text-xs",
            "bg-popover text-popover-foreground border border-border shadow-lg",
            "animate-fade-in",
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
