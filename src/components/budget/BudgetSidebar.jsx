import { cn } from "../../lib/utils";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { useState } from "react";

import { fmtMoney } from "../../lib/ukTax";
const fmt = fmtMoney;

function SidebarRow({ label, value, accent, muted }) {
  return (
    <div className={cn("flex items-center justify-between py-1.5", muted && "opacity-50")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent ? "text-success" : "text-foreground")}>
        {fmt(value)}/mo
      </span>
    </div>
  );
}

export default function BudgetSidebar({ budget, currentStep, isMobile }) {
  const [open, setOpen] = useState(false);

  const takeHome = budget.income.monthlyTakeHome || 0;
  const committed = budget.committedTotal || 0;
  const essentials = budget.essentialsTotal || 0;
  const savings = budget.savingsTotal || 0;
  const lifestyle = budget.lifestyleTotal || 0;
  const surplus = takeHome - committed - essentials;
  const funMoney = surplus - savings;
  const unallocated = funMoney - lifestyle;

  if (currentStep === 0 && takeHome === 0) return null;

  const content = (
    <div className="space-y-1">
      {takeHome > 0 && <SidebarRow label="Take-home" value={takeHome} accent />}
      {currentStep >= 1 && <SidebarRow label="Committed" value={-committed} muted={committed === 0} />}
      {currentStep >= 2 && <SidebarRow label="Essentials" value={-essentials} muted={essentials === 0} />}
      {currentStep >= 2 && (
        <div className="border-t border-border pt-1.5 mt-1.5">
          <SidebarRow label="Surplus" value={surplus} accent={surplus > 0} />
        </div>
      )}
      {currentStep >= 3 && <SidebarRow label="Savings" value={-savings} muted={savings === 0} />}
      {currentStep >= 3 && (
        <SidebarRow label="Fun money" value={funMoney} accent={funMoney > 0} />
      )}
      {currentStep >= 4 && <SidebarRow label="Lifestyle" value={-lifestyle} muted={lifestyle === 0} />}
      {currentStep >= 4 && unallocated !== 0 && (
        <div className="border-t border-border pt-1.5 mt-1.5">
          <SidebarRow label="Unallocated" value={unallocated} accent={unallocated > 0} />
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="bg-card border-b border-border">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium"
        >
          <span>Your numbers</span>
          <div className="flex items-center gap-2">
            {takeHome > 0 && (
              <span className="text-xs text-success font-semibold">{fmt(takeHome)}/mo</span>
            )}
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>
        {open && <div className="px-4 pb-3">{content}</div>}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 sticky top-20">
      <h3 className="text-sm font-semibold text-foreground mb-3">Your numbers</h3>
      {content}
    </div>
  );
}
