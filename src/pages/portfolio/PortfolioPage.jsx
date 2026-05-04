import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Plus, Info, Trash2, AlertTriangle,
  AlertCircle, BarChart3, Briefcase, Settings, Maximize2, FileDown,
} from "lucide-react";
import PotExpandedModal from "../../components/portfolio/PotExpandedModal";
import { exportPortfolioPdf } from "../../lib/pdfExport";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "../../components/ui/dialog";
import { Input, FormField } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import usePortfolioStore from "../../stores/portfolioStore";
import { fetchStocks, fetchHoldings, insertHolding, deleteHolding, updateHolding, fetchIndicatorLog } from "../../services/portfolioService";
import { volatilityVariant } from "../../components/portfolio/FactSheetModal";
import {
  CURRENCIES, getDisplayCurrency, setDisplayCurrency as persistCurrency,
  currencySymbol,
} from "../../lib/currency";

// ── Constants ──────────────────────────────────────────────────────────────

const STRATEGIES = [
  {
    key: "buy_and_hold",
    label: "Buy & Hold",
    color: "#c4503a",
    description: "Core long-term positions. Always-on allocation.",
    accentClass: "border-l-[3px] border-l-brand",
  },
  {
    key: "fortress",
    label: "Fortress",
    color: "#5aabcc",
    description: "Capital preservation & defensive positions. Active when in Fortress mode.",
    accentClass: "border-l-[3px] border-l-[#5aabcc]",
  },
  {
    key: "slingshot",
    label: "Slingshot",
    color: "#f4a636",
    description: "High-volatility plays with a 90 trading day hold window. Active when in Slingshot mode.",
    accentClass: "border-l-[3px] border-l-[#f4a636]",
  },
];

const CHART_COLORS = ["#c4503a", "#5aabcc", "#7bc47c", "#f4a636", "#9b5fc0", "#4a90d9", "#e07b54"];
const UNALLOCATED_COLOR = "#e5e7eb";
const SLINGSHOT_DAYS = 90;

// ── Helpers ────────────────────────────────────────────────────────────────

function tradingDaysElapsed(entryDate) {
  const start = new Date(entryDate);
  const now = new Date();
  if (isNaN(start.getTime()) || start > now) return 0;
  let count = 0;
  const d = new Date(start);
  d.setDate(d.getDate() + 1);
  while (d <= now) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function tradingDaysRemaining(entryDate, total = SLINGSHOT_DAYS) {
  return Math.max(0, total - tradingDaysElapsed(entryDate));
}

function sumWeights(holdings) {
  return holdings.reduce((s, h) => s + (Number(h.weight) || 0), 0);
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function fmtMoney(gbpAmount, displayCurrency) {
  if (!gbpAmount) return null;
  const sym = currencySymbol(displayCurrency || "GBP");
  return `${sym}${Math.round(gbpAmount).toLocaleString("en-GB")}`;
}

// ── Donut Chart ────────────────────────────────────────────────────────────

function DonutChart({ holdings, target }) {
  const total = sumWeights(holdings);
  const unallocated = Math.max(0, target - total);
  const data = [
    ...holdings.map((h, i) => ({
      name: h.ticker,
      value: Number(h.weight) || 0,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    ...(unallocated > 0 ? [{ name: "Cash", value: unallocated, fill: UNALLOCATED_COLOR }] : []),
  ];

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex items-center justify-center h-[120px]">
        <div className="w-20 h-20 rounded-full border-4 border-dashed border-border flex items-center justify-center">
          <BarChart3 size={18} className="text-muted-foreground/40" />
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <PieChart>
        <Pie
          data={data} cx="50%" cy="50%"
          innerRadius={32} outerRadius={52}
          paddingAngle={holdings.length > 1 ? 2 : 0}
          dataKey="value" stroke="none"
        >
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
          contentStyle={{
            background: "var(--color-card, #fff)",
            border: "1px solid var(--color-border, #e5e7eb)",
            borderRadius: "8px", fontSize: "12px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Countdown Bar (Slingshot) ──────────────────────────────────────────────

function CountdownBar({ entryDate }) {
  const remaining = tradingDaysRemaining(entryDate);
  const elapsed = SLINGSHOT_DAYS - remaining;
  const pct = Math.min(100, (elapsed / SLINGSHOT_DAYS) * 100);
  const isRed = remaining <= 10;
  const isAmber = !isRed && remaining <= 20;

  return (
    <div className="mt-1.5 min-w-[120px]">
      <div className="w-full bg-muted rounded-full h-1">
        <div
          className={cn("h-1 rounded-full transition-all", isRed ? "bg-danger" : isAmber ? "bg-warning" : "bg-success")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={cn("text-[10px] mt-0.5 tabular-nums", isRed ? "text-danger" : isAmber ? "text-warning" : "text-muted-foreground")}>
        {remaining}d left
      </p>
    </div>
  );
}

// ── Edit Holding Dialog ────────────────────────────────────────────────────

function EditHoldingDialog({ open, onClose, holding, strategy, target, totalCapital, displayCurrency, onSave, onDelete }) {
  const isPot = true;
  const [inputMode, setInputMode] = useState(isPot ? "pot" : "pct");
  const [weight, setWeight]     = useState("");
  const [amount, setAmount]     = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const sym = currencySymbol(displayCurrency);
  const stratDef = STRATEGIES.find((s) => s.key === strategy);

  useEffect(() => {
    if (open && holding) {
      const w = Number(holding.weight);
      const defaultMode = isPot ? "pot" : "pct";
      setInputMode(defaultMode);
      // In pot mode, display as % of pot; in pct mode display as portfolio %
      setWeight(defaultMode === "pot" && target ? ((w / target) * 100).toFixed(1) : w.toFixed(1));
      setAmount(totalCapital ? String(Math.round((totalCapital * w) / 100)) : "");
      setEntryDate(holding.entry_date ? holding.entry_date.split("T")[0] : today());
      setError("");
    }
  }, [open, holding, totalCapital, isPot, target]);

  // Derived hints
  const potPct   = inputMode === "pot"    && target        ? Number(weight)                          : null;
  const portPct  = inputMode === "pot"    && target        ? (Number(weight) * target) / 100         : null;
  const amtHint  = inputMode === "amount" && totalCapital && amount ? (Number(amount) / totalCapital) * 100 : null;
  const potHint  = inputMode === "pct"    && target        ? (Number(weight) / target) * 100         : null;

  const handleSave = async () => {
    setError("");
    let w;
    if (inputMode === "pct") {
      w = Number(weight);
      if (!w || w <= 0 || w > 100) { setError("Weight must be between 0.1 and 100."); return; }
    } else if (inputMode === "pot") {
      const pv = Number(weight);
      if (!pv || pv <= 0 || pv > 100) { setError("Must be between 0.1 and 100% of pot."); return; }
      w = (pv * target) / 100;
    } else {
      if (!totalCapital) { setError("Set total portfolio value in Settings first."); return; }
      const a = Number(amount);
      if (!a || a <= 0) { setError("Enter a valid amount."); return; }
      w = (a / totalCapital) * 100;
      if (w > 100) { setError("Amount exceeds total portfolio value."); return; }
    }
    setSaving(true);
    await onSave(holding.id, { weight: parseFloat(w.toFixed(2)), entry_date: entryDate });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setSaving(true);
    await onDelete(holding);
    setSaving(false);
    onClose();
  };

  if (!holding) return null;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose}>
      <DialogHeader onClose={saving ? undefined : onClose}>
        <DialogTitle>Edit {holding.ticker}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 self-start">
          {isPot && (
            <button
              onClick={() => {
                // convert current value when switching modes
                if (inputMode === "pct" && target) setWeight(((Number(weight) / target) * 100).toFixed(1));
                if (inputMode === "amount" && totalCapital && amount) {
                  const portW = (Number(amount) / totalCapital) * 100;
                  setWeight(((portW / target) * 100).toFixed(1));
                }
                setInputMode("pot");
              }}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                inputMode === "pot" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              % of {stratDef?.label}
            </button>
          )}
          <button
            onClick={() => {
              if (inputMode === "pot" && target) setWeight(((Number(weight) * target) / 100).toFixed(1));
              setInputMode("pct");
            }}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              inputMode === "pct" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Portfolio %
          </button>
          <button
            onClick={() => setInputMode("amount")}
            disabled={!totalCapital}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              inputMode === "amount" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              !totalCapital && "opacity-40 cursor-not-allowed"
            )}
            title={!totalCapital ? "Set total portfolio value in Settings first" : undefined}
          >
            Amount ({sym})
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {inputMode === "pot" ? (
            <FormField
              label={`% of ${stratDef?.label}`}
              hint={portPct != null ? `= ${portPct.toFixed(1)}% of portfolio` : ""}
            >
              <Input type="number" min="0.1" max="100" step="0.1" value={weight}
                onChange={(e) => setWeight(e.target.value)} />
            </FormField>
          ) : inputMode === "pct" ? (
            <FormField
              label="Portfolio %"
              hint={isPot && potHint != null ? `= ${potHint.toFixed(1)}% of ${stratDef?.label} pot` : "As % of total portfolio"}
            >
              <Input type="number" min="0.1" max="100" step="0.1" value={weight}
                onChange={(e) => setWeight(e.target.value)} />
            </FormField>
          ) : (
            <FormField label={`Amount (${sym})`} hint={amtHint != null ? `≈ ${amtHint.toFixed(1)}% of portfolio` : ""}>
              <Input type="number" min="1" step="100" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </FormField>
          )}
          <FormField label="Entry Date">
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </FormField>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle size={14} className="shrink-0" />{error}
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving}
          className="text-danger hover:text-danger mr-auto">
          <Trash2 size={13} /> Remove
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="brand" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ── Holding Row ────────────────────────────────────────────────────────────

function HoldingRow({ holding, strategy, onEdit, onStockClick, stock, totalCapital, displayCurrency }) {
  const weight = Number(holding.weight);
  const amount = totalCapital && weight ? (totalCapital * weight) / 100 : null;

  return (
    <div
      className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0 group cursor-pointer hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
      onClick={() => onEdit(holding)}
    >
      <button
        onClick={(e) => { e.stopPropagation(); stock && onStockClick(stock); }}
        className={cn(
          "font-mono text-sm font-bold text-foreground tracking-tight",
          stock ? "hover:text-brand transition-colors cursor-pointer" : "cursor-default"
        )}
      >
        {holding.ticker}
      </button>
      <span className="text-xs text-muted-foreground mt-px flex-1 truncate">
        {stock?.fact_sheet?.name ? <span className="hidden sm:inline">{stock.fact_sheet.name}</span> : null}
      </span>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-xs font-medium text-foreground tabular-nums">{weight.toFixed(1)}%</span>
        {amount && <span className="text-[10px] text-muted-foreground tabular-nums">{fmtMoney(amount, displayCurrency)}</span>}
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {holding.entry_date
            ? new Date(holding.entry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
            : "—"}
        </span>
        {strategy === "slingshot" && holding.entry_date && <CountdownBar entryDate={holding.entry_date} />}
      </div>
    </div>
  );
}

// ── Settings Modal ─────────────────────────────────────────────────────────

function SettingsModal({ open, onClose, totalCapital, onCapitalChange, buyHoldPct, onBuyHoldPctChange, displayCurrency, onCurrencyChange }) {
  const [cap, setCap] = useState("");
  const [bh, setBh] = useState("");
  const [curr, setCurr] = useState(displayCurrency);

  useEffect(() => {
    if (open) {
      setCap(String(totalCapital || ""));
      setBh(String(buyHoldPct));
      setCurr(displayCurrency);
    }
  }, [open, totalCapital, buyHoldPct, displayCurrency]);

  const activePct = 100 - Math.max(1, Math.min(99, Number(bh) || 40));

  const handleSave = () => {
    onCapitalChange(Number(cap) || 0);
    onBuyHoldPctChange(Math.max(1, Math.min(99, Number(bh) || 40)));
    onCurrencyChange(curr);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>Portfolio Settings</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-5">

        <FormField label="Currency">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CURRENCIES).map(([code, { symbol, name }]) => (
              <button
                key={code}
                onClick={() => setCurr(code)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all",
                  curr === code
                    ? "border-brand bg-brand/5 text-brand font-medium"
                    : "border-border text-muted-foreground hover:border-border/80"
                )}
              >
                <span className="font-mono font-bold w-6 text-center">{symbol}</span>
                <span className="text-xs">{name}</span>
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Total Portfolio Value" hint="Shows £ amounts alongside percentages in each holding">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {currencySymbol(curr)}
            </span>
            <Input
              type="number" min={0} step={1000}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder="e.g. 50000"
              className="pl-7"
            />
          </div>
        </FormField>

        <FormField label="Buy & Hold %" hint={`Active strategy gets the remaining ${activePct}%`}>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={1} max={99} step={1}
              value={bh}
              onChange={(e) => setBh(e.target.value)}
              placeholder="40"
            />
            <span className="text-sm text-muted-foreground shrink-0">%</span>
          </div>
        </FormField>

        <div className="flex items-center gap-4 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand" />
            Buy & Hold: <strong className="text-foreground">{Math.max(1, Math.min(99, Number(bh) || 40))}%</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f4a636]" />
            Active: <strong className="text-foreground">{activePct}%</strong>
          </div>
        </div>

      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="brand" size="sm" onClick={handleSave}>Save</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ── Add Holding Modal ──────────────────────────────────────────────────────

function AddHoldingModal({ open, onClose, strategy, target, stocks, existingTickers, onAdd, totalCapital, displayCurrency }) {
  const isPot = true;
  const [ticker, setTicker] = useState("");
  const [inputMode, setInputMode] = useState(isPot ? "pot" : "pct");
  const [weight, setWeight] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTicker(""); setWeight(""); setAmount(""); setEntryDate(today());
      setError(""); setSaving(false); setInputMode(isPot ? "pot" : "pct");
    }
  }, [open, isPot]);

  const stratDef = STRATEGIES.find((s) => s.key === strategy);
  const available = stocks.filter((s) => !existingTickers.has(s.ticker));
  const sym = currencySymbol(displayCurrency);

  const portPct  = inputMode === "pot"    && target && weight ? (Number(weight) * target) / 100 : null;
  const potHint  = inputMode === "pct"    && target && weight ? (Number(weight) / target) * 100  : null;
  const amtHint  = inputMode === "amount" && totalCapital && amount ? (Number(amount) / totalCapital) * 100 : null;

  const handleAdd = async () => {
    setError("");
    if (!ticker) { setError("Select a stock."); return; }
    let w;
    if (inputMode === "pot") {
      const pv = Number(weight);
      if (!pv || pv <= 0 || pv > 100) { setError("Must be between 0.1 and 100% of pot."); return; }
      w = (pv * target) / 100;
    } else if (inputMode === "pct") {
      w = Number(weight);
      if (!w || w <= 0 || w > 100) { setError("Enter a weight between 0.1 and 100."); return; }
    } else {
      if (!totalCapital) { setError("Set total portfolio value in Settings first."); return; }
      const a = Number(amount);
      if (!a || a <= 0) { setError("Enter a valid amount."); return; }
      w = (a / totalCapital) * 100;
      if (w > 100) { setError("Amount exceeds total portfolio value."); return; }
    }
    setSaving(true);
    await onAdd({ ticker, weight: parseFloat(w.toFixed(2)), entry_date: entryDate, strategy });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose}>
      <DialogHeader onClose={saving ? undefined : onClose}>
        <DialogTitle>Add to {stratDef?.label}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <FormField label="Stock">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No stocks in library — add stocks on the Stocks tab first.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border border-border rounded-lg">
              {available.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setTicker(s.ticker)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                    ticker === s.ticker ? "bg-brand/10 text-brand font-medium" : "hover:bg-muted text-foreground"
                  )}
                >
                  <span className="font-mono font-bold w-14 shrink-0">{s.ticker}</span>
                  <span className="text-muted-foreground truncate text-xs">{s.fact_sheet?.name || ""}</span>
                  {s.fact_sheet?.volatilityTier && (
                    <Badge variant={volatilityVariant(s.fact_sheet.volatilityTier)} className="ml-auto shrink-0 text-[10px] py-0">
                      {s.fact_sheet.volatilityTier}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </FormField>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 self-start">
            {isPot && (
              <button
                onClick={() => setInputMode("pot")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  inputMode === "pot" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                % of {stratDef?.label}
              </button>
            )}
            <button
              onClick={() => setInputMode("pct")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                inputMode === "pct" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Portfolio %
            </button>
            <button
              onClick={() => setInputMode("amount")}
              disabled={!totalCapital}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                inputMode === "amount" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                !totalCapital && "opacity-40 cursor-not-allowed"
              )}
              title={!totalCapital ? "Set total portfolio value in Settings first" : undefined}
            >
              Amount ({sym})
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {inputMode === "pot" ? (
              <FormField label={`% of ${stratDef?.label}`} hint={portPct != null ? `= ${portPct.toFixed(1)}% of portfolio` : ""}>
                <Input type="number" min="0.1" max="100" step="0.1" value={weight}
                  onChange={(e) => setWeight(e.target.value)} placeholder="100" />
              </FormField>
            ) : inputMode === "pct" ? (
              <FormField label="Portfolio %" hint={isPot && potHint != null ? `= ${potHint.toFixed(1)}% of ${stratDef?.label} pot` : "As % of total portfolio"}>
                <Input type="number" min="0.1" max="100" step="0.1" value={weight}
                  onChange={(e) => setWeight(e.target.value)} placeholder="5.0" />
              </FormField>
            ) : (
              <FormField label={`Amount (${sym})`} hint={amtHint != null ? `≈ ${amtHint.toFixed(1)}% of portfolio` : ""}>
                <Input type="number" min="1" step="100" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={totalCapital ? `e.g. ${Math.round(totalCapital * 0.05)}` : "0"} />
              </FormField>
            )}
            <FormField label="Entry Date">
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </FormField>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle size={14} className="shrink-0" />{error}
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="brand" size="sm" onClick={handleAdd} disabled={saving || !ticker || (!weight && !amount)}>
          {saving ? "Adding…" : "Add Position"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ── Total Portfolio Section ────────────────────────────────────────────────

const VIEW_OPTS = [
  { key: "fortress",  label: "Fortress",  short: "Fort.",  color: "#5aabcc" },
  { key: "slingshot", label: "Slingshot", short: "Sling.", color: "#f4a636" },
];

function TotalPortfolioSection({ holdings, totalCapital, displayCurrency, activeMode }) {
  const sym = currencySymbol(displayCurrency);
  const [viewMode, setViewMode] = useState(activeMode === "fortress" ? "fortress" : "slingshot");

  const viewDef = VIEW_OPTS.find((v) => v.key === viewMode);

  // Build merged rows: B&H + viewMode only (math is correct for a single active pot)
  const tickerMap = {};
  (holdings.buy_and_hold || []).forEach((h) => {
    tickerMap[h.ticker] = { ticker: h.ticker, bh: h, active: null };
  });
  (holdings[viewMode] || []).forEach((h) => {
    if (!tickerMap[h.ticker]) tickerMap[h.ticker] = { ticker: h.ticker, bh: null, active: null };
    tickerMap[h.ticker].active = h;
  });
  const rows = Object.values(tickerMap);

  const bhTotal     = sumWeights(holdings.buy_and_hold || []);
  const activeTotal = sumWeights(holdings[viewMode]    || []);
  const totalAllocated = bhTotal + activeTotal;

  const donutData = [
    { name: "Buy & Hold", value: bhTotal,     fill: "#c4503a" },
    { name: viewDef?.label, value: activeTotal, fill: viewDef?.color },
  ].filter((d) => d.value > 0);
  const unallocated = Math.max(0, 100 - totalAllocated);
  if (unallocated > 0.01) donutData.push({ name: "Cash", value: unallocated, fill: UNALLOCATED_COLOR });

  const fmtTotal = (pct) => totalCapital
    ? `${sym}${Math.round((totalCapital * pct) / 100).toLocaleString("en-GB")}`
    : `${pct.toFixed(1)}%`;
  const fmtPct = (pct) => `${pct.toFixed(1)}%`;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden border-l-[3px] border-l-foreground/20 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground flex-1">Total Portfolio</h3>
          {/* Toggle: which active pot to view */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {VIEW_OPTS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setViewMode(opt.key)}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all",
                  viewMode === opt.key
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={viewMode === opt.key ? { color: opt.color } : {}}
              >
                {opt.short}
              </button>
            ))}
          </div>
          <Badge variant={totalAllocated > 100.01 ? "danger" : "muted"} className="text-[10px] font-mono">
            {totalAllocated.toFixed(1)}%
          </Badge>
        </div>
        {totalCapital ? (
          <p className="text-xl font-serif text-foreground mt-0.5">
            {sym}{Math.round(totalCapital).toLocaleString("en-GB")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic mt-0.5">Capital not set</p>
        )}
      </div>

      {/* Donut */}
      {donutData.some((d) => d.value > 0 && d.name !== "Cash") ? (
        <ResponsiveContainer width="100%" height={110}>
          <PieChart>
            <Pie data={donutData} cx="50%" cy="50%" innerRadius={28} outerRadius={46}
              paddingAngle={donutData.length > 1 ? 2 : 0} dataKey="value" stroke="none">
              {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
              contentStyle={{
                background: "var(--color-card,#fff)",
                border: "1px solid var(--color-border,#e5e7eb)",
                borderRadius: "8px", fontSize: "11px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[110px]">
          <div className="w-16 h-16 rounded-full border-4 border-dashed border-border flex items-center justify-center">
            <BarChart3 size={16} className="text-muted-foreground/40" />
          </div>
        </div>
      )}

      {/* Table — one row per ticker, B&H + active pot */}
      <div className="px-4 pb-4 flex-1">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-2 text-center">No positions yet</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-1.5 font-medium text-muted-foreground">Stock</th>
                <th className="text-right pb-1.5 font-medium" style={{ color: "#c4503a" }}>B&H</th>
                <th className="text-right pb-1.5 font-medium" style={{ color: viewDef?.color }}>
                  {viewDef?.short}
                </th>
                <th className="text-right pb-1.5 font-medium text-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ticker, bh, active }) => {
                const bhPct  = bh     ? Number(bh.weight)     : 0;
                const actPct = active ? Number(active.weight) : 0;
                const totPct = bhPct + actPct;
                return (
                  <tr key={ticker} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5 font-mono font-bold text-foreground">{ticker}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {bhPct  > 0 ? fmtPct(bhPct)  : <span className="opacity-25">—</span>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {actPct > 0 ? fmtPct(actPct) : <span className="opacity-25">—</span>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-semibold text-foreground">
                      {fmtTotal(totPct)}
                    </td>
                  </tr>
                );
              })}
              {rows.length > 1 && (
                <tr className="border-t-2 border-border">
                  <td className="pt-2 text-muted-foreground font-medium">Total</td>
                  <td className="pt-2 text-right tabular-nums text-muted-foreground">{fmtPct(bhTotal)}</td>
                  <td className="pt-2 text-right tabular-nums text-muted-foreground">{fmtPct(activeTotal)}</td>
                  <td className="pt-2 text-right tabular-nums font-bold text-foreground">{fmtTotal(totalAllocated)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Strategy Section ───────────────────────────────────────────────────────

function StrategySection({ stratDef, holdings, target, stocks, onAddHolding, onRemoveHolding, onUpdateWeight, onStockClick, isActive, totalCapital, displayCurrency, onExpand }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [addOpen, setAddOpen]         = useState(false);
  const [editHolding, setEditHolding] = useState(null);

  const total = sumWeights(holdings);
  const overAllocated = isActive && total > target + 0.01;
  const existingTickers = new Set(holdings.map((h) => h.ticker));
  const stockMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));

  return (
    <>
      <div className={cn(
        "bg-card border border-border rounded-xl overflow-hidden transition-opacity",
        stratDef.accentClass,
        !isActive && stratDef.key !== "buy_and_hold" && "opacity-55"
      )}>
        <div className="px-4 pt-4 pb-3 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">{stratDef.label}</h3>
              {stratDef.key !== "buy_and_hold" && (
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                )}>
                  {isActive ? "ACTIVE" : "DORMANT"}
                </span>
              )}
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-muted-foreground/60 hover:text-muted-foreground transition-colors relative"
              >
                <Info size={13} />
                {showTooltip && (
                  <div className="absolute left-0 top-5 z-20 w-52 p-2.5 rounded-lg bg-foreground text-background text-xs leading-relaxed shadow-lg">
                    {stratDef.description}
                  </div>
                )}
              </button>
              <Badge variant={overAllocated ? "danger" : "muted"} className="ml-auto text-[10px] font-mono">
                {total.toFixed(1)}% / {target}%
              </Badge>
              <button
                onClick={onExpand}
                title="Expand analytics"
                className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 ml-1"
              >
                <Maximize2 size={12} />
              </button>
            </div>
            {overAllocated && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-danger">
                <AlertTriangle size={11} />
                Over-allocated by {(total - target).toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <DonutChart holdings={holdings} target={target} />

        <div className="px-4 pb-1">
          {holdings.length === 0 && total < target - 0.01 ? (
            <p className="text-xs text-muted-foreground/60 italic py-2 text-center">No positions yet</p>
          ) : (
            <>
              {holdings.map((h) => (
                <HoldingRow
                  key={h.id} holding={h} strategy={stratDef.key}
                  stock={stockMap[h.ticker]}
                  onEdit={setEditHolding} onStockClick={onStockClick}
                  totalCapital={totalCapital} displayCurrency={displayCurrency}
                />
              ))}
              {target - total > 0.01 && (
                <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0">
                  <span className="font-mono text-sm font-bold text-muted-foreground/40 tracking-tight">Cash</span>
                  <span className="flex-1" />
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs font-medium text-muted-foreground/40 tabular-nums">{(target - total).toFixed(1)}%</span>
                    {totalCapital && (
                      <span className="text-[10px] text-muted-foreground/30 tabular-nums">
                        {fmtMoney((totalCapital * (target - total)) / 100, displayCurrency)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 pb-4 pt-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="w-full text-xs">
            <Plus size={12} /> Add Stock
          </Button>
        </div>
      </div>

      <AddHoldingModal
        open={addOpen} onClose={() => setAddOpen(false)}
        strategy={stratDef.key} target={target} stocks={stocks}
        existingTickers={existingTickers} onAdd={onAddHolding}
        totalCapital={totalCapital} displayCurrency={displayCurrency}
      />

      <EditHoldingDialog
        open={!!editHolding} onClose={() => setEditHolding(null)}
        holding={editHolding} strategy={stratDef.key} target={target}
        totalCapital={totalCapital} displayCurrency={displayCurrency}
        onSave={async (id, patch) => {
          await onUpdateWeight({ ...editHolding }, patch);
        }}
        onDelete={onRemoveHolding}
      />
    </>
  );
}

// ── Summary Bar ────────────────────────────────────────────────────────────

function SummaryBar({ holdings, activeMode, totalCapital, buyHoldPct, displayCurrency }) {
  const allHoldings = Object.values(holdings).flat();
  const totalPositions = allHoldings.length;
  const activePct = 100 - buyHoldPct;
  const isFortress = activeMode === "fortress";
  const sym = currencySymbol(displayCurrency);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Total Capital */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-1">Total Portfolio</p>
        {totalCapital ? (
          <p className="text-xl font-serif text-foreground">{sym}{Math.round(totalCapital).toLocaleString("en-GB")}</p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">Not set</p>
        )}
      </div>

      {/* Active Mode */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-1">Active Mode</p>
        <p className="text-sm font-semibold mb-1" style={{ color: isFortress ? "#5aabcc" : "#f4a636" }}>
          {isFortress ? "Fortress" : "Slingshot"}
        </p>
        <p className="text-[10px] text-muted-foreground">Set via Indicator tab</p>
      </div>

      {/* Allocation Split */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-1">Allocation</p>
        <p className="text-sm font-medium">
          <span className="text-brand">{buyHoldPct}%</span>
          <span className="text-muted-foreground mx-1">/</span>
          <span style={{ color: isFortress ? "#5aabcc" : "#f4a636" }}>{activePct}%</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">B&H / Active</p>
      </div>

      {/* Positions count */}
      <div className="bg-card border border-border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground mb-1">Positions</p>
        <p className="text-2xl font-serif text-foreground">{totalPositions}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">across all buckets</p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const {
    stocks, setStocks, holdings, setHoldings, addHolding, removeHolding, updateHoldingInStore,
    openFactSheet, indicatorLog, setIndicatorLog,
  } = usePortfolioStore();
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedStrategy, setExpandedStrategy] = useState(null);

  const [totalCapital, setTotalCapital] = useState(() =>
    Number(localStorage.getItem("pf_total_capital") || "0")
  );
  const [buyHoldPct, setBuyHoldPct] = useState(() =>
    Number(localStorage.getItem("pf_buy_hold_pct") ?? 40)
  );
  const [displayCurrency, setDisplayCurrencyState] = useState(getDisplayCurrency);

  // Sync currency from global header changes
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "display_currency") setDisplayCurrencyState(e.newValue || "GBP");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Derive active mode from latest indicator log entry
  const latestIndicator = indicatorLog.length > 0
    ? [...indicatorLog].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0]
    : null;
  const activeMode = (latestIndicator?.signal === "fortress" || latestIndicator?.signal === "slingshot")
    ? latestIndicator.signal
    : (localStorage.getItem("pf_active_mode") || "slingshot");

  useEffect(() => {
    const loadAll = async () => {
      if (stocks.length === 0) {
        const { data } = await fetchStocks();
        if (data) setStocks(data);
      }
      if (indicatorLog.length === 0) {
        const { data: iData } = await fetchIndicatorLog();
        if (iData) setIndicatorLog(iData);
      }
      const { data: hData, error } = await fetchHoldings();
      if (error) toast.error("Failed to load holdings: " + error.message);
      if (hData) {
        const grouped = { buy_and_hold: [], fortress: [], slingshot: [] };
        hData.forEach((h) => { if (grouped[h.strategy]) grouped[h.strategy].push(h); });
        setHoldings(grouped);
      }
      setLoading(false);
    };
    loadAll();
  }, []);

  const handleCapitalChange = (val) => {
    setTotalCapital(val);
    localStorage.setItem("pf_total_capital", String(val));
  };

  const handleBuyHoldPctChange = (val) => {
    setBuyHoldPct(val);
    localStorage.setItem("pf_buy_hold_pct", String(val));
  };

  const handleCurrencyChange = (code) => {
    persistCurrency(code);
    setDisplayCurrencyState(code);
    window.dispatchEvent(new StorageEvent("storage", { key: "display_currency", newValue: code }));
  };

  const handleAddHolding = async ({ ticker, weight, entry_date, strategy }) => {
    const { data, error } = await insertHolding({ ticker, weight, entry_date, strategy });
    if (error) { toast.error("Failed to add: " + error.message); return; }
    if (data) {
      addHolding(strategy, data);
      toast.success(`${ticker} added to ${STRATEGIES.find((s) => s.key === strategy)?.label}.`);
    }
  };

  const handleRemoveHolding = async (holding) => {
    const { error } = await deleteHolding(holding.id);
    if (error) { toast.error("Failed to remove: " + error.message); return; }
    removeHolding(holding.strategy, holding.id);
    toast.success(`${holding.ticker} removed.`);
  };

  const handleUpdateHolding = async (holding, patch) => {
    const { error } = await updateHolding(holding.id, patch);
    if (error) { toast.error("Failed to update holding."); return; }
    updateHoldingInStore(holding.strategy, holding.id, patch);
  };

  const activePct = 100 - buyHoldPct;
  const strategyTargets = {
    buy_and_hold: buyHoldPct,
    fortress: activePct,
    slingshot: activePct,
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="xl:w-72 shrink-0 h-80 bg-card border border-border rounded-xl animate-pulse" />
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  const noHoldings = Object.values(holdings).every((arr) => arr.length === 0);

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:gap-5">
      {/* ── Left sidebar ── */}
      <aside className="hidden lg:flex flex-col gap-1 w-44 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">Library</p>
        {stocks.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic px-1">No stocks — add some on the Stocks tab.</p>
        ) : (
          stocks.map((s) => (
            <button key={s.id} onClick={() => openFactSheet(s)}
              className="flex flex-col gap-0 px-2 py-1.5 rounded-lg text-left hover:bg-muted transition-colors group"
            >
              <span className="font-mono text-xs font-bold text-foreground group-hover:text-brand transition-colors">{s.ticker}</span>
              <span className="text-[10px] text-muted-foreground truncate leading-tight">{s.fact_sheet?.name || ""}</span>
            </button>
          ))
        )}
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">

        {/* Summary + settings button */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => exportPortfolioPdf({ holdings, stocks, totalCapital, activeMode, buyHoldPct, displayCurrency })}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <FileDown size={13} />
              Export PDF
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Settings size={13} />
              Settings
            </button>
          </div>
          <SummaryBar
            holdings={holdings}
            activeMode={activeMode}
            totalCapital={totalCapital}
            buyHoldPct={buyHoldPct}
            displayCurrency={displayCurrency}
          />
        </div>

        {noHoldings && stocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center bg-card border border-border rounded-xl">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center">
              <Briefcase size={22} className="text-brand" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No portfolio yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Add stocks on the Stocks tab first, then use "Add Stock" in each strategy section below.
            </p>
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-4 items-start">
          {/* Total Portfolio — left panel */}
          <div className="w-full xl:w-72 shrink-0">
            <TotalPortfolioSection
              holdings={holdings}
              totalCapital={totalCapital}
              displayCurrency={displayCurrency}
              activeMode={activeMode}
            />
          </div>

          {/* Strategy boxes — 3 columns */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
            {STRATEGIES.map((stratDef) => (
              <StrategySection
                key={stratDef.key}
                stratDef={stratDef}
                holdings={holdings[stratDef.key] || []}
                target={strategyTargets[stratDef.key]}
                stocks={stocks}
                onAddHolding={handleAddHolding}
                onRemoveHolding={handleRemoveHolding}
                onUpdateWeight={handleUpdateHolding}
                onStockClick={openFactSheet}
                isActive={stratDef.key === "buy_and_hold" || stratDef.key === activeMode}
                totalCapital={totalCapital}
                displayCurrency={displayCurrency}
                onExpand={() => setExpandedStrategy(stratDef.key)}
              />
            ))}
          </div>
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        totalCapital={totalCapital}
        onCapitalChange={handleCapitalChange}
        buyHoldPct={buyHoldPct}
        onBuyHoldPctChange={handleBuyHoldPctChange}
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      {expandedStrategy && (
        <PotExpandedModal
          open={true}
          onClose={() => setExpandedStrategy(null)}
          stratDef={STRATEGIES.find((s) => s.key === expandedStrategy)}
          holdings={holdings[expandedStrategy] || []}
          stocks={stocks}
          target={strategyTargets[expandedStrategy]}
          totalCapital={totalCapital}
          displayCurrency={displayCurrency}
          showEntryDate={true}
        />
      )}
    </div>
  );
}
