import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  Plus, Save, Rocket, Trash2, Search, Sparkles, RefreshCw,
  LayoutGrid, X, ChevronsRight, ChevronDown,
} from "lucide-react";
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

// ── Constants ──────────────────────────────────────────────────────────────

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const SECTION_LABELS = {
  buy_and_hold: "Buy & Hold",
  fortress:     "Fortress",
  slingshot:    "Slingshot",
};

const SECTION_COLORS = {
  buy_and_hold: "#c4503a",
  fortress:     "#5aabcc",
  slingshot:    "#f4a636",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function suggestSection(volatilityTier) {
  if (volatilityTier === "low")    return "buy_and_hold";
  if (volatilityTier === "medium") return "fortress";
  if (volatilityTier === "high")   return "slingshot";
  return "buy_and_hold";
}

function makePairKey(a, b) {
  return [a, b].sort().join("-");
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function newSandbox(name) {
  return {
    id: crypto.randomUUID(),
    name,
    holdings:     [],
    correlations: {},
  };
}

// ── New Sandbox Modal ──────────────────────────────────────────────────────

function NewSandboxModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setName(""); setTimeout(() => inputRef.current?.focus(), 60); }
  }, [open]);

  const handleCreate = () => {
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}><DialogTitle>New Sandbox</DialogTitle></DialogHeader>
      <DialogBody>
        <FormField label="Sandbox Name">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Aggressive Growth Test"
          />
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="brand" size="sm" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ── Stock Picker ───────────────────────────────────────────────────────────

function StockPicker({ stocks, existingTickers, onAdd }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const available = stocks.filter((s) => {
    if (existingTickers.has(s.ticker)) return false;
    if (!query) return true;
    const q = query.toUpperCase();
    return s.ticker.includes(q) || (s.fact_sheet?.name || "").toUpperCase().includes(q);
  });

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAdd = (stock) => {
    onAdd(stock);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search stock library…"
          className={cn(
            "w-full h-8 rounded-lg border border-input bg-background pl-8 pr-3 py-2",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          )}
        />
      </div>

      {open && available.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {available.map((s) => (
            <button
              key={s.id}
              onMouseDown={() => handleAdd(s)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
            >
              <span className="font-mono font-bold w-14 shrink-0 text-foreground">{s.ticker}</span>
              <span className="text-muted-foreground text-xs truncate flex-1">{s.fact_sheet?.name || ""}</span>
              {s.fact_sheet?.volatilityTier && (
                <Badge variant={volatilityVariant(s.fact_sheet.volatilityTier)} className="text-[10px] py-0 shrink-0">
                  {s.fact_sheet.volatilityTier}
                </Badge>
              )}
              <Plus size={12} className="text-muted-foreground/50 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {open && available.length === 0 && query && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-card border border-border rounded-xl shadow-xl px-3 py-2 text-xs text-muted-foreground">
          No matching stocks in library.
        </div>
      )}
    </div>
  );
}

// ── Holding Row ────────────────────────────────────────────────────────────

function HoldingRow({ holding, stock, onWeightChange, onSectionChange, onRemove, onStockClick }) {
  const fs = stock?.fact_sheet || {};
  const effectiveSection = holding.sectionOverride || suggestSection(fs.volatilityTier);

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0 group">
      <button
        onClick={() => stock && onStockClick(stock)}
        className="font-mono text-sm font-bold text-foreground hover:text-brand transition-colors w-16 shrink-0 text-left"
        title={fs.name}
      >
        {holding.ticker}
      </button>

      {fs.volatilityTier && (
        <Badge variant={volatilityVariant(fs.volatilityTier)} className="text-[10px] py-0 shrink-0 hidden sm:inline-flex">
          {fs.volatilityTier}
        </Badge>
      )}

      <div className="flex-1 min-w-0">
        <select
          value={effectiveSection}
          onChange={(e) => onSectionChange(holding.ticker, e.target.value)}
          className={cn(
            "w-full h-7 rounded-md border border-input bg-background text-xs px-2",
            "focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
          )}
          style={{ color: SECTION_COLORS[effectiveSection] }}
        >
          {Object.entries(SECTION_LABELS).map(([k, v]) => (
            <option key={k} value={k} style={{ color: SECTION_COLORS[k] }}>{v}</option>
          ))}
        </select>
        {!holding.sectionOverride && (
          <p className="text-[9px] text-muted-foreground/60 mt-0.5 leading-none">suggested</p>
        )}
      </div>

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

// ── Strategy Overlay ───────────────────────────────────────────────────────

function StrategyOverlay({ holdings, stocks }) {
  if (holdings.length === 0) return null;
  const stockMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));
  const sectionTotals = { buy_and_hold: 0, fortress: 0, slingshot: 0 };
  holdings.forEach((h) => {
    const stock = stockMap[h.ticker];
    const section = h.sectionOverride || suggestSection(stock?.fact_sheet?.volatilityTier);
    sectionTotals[section] = (sectionTotals[section] || 0) + (Number(h.weight) || 0);
  });
  const total = Object.values(sectionTotals).reduce((s, v) => s + v, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Strategy Breakdown</h4>
      <div className="w-full h-3 rounded-full overflow-hidden flex mb-3">
        {Object.entries(sectionTotals).map(([key, val]) =>
          val > 0 && (
            <div key={key} className="h-full transition-all duration-300"
              style={{ width: total > 0 ? `${(val / total) * 100}%` : "0%", background: SECTION_COLORS[key] }}
              title={`${SECTION_LABELS[key]}: ${val.toFixed(1)}%`}
            />
          )
        )}
        {total === 0 && <div className="h-full w-full bg-muted rounded-full" />}
      </div>
      <div className="flex gap-4 flex-wrap text-xs">
        {Object.entries(sectionTotals).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: SECTION_COLORS[key] }} />
            <span className="text-muted-foreground">{SECTION_LABELS[key]}</span>
            <span className="font-mono font-semibold text-foreground">{val.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Correlation Matrix ─────────────────────────────────────────────────────

function CorrelationMatrix({ holdings, correlations, onAnalyse, analysing }) {
  const tickers = holdings.map((h) => h.ticker);
  if (tickers.length < 2) {
    return (
      <div className="text-xs text-muted-foreground/60 italic text-center py-4">
        Add at least 2 stocks to analyse correlations.
      </div>
    );
  }

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
            <>
              <div key={rowTicker + "_label"} className="h-10 flex items-center">
                <span className="font-mono text-[10px] font-bold text-muted-foreground">{rowTicker}</span>
              </div>
              {tickers.map((colTicker, ci) => {
                if (ri === ci) {
                  return (
                    <div key={colTicker} className="h-10 rounded-lg bg-muted/60 flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold text-muted-foreground">—</span>
                    </div>
                  );
                }
                const key = makePairKey(rowTicker, colTicker);
                const data = correlations[key];
                const score = data?.score ?? null;
                const opacity = score !== null ? 0.1 + score * 0.65 : 0;
                return (
                  <div
                    key={colTicker}
                    className="h-10 rounded-lg border border-border/40 flex items-center justify-center cursor-default relative group"
                    style={score !== null ? { background: `rgba(196, 80, 58, ${opacity})` } : {}}
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
            </>
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
      sandbox.holdings.forEach((h) => {
        const stock = stockMap[h.ticker];
        init[h.ticker] = h.sectionOverride || suggestSection(stock?.fact_sheet?.volatilityTier);
      });
      setSections(init);
    }
  }, [open, sandbox.holdings]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}><DialogTitle>Promote to Portfolio</DialogTitle></DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Confirm which strategy section each stock will be added to. Entry date will be set to today.
        </p>
        <div className="flex flex-col gap-0">
          {sandbox.holdings.map((h) => (
            <div key={h.ticker} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
              <span className="font-mono font-bold text-sm text-foreground w-14 shrink-0">{h.ticker}</span>
              <span className="text-xs text-muted-foreground flex-1 truncate">{stockMap[h.ticker]?.fact_sheet?.name || ""}</span>
              <span className="text-xs font-mono text-foreground shrink-0">{h.weight}%</span>
              <select
                value={sections[h.ticker] || "buy_and_hold"}
                onChange={(e) => setSections((s) => ({ ...s, [h.ticker]: e.target.value }))}
                className="h-7 rounded-md border border-input bg-background text-xs px-2 focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
                style={{ color: SECTION_COLORS[sections[h.ticker]] }}
              >
                {Object.entries(SECTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k} style={{ color: SECTION_COLORS[k] }}>{v}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {Object.entries(SECTION_LABELS).map(([key, label]) => {
            const items = sandbox.holdings.filter((h) => (sections[h.ticker] || "buy_and_hold") === key);
            return (
              <div key={key} className="bg-background border border-border rounded-lg px-3 py-2">
                <p className="font-medium" style={{ color: SECTION_COLORS[key] }}>{label}</p>
                <p className="text-muted-foreground">{items.length} stock{items.length !== 1 ? "s" : ""}</p>
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
  const [loading, setLoading] = useState(true);
  const [activeSandbox, setActiveSandbox] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  // On mobile, collapse sidebar once a sandbox is loaded/created
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  // ── Sandbox mutations ──

  const handleCreate = (name) => {
    setActiveSandbox(newSandbox(name));
    setSidebarOpen(false); // focus editor on mobile
  };

  const handleLoad = (sb) => {
    setActiveSandbox({ id: sb.id, name: sb.name, holdings: sb.holdings || [], correlations: sb.correlations || {} });
    setSidebarOpen(false);
  };

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

  // ── Holdings mutations ──

  const addStockToSandbox = (stock) => {
    setActiveSandbox((s) => ({
      ...s,
      holdings: [...s.holdings, { ticker: stock.ticker, weight: 0, sectionOverride: null }],
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
      holdings: s.holdings.map((h) =>
        h.ticker === ticker ? { ...h, sectionOverride: section } : h
      ),
    }));
  };

  const removeFromSandbox = (ticker) => {
    setActiveSandbox((s) => ({ ...s, holdings: s.holdings.filter((h) => h.ticker !== ticker) }));
  };

  const autoDistribute = () => {
    if (!activeSandbox || activeSandbox.holdings.length === 0) return;
    const equal = parseFloat((100 / activeSandbox.holdings.length).toFixed(1));
    setActiveSandbox((s) => ({
      ...s,
      holdings: s.holdings.map((h, i) => ({
        ...h,
        weight: i < s.holdings.length - 1
          ? equal
          : parseFloat((100 - equal * (s.holdings.length - 1)).toFixed(1)),
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
    const results = await Promise.all(
      pairs.map(async ([a, b]) => {
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
              messages: [{ role: "user", content: `In one sentence, describe the typical return correlation between ${a} and ${b} stocks` }],
            }),
          });
          if (!res.ok) return [key, null];
          const data = await res.json();
          const text = (data.content?.[0]?.text || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
          const match = text.match(/\{[\s\S]*\}/);
          if (!match) return [key, null];
          return [key, JSON.parse(match[0])];
        } catch {
          return [key, null];
        }
      })
    );
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
      if (error) { errors++; }
      else if (data) { addHolding(strategy, data); }
    }
    setPromoting(false);
    setPromoteOpen(false);
    if (errors > 0) {
      toast.error(`${errors} holding(s) failed to promote.`);
    } else {
      toast.success(`${activeSandbox.holdings.length} position(s) promoted to portfolio.`);
    }
  };

  // ── Derived ──

  const totalWeight = activeSandbox
    ? activeSandbox.holdings.reduce((s, h) => s + (Number(h.weight) || 0), 0)
    : 0;
  const weightOk = Math.abs(totalWeight - 100) < 0.1;
  const existingTickers = new Set(activeSandbox?.holdings.map((h) => h.ticker) || []);
  const stockMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));

  if (loading) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full sm:w-48 shrink-0 flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
        <div className="flex-1 h-80 bg-card border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-4">
      {/* ── Sidebar: saved sandboxes ──
          On mobile: collapsible; on sm+: always visible */}
      <aside className={cn(
        "shrink-0 flex flex-col gap-2",
        "sm:w-48 lg:w-56",
        // Mobile: show as collapsed bar when a sandbox is active
        !sidebarOpen && activeSandbox ? "hidden sm:flex" : "flex"
      )}>
        <Button variant="brand" size="sm" onClick={() => setNewOpen(true)} className="w-full">
          <Plus size={13} />
          New Sandbox
        </Button>

        {sandboxes.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic px-1 mt-2">No saved sandboxes yet.</p>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mt-1">Saved</p>
            {sandboxes.map((sb) => (
              <div
                key={sb.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg border px-2.5 py-2 cursor-pointer transition-all",
                  activeSandbox?.id === sb.id
                    ? "border-brand/40 bg-brand/5"
                    : "border-border hover:border-border/80 hover:bg-muted/40"
                )}
                onClick={() => handleLoad(sb)}
              >
                <LayoutGrid size={11} className={cn("shrink-0", activeSandbox?.id === sb.id ? "text-brand" : "text-muted-foreground/60")} />
                <span className={cn("text-xs flex-1 truncate", activeSandbox?.id === sb.id ? "text-brand font-medium" : "text-foreground")}>
                  {sb.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSandbox(sb); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-danger transition-all"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </>
        )}
      </aside>

      {/* ── Editor ── */}
      <div className="flex-1 min-w-0">
        {!activeSandbox ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
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
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Back to sidebar on mobile */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="sm:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Show sandboxes"
              >
                <ChevronDown size={16} className="rotate-90" />
              </button>
              <h2 className="text-base font-semibold text-foreground flex-1 min-w-0 truncate">
                {activeSandbox.name}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                  <Save size={13} />
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="brand" size="sm" onClick={() => setPromoteOpen(true)} disabled={activeSandbox.holdings.length === 0}>
                  <Rocket size={13} />
                  Promote
                </Button>
              </div>
            </div>

            {/* Holdings card */}
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Holdings</h3>
                {activeSandbox.holdings.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={autoDistribute} className="text-xs h-7 gap-1">
                    <RefreshCw size={11} />
                    Auto-distribute
                  </Button>
                )}
              </div>

              <StockPicker stocks={stocks} existingTickers={existingTickers} onAdd={addStockToSandbox} />

              {activeSandbox.holdings.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic text-center py-3">
                  Search and add stocks above.
                </p>
              ) : (
                <div>
                  <div className="flex items-center gap-2 pb-1.5 border-b border-border mb-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground w-16 shrink-0">Ticker</span>
                    <span className="text-[10px] font-semibold text-muted-foreground hidden sm:block w-12 shrink-0">Vol.</span>
                    <span className="text-[10px] font-semibold text-muted-foreground flex-1">Section</span>
                    <span className="text-[10px] font-semibold text-muted-foreground w-16 shrink-0 text-right">Weight</span>
                    <span className="w-6" />
                  </div>
                  {activeSandbox.holdings.map((h) => (
                    <HoldingRow
                      key={h.ticker}
                      holding={h}
                      stock={stockMap[h.ticker]}
                      onWeightChange={updateWeight}
                      onSectionChange={updateSection}
                      onRemove={removeFromSandbox}
                      onStockClick={openFactSheet}
                    />
                  ))}
                </div>
              )}

              {activeSandbox.holdings.length > 0 && (
                <div className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium",
                  weightOk
                    ? "bg-success/10 border border-success/20 text-success"
                    : "bg-warning/10 border border-warning/20 text-warning"
                )}>
                  <span>Total Allocation</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold">{totalWeight.toFixed(1)}%</span>
                    {!weightOk && (
                      <span className="text-xs opacity-75">
                        ({totalWeight > 100 ? "+" : ""}{(totalWeight - 100).toFixed(1)}% vs 100%)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <StrategyOverlay holdings={activeSandbox.holdings} stocks={stocks} />

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
        )}
      </div>

      {/* ── Modals ── */}
      <NewSandboxModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={handleCreate} />

      {activeSandbox && (
        <PromoteModal
          open={promoteOpen}
          onClose={() => setPromoteOpen(false)}
          sandbox={activeSandbox}
          stocks={stocks}
          onConfirm={handlePromote}
          promoting={promoting}
        />
      )}
    </div>
  );
}
