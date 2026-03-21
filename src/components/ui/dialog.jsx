import { useEffect } from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

export function Dialog({ open, onClose, children, className }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full max-h-[90vh] overflow-auto",
          "bg-card border border-border rounded-2xl shadow-xl",
          "animate-fade-in",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, children, onClose }) {
  return (
    <div className={cn("flex items-start justify-between p-6 pb-4", className)}>
      <div className="flex flex-col gap-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors ml-4 mt-0.5"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({ className, children }) {
  return (
    <h2 className={cn("text-lg font-semibold text-foreground", className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({ className, children }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  );
}

export function DialogBody({ className, children }) {
  return <div className={cn("px-6 pb-6", className)}>{children}</div>;
}

export function DialogFooter({ className, children }) {
  return (
    <div className={cn("flex items-center justify-end gap-2 px-6 py-4 border-t border-border", className)}>
      {children}
    </div>
  );
}
