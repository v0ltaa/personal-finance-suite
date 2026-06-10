import { useEffect, useRef } from "react";
import { Button } from "./button";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: backdrop + Escape close, focus trap, body scroll
 * lock, and focus restore. Children render inside a scrollable body region.
 */
export default function Modal({ title, ariaLabel, onClose, children, maxWidth = "max-w-sm", headerExtra, bodyClassName }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the dialog itself unless something inside (e.g. autoFocus input) already has focus
    if (!dialogRef.current?.contains(document.activeElement)) {
      dialogRef.current?.focus();
    }

    const handleKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll(FOCUSABLE);
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : ariaLabel}
        tabIndex={-1}
        className={cn(
          "bg-card text-card-foreground rounded-xl border border-border shadow-sm",
          "w-full mx-4 max-h-[85vh] flex flex-col outline-none",
          maxWidth
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between p-5 pb-3 border-b border-border shrink-0">
            {typeof title === "string" ? (
              <h3 className="font-semibold text-foreground">{title}</h3>
            ) : (
              title
            )}
            <div className="flex items-center gap-3">
              {headerExtra}
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog">
                <X size={14} />
              </Button>
            </div>
          </div>
        )}
        <div className={cn("flex-1 overflow-y-auto p-5", title && "pt-4", bodyClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
