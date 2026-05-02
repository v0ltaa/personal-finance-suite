import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { TrendingUp, Briefcase, Activity, FlaskConical } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { cn } from "../../lib/utils";
import usePortfolioStore from "../../stores/portfolioStore";
import { FactSheetModal } from "../../components/portfolio/FactSheetModal";
import { updateStock } from "../../services/portfolioService";

const tabs = [
  { key: "stocks",    label: "Stocks",    path: "/portfolio-strategy/stocks",    icon: TrendingUp },
  { key: "portfolio", label: "Portfolio", path: "/portfolio-strategy/portfolio", icon: Briefcase },
  { key: "indicator", label: "Indicator", path: "/portfolio-strategy/indicator", icon: Activity },
  { key: "sandbox",   label: "Sandbox",   path: "/portfolio-strategy/sandbox",   icon: FlaskConical },
];

export default function PortfolioLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    factSheetStock,
    factSheetOnRemove,
    closeFactSheet,
    updateStockInStore,
    updateFactSheetStock,
  } = usePortfolioStore();

  const handleNotesSaved = (id, notes) => {
    updateStockInStore(id, { notes });
    updateFactSheetStock(id, { notes });
  };

  const handleRemove = factSheetOnRemove
    ? (stock) => { closeFactSheet(); factSheetOnRemove(stock); }
    : undefined;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-[1600px] mx-auto">
      {/* Module header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground tracking-tight">Portfolio Strategy</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track stocks, manage strategies, monitor indicators, and run simulations.
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}>
        {tabs.map((tab) => {
          const isActive = pathname === tab.path || pathname.startsWith(tab.path + "/");
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
                "border-b-2 -mb-px transition-all duration-150 rounded-t-md",
                isActive
                  ? "border-brand text-brand bg-brand/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <Outlet />

      {/* Global FactSheet Modal */}
      {factSheetStock && (
        <FactSheetModal
          stock={factSheetStock}
          onClose={closeFactSheet}
          onRemove={handleRemove}
          onNotesSaved={handleNotesSaved}
        />
      )}

      {/* Toast provider */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4500,
          style: {
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
            padding: "10px 16px",
          },
          success: {
            style: {
              background: "hsl(var(--success) / 0.08)",
              border: "1px solid hsl(var(--success) / 0.25)",
              color: "hsl(var(--success))",
            },
            iconTheme: { primary: "hsl(var(--success))", secondary: "white" },
          },
          error: {
            style: {
              background: "hsl(var(--danger) / 0.08)",
              border: "1px solid hsl(var(--danger) / 0.25)",
              color: "hsl(var(--danger))",
            },
            iconTheme: { primary: "hsl(var(--danger))", secondary: "white" },
          },
        }}
      />
    </div>
  );
}
