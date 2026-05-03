import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import {
  Plus, Save, Rocket, Trash2, Search, Sparkles, RefreshCw,
  LayoutGrid, X, AlertTriangle, BarChart3, Info, Copy,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "../../components/ui/dialog";
import { Input, FormField } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import usePortfolioStore from "../../stores/portfolioStore";
import {
  fetchStocks, fetchSandboxes, upsertSandbox, deleteSandbox, insertHolding,
} from "../../services/portfolioService";
import { volatilityVariant } from "../../components/portfolio/FactSheetModal";
import { currencySymbol, getDisplayCurrency } from "../../lib/currency";

// ── Constants ──────────────────────────────────────────────────────────────

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const STRATEGIES = [
  { key: "buy_and_hold", label: "Buy & Hold", color: "#c4503a", accentClass: "border-l-[3px] border-l-brand",        description: "Core long-term positions. Always-on allocation." },
  { key: "fortress",     label: "Fortress",   color: "#5aabcc", accentClass: "border-l-[3px] border-l-[#5aabcc]",    description: "Capital preservation & defensive positions." },
  { key: "slingshot",    label: "Slingshot",  color: "#f4a636", accentClass: "border-l-[3px] border-l-[#f4a636]",    description: "High-volatility plays, 90 trading day hold window." },
];

const CASH_COLOR = "#e5e7eb";
const CHART_COLORS = ["#c4503a", "#5aabcc", "#7bc47c", "#f4a636", "#9b5fc0", "#4a90d9", "#e07b54"];

// ── Helpers ────────────────────────────────────────────────────────────────

function sumWeights(holdings) {
  return holdings.reduce((s, h) => s + (Number(h.weight) || 0), 0);
}

function holdingsBySection(allHoldings) {
  const grouped = { buy_and_hold: [], fortress: [], slingshot: [] };
  allHoldings.forEach((h) => {
    const key = h.sectionOverride || "buy_and_hold";
    if (grouped[key]) grouped[key].push(h);
  });
  return grouped;
}

function makePairKey(a, b) { return [a, b].sort().join("-"); }
function today() { return new Date().toISOString().split("T")[0]; }
function newSandbox(name) { return { id: crypto.randomUUID(), name, holdings: [], correlations: {} }; }

// ── Donut Chart ────────────────────────────────────────────────────────────

function DonutChart({ holdings, showCashFor100 }) {
  const total = sumWeights(holdings);
  const cash = showCashFor100 ? Math.max(0, 100 - total) : 0;

  const data = [
    ...holdings.map((h, i) => ({
      name: h.ticker,
      value: Number(h.weight) || 0,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    ...(cash > 0.01 ? [{ name: "Cash", value: cash, fill: CASH_COLOR }] : []),
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
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
        <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={52}
          paddingAngle={data.length > 1 ? 2 : 0} dataKey="value" stroke="none">
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <Tooltip
          formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name]}
          contentStyle={{ background: "var(--color-card,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", fontSize: "12px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── New Sandbox Modal ──────────────────────────────────────────────────────

function NewSandboxModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setName(""); setTimeout(() => inputRef.current?.focus(), 60); } }, [open]);
  const handle = () => { const n = name.trim(); if (!n) return; onCreate(n); onClose(); };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}><DialogTitle>New Sandbox</DialogTitle></DialogHeader>
      <DialogBody>
        <FormField label="Sandbox Name">
          <Input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handle()} placeholder="e.g. Aggressive Growth Test" />
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="brand" size="sm" onClick={handle} disabled={!name.trim()}>Create</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ── Stock Picker ───────────────────────────────────────────────────────────

function StockPicker({ stocks, existingTickers, onAdd, placeholder = "Search & add stock…" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const available = stocks.filter((s) => {
    if (existingTickers.has(s.ticker)) return false;
    if (!query) return true;
    const q = query.toUpperCase();
    return s.ticker.includes(q) || (s.fact_sheet?.name || "").toUpperCase().includes(q);
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        (!inputRef.current || !inputRef.current.contains(e.target)) &&
        (!listRef.current || !listRef.current.contains(e.target))
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openDropdown = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(true);
  };

  const handleAdd = (stock) => { onAdd(stock); setQuery(""); setOpen(false); };

  const showList = open && dropPos && (available.length > 0 || query);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); openDropdown(); }}
          onFocus={openDropdown}
          placeholder={placeholder}
          className={cn(
            "w-full h-8 rounded-lg border border-input bg-background pl-8 pr-3 py-2",
            "text-xs text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          )}
        />
      </div>
      {showList && createPortal(
        <div
          ref={listRef}
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
        >
          {available.length > 0 ? available.map((s) => (
            <button key={s.id} onMouseDown={() => handleAdd(s)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted transition-colors">
              <span className="font-mono font-bold w-12 shrink-0 text-foreground">{s.ticker}</span>
              <span className="text-muted-foreground truncate flex-1">{s.fact_sheet?.name || ""}</span>
              {s.fact_sheet?.volatilityTier && (
                <Badge variant={volatilityVariant(s.fact_sheet.volatilityTier)} className="text-[10px] py-0 shrink-0">
                  {s.fact_sheet.volatilityTier}
                </Badge>
              )}
            </button>
          )) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">No matching stocks in library.</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Sandbox Holding Row ────────────────────────────────────────────────────

function SandboxHoldingRow({ holding, stock, onWeightChange, onSectionChange, onRemove, onStockClick }) {
  const section = holding.sectionOverride || "buy_and_hold";

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0 group">
      <button
        onClick={() => stock && onStockClick(stock)}
        className={cn("font-mono text-sm font-bold text-foreground tracking-tight",
          stock ? "hover:text-brand transition-colors cursor-pointer" : "cursor-default")}
      >
        {holding.ticker}
      </button>

      {/* Section dot-switcher */}
      <div className="flex gap-1 shrink-0">
        {STRATEGIES.map((s) => (
          <button
            key={s.key}
            onClick={() => onSectionChange(holding.ticker, s.key)}
            title={s.label}
            className={cn(
              "w-2.5 h-2.5 rounded-full border-2 transition-all",
              section === s.key ? "scale-125 border-transparent" : "opacity-30 hover:opacity-70 border-transparent"
            )}
            style={{ background: s.color }}
          />
        ))}
      </div>

      <span className="flex-1 text-xs text-muted-foreground truncate hidden sm:block">
        {stock?.fact_sheet?.name || ""}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number" min={0} max={100} step={0.1}
          value={holding.weight}
          onChange={(e) => onWeightChange(holding.ticker, e.target.value)}
          className={cn(
            "w-16 h-7 rounded-md border border-input bg-background px-2",
            "text-xs font-mono text-right text-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring"
          )}
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>

      <button
        onClick={() => onRemove(holding.ticker)}
        className="text-muted-foreground/30 hover:text-danger transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── Sandbox Section Card ───────────────────────────────────────────────────

function SandboxSection({ stratDef, holdings, allStocks, existingTickers, onAddStock, onWeightChange, onSectionChange, onRemove, onStockClick }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const total = sumWeights(holdings);
  const overSection = total > 100.01;

  return (
    <div className={cn("bg-card border border-border rounded-xl", stratDef.accentClass)}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground">{stratDef.label}</h3>
          <button
            onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}
            className="text-muted-foreground/60 hover:text-muted-foreground transition-colors relative"
          >
            <Info size={13} />
            {showTooltip && (
              <div className="absolute left-0 top-5 z-20 w-48 p-2.5 rounded-lg bg-foreground text-background text-xs leading-relaxed shadow-lg">
                {stratDef.description}
              </div>
            )}
          </button>
          <Badge variant={overSection ? "danger" : "muted"} className="ml-auto text-[10px] font-mono">
            {total.toFixed(1)}%
          </Badge>
        </div>
        {overSection && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-danger">
            <AlertTriangle size={11} /> Section exceeds 100%
          </div>
        )}
      </div>

      <DonutChart holdings={holdings} showCashFor100={false} />

      <div className="px-4 pb-1">
        {holdings.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-2 text-center">No positions</p>
        ) : (
          holdings.map((h) => (
            <SandboxHoldingRow
              key={h.ticker} holding={h}
              stock={allStocks.find((s) => s.ticker === h.ticker)}
              onWeightChange={onWeightChange} onSectionChange={onSectionChange}
              onRemove={onRemove} onStockClick={onStockClick}
            />
          ))
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        <StockPicker
          stocks={allStocks}
          existingTickers={existingTickers}
          onAdd={(stock) => onAddStock(stock, stratDef.key)}
          placeholder={`Add to ${stratDef.label}…`}
        />
      </div>
    </div>
  );
}

// ── Sandbox Summary Panel ──────────────────────────────────────────────────

function SandboxSummaryPanel({ sandbox, totalWeight, onSave, onPromote, saving, promoting, onAutoDistribute }) {
  const cash = Math.max(0, 100 - totalWeight);
  const overAllocated = totalWeight > 100.01;
  const grouped = holdingsBySection(sandbox.holdings);

  const donutData = STRATEGIES.map((s) => ({
    name: s.label, value: sumWeights(grouped[s.key] || []), fill: s.color,
  })).filter((d) => d.value > 0);
  if (cash > 0.01) donutData.push({ name: "Cash", value: cash, fill: CASH_COLOR });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden border-l-[3px] border-l-foreground/20 flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground truncate">{sandbox.name}</h3>
          <Badge variant={overAllocated ? "danger" : cash < 0.01 ? "success" : "muted"} className="text-[10px] font-mono shrink-0">
            {totalWeight.toFixed(1)}% / 100%
          </Badge>
        </div>

        {overAllocated && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-danger">
            <AlertTriangle size={11} />
            Over by {(totalWeight - 100).toFixed(1)}% — fix before promoting
          </div>
        )}
        {!overAllocated && cash > 0.01 && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{cash.toFixed(1)}%</span> Cash remaining
          </p>
        )}

        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={onSave} disabled={saving} className="flex-1">
            <Save size={12} />
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="brand" size="sm" onClick={onPromote}
            disabled={promoting || sandbox.holdings.length === 0 || overAllocated}
            className="flex-1"
            title={overAllocated ? "Fix over-allocation before promoting" : ""}
          >
            <Rocket size={12} />
            {promoting ? "Promoting…" : "Promote"}
          </Button>
        </div>

        {sandbox.holdings.length > 0 && (
          <button
            onClick={onAutoDistribute}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <RefreshCw size={11} /> Auto-distribute evenly
          </button>
        )}
      </div>

      {donutData.length > 0 ? (
        <ResponsiveContainer width="100%" height={110}>
          <PieChart>
            <Pie data={donutData} cx="50%" cy="50%" innerRadius={28} outerRadius={46}
              paddingAngle={donutData.length > 1 ? 2 : 0} dataKey="value" stroke="none">
              {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip
              formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name]}
              contentStyle={{ background: "var(--color-card,#fff)", border: "1px solid var(--color-border,#e5e7eb)", borderRadius: "8px", fontSize: "11px" }}
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

      <div className="px-4 pb-4 flex-1">
        {sandbox.holdings.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-2 text-center">No positions yet</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-1.5 font-medium text-muted-foreground">Stock</th>
                <th className="text-left pb-1.5 font-medium text-muted-foreground">Section</th>
                <th className="text-right pb-1.5 font-medium text-foreground">Weight</th>
              </tr>
            </thead>
            <tbody>
              {sandbox.holdings.map((h) => {
                const section = h.sectionOverride || "buy_and_hold";
                const s = STRATEGIES.find((x) => x.key === section);
                return (
                  <tr key={h.ticker} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5 font-mono font-bold text-foreground">{h.ticker}</td>
                    <td className="py-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: s?.color + "22", color: s?.color }}>
                        {s?.label}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-semibold text-foreground">
                      {Number(h.weight).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              {cash > 0.01 && (
                <tr className="border-t border-border">
                  <td className="pt-1.5 font-medium text-muted-foreground/50" colSpan={2}>Cash</td>
                  <td className="pt-1.5 text-right tabular-nums font-semibold text-muted-foreground/50">
                    {cash.toFixed(1)}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Correlation Matrix ─────────────────────────────────────────────────────

function CorrelationMatrix({ holdings, correlations, onAnalyse, analysing }) {
  const tickers = holdings.map((h) => h.ticker);
  if (tickers.length < 2) return (
    <p className="text-xs text-muted-foreground/60 italic text-center py-4">
      Add at least 2 stocks to analyse correlations.
    </p>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Correlation Matrix</h4>
        <Button variant="outline" size="sm" onClick={onAnalyse} disabled={analysing} className="text-xs h-7">
          <Sparkles size={11} className={analysing ? "animate-pulse text-brand" : ""} />
          {analysing ? "Analysing…" : "Analyse"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `5rem repeat(${tickers.length}, minmax(0, 1fr))` }}>
          <div className="h-7" />
          {tickers.map((t) => (
            <div key={t} className="h-7 flex items-center justify-center">
              <span className="font-mono text-[10px] font-bold text-muted-foreground">{t}</span>
            </div>
          ))}
          {tickers.map((rowTicker, ri) => (
            <div key={rowTicker} className="contents">
              <div className="h-10 flex items-center">
                <span className="font-mono text-[10px] font-bold text-muted-foreground">{rowTicker}</span>
              </div>
              {tickers.map((colTicker, ci) => {
                if (ri === ci) return (
                  <div key={colTicker} className="h-10 rounded-lg bg-muted/60 flex items-center justify-center">
                    <span className="text-[9px] font-mono font-bold text-muted-foreground">—</span>
                  </div>
                );
                const key = makePairKey(rowTicker, colTicker);
                const data = correlations[key];
                const score = data?.score ?? null;
                const opacity = score !== null ? 0.1 + score * 0.65 : 0;
                return (
                  <div key={colTicker}
                    className="h-10 rounded-lg border border-border/40 flex items-center justify-center cursor-default relative group"
                    style={score !== null ? { background: `rgba(196,80,58,${opacity})` } : {}}
                    title={data?.sentence || "Click Analyse to compute"}
                  >
                    {analysing && !data
                      ? <div className="w-3 h-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                      : score !== null
                      ? <span className="text-[10px] font-mono font-bold text-foreground">{score.toFixed(2)}</span>
                      : <span className="text-[9px] text-muted-foreground/40">?</span>
                    }
                    {data?.sentence && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 hidden group-hover:block w-52 bg-foreground text-background text-[10px] leading-relaxed p-2 rounded-lg shadow-lg pointer-events-none">
                        {data.sentence}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
            <div key={v} className="w-4 h-2 rounded-sm" style={{ background: `rgba(196,80,58,${v})` }} />
          ))}
        </div>
        <span>low → high correlation</span>
      </div>
    </div>
  );
}

// ── Promote Modal ──────────────────────────────────────────────────────────

function PromoteModal({ open, onClose, sandbox, stocks, onConfirm, promoting }) {
  const stockMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));
  const [sections, setSections] = useState({});

  useEffect(() => {
    if (open) {
      const init = {};
      sandbox.holdings.forEach((h) => { init[h.ticker] = h.sectionOverride || "buy_and_hold"; });
      setSections(init);
    }
  }, [open, sandbox.holdings]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}><DialogTitle>Promote to Portfolio</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Confirm the strategy section for each holding. Entry date will be set to today.
        </p>
        <div>
          {sandbox.holdings.map((h) => {
            const s = STRATEGIES.find((x) => x.key === (sections[h.ticker] || "buy_and_hold"));
            return (
              <div key={h.ticker} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                <span className="font-mono font-bold text-sm text-foreground w-14 shrink-0">{h.ticker}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{stockMap[h.ticker]?.fact_sheet?.name || ""}</span>
                <span className="text-xs font-mono text-foreground shrink-0">{h.weight}%</span>
                <select
                  value={sections[h.ticker] || "buy_and_hold"}
                  onChange={(e) => setSections((prev) => ({ ...prev, [h.ticker]: e.target.value }))}
                  className="h-7 rounded-md border border-input bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
                  style={{ color: s?.color }}
                >
                  {STRATEGIES.map((x) => (
                    <option key={x.key} value={x.key} style={{ color: x.color }}>{x.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={promoting}>Cancel</Button>
        <Button variant="brand" size="sm" onClick={() => onConfirm(sections)} disabled={promoting || sandbox.holdings.length === 0}>
          <Rocket size={13} />
          {promoting ? "Promoting…" : "Confirm & Promote"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const { stocks, setStocks, sandboxes, setSandboxes, saveSandbox: saveSandboxStore, addHolding, openFactSheet } = usePortfolioStore();
  const [loading, setLoading]         = useState(true);
  const [activeSandbox, setActiveSandbox] = useState(null);
  const [newOpen, setNewOpen]         = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoting, setPromoting]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [analysing, setAnalysing]     = useState(false);
  const [displayCurrency]             = useState(getDisplayCurrency);

  useEffect(() => {
    const load = async () => {
      const [stockRes, sandboxRes] = await Promise.all([
        stocks.length === 0 ? fetchStocks() : Promise.resolve({ data: stocks }),
        fetchSandboxes(),
      ]);
      if (stockRes.data) setStocks(stockRes.data);
      if (sandboxRes.data) setSandboxes(sandboxRes.data);
      setLoading(false);
    };
    load();
  }, []);

  // ── Sandbox CRUD ──

  const handleCreate = (name) => setActiveSandbox(newSandbox(name));

  const handleLoad = (sb) =>
    setActiveSandbox({ id: sb.id, name: sb.name, holdings: sb.holdings || [], correlations: sb.correlations || {} });

  const handleSave = async () => {
    if (!activeSandbox) return;
    setSaving(true);
    const { data, error } = await upsertSandbox({
      id: activeSandbox.id, name: activeSandbox.name,
      holdings: activeSandbox.holdings, correlations: activeSandbox.correlations,
    });
    setSaving(false);
    if (error) { toast.error("Failed to save: " + error.message); return; }
    if (data) {
      saveSandboxStore(data);
      setActiveSandbox((s) => ({ ...s, id: data.id }));
      toast.success(`"${activeSandbox.name}" saved.`);
    }
  };

  const handleDeleteSandbox = async (sb) => {
    await deleteSandbox(sb.id);
    setSandboxes(sandboxes.filter((s) => s.id !== sb.id));
    if (activeSandbox?.id === sb.id) setActiveSandbox(null);
    toast.success("Sandbox deleted.");
  };

  const handleClone = async (sb, e) => {
    e.stopPropagation();
    const cloned = {
      id: crypto.randomUUID(),
      name: sb.name + " (Copy)",
      holdings: (sb.holdings || []).map((h) => ({ ...h })),
      correlations: { ...(sb.correlations || {}) },
    };
    const { data, error } = await upsertSandbox({
      id: cloned.id, name: cloned.name,
      holdings: cloned.holdings, correlations: cloned.correlations,
    });
    if (error) { toast.error("Failed to clone: " + error.message); return; }
    if (data) {
      saveSandboxStore(data);
      setActiveSandbox({ id: data.id, name: data.name, holdings: data.holdings || [], correlations: data.correlations || {} });
      toast.success(`Cloned to "${data.name}".`);
    }
  };

  // ── Holdings mutations ──

  const addStockToSandbox = (stock, sectionKey) => {
    setActiveSandbox((s) => ({
      ...s,
      holdings: [...s.holdings, { ticker: stock.ticker, weight: 0, sectionOverride: sectionKey }],
    }));
  };

  const updateWeight = (ticker, value) => {
    setActiveSandbox((s) => ({
      ...s,
      holdings: s.holdings.map((h) =>
        h.ticker === ticker ? { ...h, weight: value === "" ? "" : Number(value) } : h
      ),
    }));
  };

  const updateSection = (ticker, section) => {
    setActiveSandbox((s) => ({
      ...s,
      holdings: s.holdings.map((h) => h.ticker === ticker ? { ...h, sectionOverride: section } : h),
    }));
  };

  const removeFromSandbox = (ticker) => {
    setActiveSandbox((s) => ({ ...s, holdings: s.holdings.filter((h) => h.ticker !== ticker) }));
  };

  const autoDistribute = () => {
    if (!activeSandbox || activeSandbox.holdings.length === 0) return;
    const n = activeSandbox.holdings.length;
    const equal = parseFloat((100 / n).toFixed(1));
    setActiveSandbox((s) => ({
      ...s,
      holdings: s.holdings.map((h, i) => ({
        ...h,
        weight: i < n - 1 ? equal : parseFloat((100 - equal * (n - 1)).toFixed(1)),
      })),
    }));
  };

  // ── Correlations ──

  const analyseCorrelations = async () => {
    if (!activeSandbox || activeSandbox.holdings.length < 2) return;
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) { toast.error("VITE_ANTHROPIC_API_KEY is not configured."); return; }

    const tickers = activeSandbox.holdings.map((h) => h.ticker);
    const pairs = [];
    for (let i = 0; i < tickers.length; i++)
      for (let j = i + 1; j < tickers.length; j++)
        pairs.push([tickers[i], tickers[j]]);

    setAnalysing(true);
    const results = await Promise.all(pairs.map(async ([a, b]) => {
      const key = makePairKey(a, b);
      if (activeSandbox.correlations[key]) return [key, activeSandbox.correlations[key]];
      try {
        const res = await fetch(ANTHROPIC_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 256,
            system: 'You are a financial analyst. Return ONLY a JSON object with no markdown: { "sentence": "one sentence describing typical return correlation", "score": 0.0 } where score is 0.0 (uncorrelated/negative) to 1.0 (highly positive correlation).',
            messages: [{ role: "user", content: `Describe the typical return correlation between ${a} and ${b} stocks` }],
          }),
        });
        if (!res.ok) return [key, null];
        const data = await res.json();
        const text = (data.content?.[0]?.text || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return [key, null];
        return [key, JSON.parse(match[0])];
      } catch { return [key, null]; }
    }));

    setActiveSandbox((s) => {
      const updated = { ...s.correlations };
      results.forEach(([key, val]) => { if (val) updated[key] = val; });
      return { ...s, correlations: updated };
    });
    setAnalysing(false);
    toast.success("Correlation analysis complete.");
  };

  // ── Promote ──

  const handlePromote = async (sectionMap) => {
    if (!activeSandbox) return;
    setPromoting(true);
    let errors = 0;
    for (const h of activeSandbox.holdings) {
      const strategy = sectionMap[h.ticker] || "buy_and_hold";
      const { data, error } = await insertHolding({
        ticker: h.ticker, weight: Number(h.weight) || 0, entry_date: today(), strategy,
      });
      if (error) errors++;
      else if (data) addHolding(strategy, data);
    }
    setPromoting(false);
    setPromoteOpen(false);
    if (errors > 0) toast.error(`${errors} holding(s) failed to promote.`);
    else toast.success(`${activeSandbox.holdings.length} position(s) promoted to portfolio.`);
  };

  // ── Derived ──

  const totalWeight = activeSandbox
    ? activeSandbox.holdings.reduce((s, h) => s + (Number(h.weight) || 0), 0)
    : 0;
  const overAllocated = totalWeight > 100.01;
  const existingTickers = new Set(activeSandbox?.holdings.map((h) => h.ticker) || []);
  const grouped = activeSandbox ? holdingsBySection(activeSandbox.holdings) : {};

  if (loading) {
    return (
      <div className="flex gap-4">
        <div className="w-44 shrink-0 flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
        <div className="w-72 shrink-0 h-80 bg-card border border-border rounded-xl animate-pulse" />
        <div className="flex-1 grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-5 items-start">
      {/* ── Saved sandboxes sidebar ── */}
      <aside className="w-44 shrink-0 flex flex-col gap-2">
        <Button variant="brand" size="sm" onClick={() => setNewOpen(true)} className="w-full">
          <Plus size={13} /> New Sandbox
        </Button>

        {sandboxes.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic px-1 mt-2">No saved sandboxes yet.</p>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mt-1">Saved</p>
            {sandboxes.map((sb) => (
              <div
                key={sb.id}
                onClick={() => handleLoad(sb)}
                className={cn(
                  "group flex items-center gap-1.5 rounded-lg border px-2.5 py-2 cursor-pointer transition-all",
                  activeSandbox?.id === sb.id
                    ? "border-brand/40 bg-brand/5"
                    : "border-border hover:border-border/80 hover:bg-muted/40"
                )}
              >
                <LayoutGrid size={11} className={cn("shrink-0", activeSandbox?.id === sb.id ? "text-brand" : "text-muted-foreground/60")} />
                <span className={cn("text-xs flex-1 truncate", activeSandbox?.id === sb.id ? "text-brand font-medium" : "text-foreground")}>
                  {sb.name}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => handleClone(sb, e)}
                    title="Clone sandbox"
                    className="text-muted-foreground/40 hover:text-brand transition-colors p-0.5"
                  >
                    <Copy size={10} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSandbox(sb); }}
                    className="text-muted-foreground/40 hover:text-danger transition-colors p-0.5"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </aside>

      {/* ── Main area ── */}
      {!activeSandbox ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
            <Sparkles size={26} className="text-brand" />
          </div>
          <h2 className="text-base font-semibold text-foreground">No sandbox loaded</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Create a new sandbox to test hypothetical allocations, or load a saved one.
          </p>
          <Button variant="brand" size="sm" onClick={() => setNewOpen(true)}>
            <Plus size={13} /> New Sandbox
          </Button>
        </div>
      ) : (
        <>
          {/* Summary panel */}
          <div className="w-72 shrink-0">
            <SandboxSummaryPanel
              sandbox={activeSandbox}
              totalWeight={totalWeight}
              onSave={handleSave}
              onPromote={() => setPromoteOpen(true)}
              saving={saving}
              promoting={promoting}
              onAutoDistribute={autoDistribute}
            />
          </div>

          {/* Section cards + correlation */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {STRATEGIES.map((stratDef) => (
                <SandboxSection
                  key={stratDef.key}
                  stratDef={stratDef}
                  holdings={grouped[stratDef.key] || []}
                  allStocks={stocks}
                  existingTickers={existingTickers}
                  onAddStock={addStockToSandbox}
                  onWeightChange={updateWeight}
                  onSectionChange={updateSection}
                  onRemove={removeFromSandbox}
                  onStockClick={openFactSheet}
                />
              ))}
            </div>

            {activeSandbox.holdings.length >= 2 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <CorrelationMatrix
                  holdings={activeSandbox.holdings}
                  correlations={activeSandbox.correlations}
                  onAnalyse={analyseCorrelations}
                  analysing={analysing}
                />
              </div>
            )}
          </div>
        </>
      )}

      <NewSandboxModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={handleCreate} />
      {activeSandbox && (
        <PromoteModal
          open={promoteOpen} onClose={() => setPromoteOpen(false)}
          sandbox={activeSandbox} stocks={stocks}
          onConfirm={handlePromote} promoting={promoting}
        />
      )}
    </div>
  );
}
