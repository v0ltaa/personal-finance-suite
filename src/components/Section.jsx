import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export default function Section({ title, children, defaultOpen = true, onSave, onLoad, canSave }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-8">
      <div
        className={cn(
          "flex items-center justify-between pb-2.5 border-b border-border",
          "cursor-pointer select-none mb-0",
          open && "mb-5"
        )}
        onClick={() => setOpen(!open)}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {canSave && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onSave?.(); }}
                className="h-6 px-2 text-[10px] uppercase tracking-wide"
              >
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onLoad?.(); }}
                className="h-6 px-2 text-[10px] uppercase tracking-wide"
              >
                Load
              </Button>
            </>
          )}
          <ChevronDown
            size={15}
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              !open && "-rotate-90"
            )}
          />
        </div>
      </div>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}
