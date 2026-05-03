import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  Plus, Sparkles, TrendingUp, AlertCircle, ChevronDown, Pencil, X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input, FormField } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import usePortfolioStore from "../../stores/portfolioStore";
import { fetchStocks, insertStock, deleteStock, updateStock } from "../../services/portfolioService";
import { volatilityVariant } from "../../components/portfolio/FactSheetModal";

// ── Constants ──────────────────────────────────────────────────────────────

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT =
  "You are a financial research assistant. When given a stock ticker, return ONLY " +
  "a JSON object with no markdown or code fences with these fields: " +
  "{ ticker, name, sector (primary classification string like 'Technology / Semiconductors'), " +
  "tags (array of individual sector/industry tag strings — split the sector and add any relevant " +
  "sub-industry tags, e.g. sector 'Technology / Semiconductors' → tags ['Technology','Semiconductors']; " +
  "sector 'Industrials / Defense' → tags ['Industrials','Defense']; include common tags from: " +
  "Technology, Financials, Healthcare, Industrials, Energy, Materials, Utilities, " +
  "Real Estate, Consumer Staples, Consumer Discretionary, Communication Services, " +
  "Semiconductors, Software, Cloud, AI, Fintech, Biotech, Pharmaceuticals, Medical Devices, " +
  "Defense, Aerospace, Automotive, Banking, Insurance, REIT, ETF, Mining, Retail, E-Commerce, " +
  "Data Center, Robotics, Cybersecurity, as appropriate), " +
  "volatilityTier (low/medium/high), summary (1 sentence), " +
  "moat (2-3 sentences on competitive advantage), businessModel (2-3 sentences), " +
  "keyRatios: { pe, evEbitda, roe, grossMargin, netMargin, debtToEquity } with " +
  "placeholder values or estimates where unknown, growthOutlook (2-3 sentences), " +
  "riskFactors (array of 3-5 strings), analystSentiment (bullish/neutral/bearish " +
  "with 1 sentence rationale) }";

const VOLATILITY_ORDER = { low: 0, medium: 1, high: 2 };

const SORT_OPTIONS = [
  { value: "date",       label: "Date Added" },
  { value: "ticker",     label: "Ticker A–Z" },
  { value: "name",       label: "Company Name" },
  { value: "volatility", label: "Volatility" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getSectorTags(stock) {
  const fs = stock.fact_sheet || {};
  if (Array.isArray(fs.tags) && fs.tags.length > 0) return fs.tags;
  if (fs.sector) return fs.sector.split(" / ").map((t) => t.trim()).filter(Boolean);
  return [];
}

function extractJSON(text) {
  const clean = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response.");
  return JSON.parse(match[0]);
}

// ── MultiSelect ────────────────────────────────────────────────────────────

function MultiSelect({ placeholder, options, selected, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (value) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value); else next.add(value);
    onChange(next);
  };

  const label =
    selected.size === 0 ? placeholder :
    selected.size === 1 ? (options.find((o) => o.value === [...selected][0])?.label ?? [...selected][0]) :
    `${selected.size} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 h-8 px-3 text-xs rounded-lg border bg-background",
          "transition-colors hover:border-brand/40",
          selected.size > 0 ? "border-brand/60 text-brand" : "border-input text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span>{label}</span>
        <ChevronDown size={12} className={cn("transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div className={cn(
          "absolute top-full mt-1 left-0 z-50 min-w-[180px] max-h-72 overflow-y-auto",
          "bg-card border border-border rounded-xl shadow-lg py-1"
        )}>
          {options.map(({ value, label: optLabel }) => (
            <label
              key={value}
              className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(value)}
                onChange={() => toggle(value)}
                className="accent-brand w-3 h-3 shrink-0"
              />
              {optLabel}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FilterChip ─────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }) {
  return (
    <div className="flex items-center gap-1 h-8 pl-2.5 pr-1.5 rounded-lg bg-brand/10 border border-brand/20 text-xs text-brand shrink-0">
      <span className="capitalize">{label}</span>
      <button
        onClick={onRemove}
        className="hover:text-brand/50 transition-colors ml-0.5"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── Skeleton Card ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-7 w-16 bg-muted rounded-md" />
        <div className="h-4 w-4 bg-muted rounded-full ml-auto" />
      </div>
      <div className="h-4 w-28 bg-muted rounded" />
      <div className="flex gap-1.5">
        <div className="h-5 w-20 bg-muted rounded-full" />
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-4/5 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Stock Card ─────────────────────────────────────────────────────────────

function StockCard({ stock, onClick }) {
  const fs = stock.fact_sheet || {};
  const vVariant = volatilityVariant(fs.volatilityTier);
  const isBlank = !fs.name && !fs.summary;

  return (
    <button
      onClick={() => onClick(stock)}
      className={cn(
        "bg-card border border-border rounded-xl p-5 flex flex-col gap-3 text-left w-full",
        "hover:border-brand/40 hover:shadow-md transition-all duration-150 group"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-2xl font-bold text-foreground group-hover:text-brand transition-colors tracking-tight">
          {stock.ticker}
        </span>
        {fs.volatilityTier ? (
          <Badge variant={vVariant} className="mt-1 shrink-0">
            {fs.volatilityTier}
          </Badge>
        ) : isBlank && (
          <Pencil size={13} className="text-muted-foreground/40 mt-1.5 shrink-0" />
        )}
      </div>

      <p className="text-sm font-medium text-foreground leading-snug line-clamp-1">
        {fs.name || "—"}
      </p>

      {getSectorTags(stock).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {getSectorTags(stock).map((tag) => (
            <Badge key={tag} variant="outline" className="w-fit">{tag}</Badge>
          ))}
        </div>
      )}

      {fs.summary ? (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {fs.summary}
        </p>
      ) : isBlank && (
        <p className="text-xs text-muted-foreground/50 italic">
          Click to add details
        </p>
      )}
    </button>
  );
}

// ── Add Stock Modal ────────────────────────────────────────────────────────

function AddStockModal({ open, onClose, onAdded, existingStocks }) {
  const [ticker, setTicker] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTicker("");
      setGenerating(false);
      setError("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const checkDuplicate = (t) => {
    const existing = existingStocks?.find((s) => s.ticker === t);
    if (existing) {
      toast.success(`${t} is already in the shared library.`);
      onClose();
      return true;
    }
    return false;
  };

  const handleAddBlank = () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    if (checkDuplicate(t)) return;
    onClose();
    onAdded(t, null);
  };

  const handleGenerate = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setError("");
    if (checkDuplicate(t)) return;

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setError("VITE_ANTHROPIC_API_KEY is not configured.");
      return;
    }

    setGenerating(true);
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
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Generate a fact sheet for ${t}` }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const raw = data.content?.[0]?.text || "";
      const factSheet = extractJSON(raw);

      onClose();
      onAdded(t, factSheet);
    } catch (err) {
      setError(err.message || "Failed to generate fact sheet. Please try again.");
      toast.error("Fact sheet generation failed for " + t);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={generating ? undefined : onClose}>
      <DialogHeader onClose={generating ? undefined : onClose}>
        <DialogTitle>Add Stock</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <FormField label="Ticker Symbol" hint="e.g. AAPL, MSFT, NVDA, TSM">
          <Input
            ref={inputRef}
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
            placeholder="AAPL"
            disabled={generating}
            className="font-mono uppercase tracking-widest text-base"
          />
        </FormField>

        {generating && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles size={15} className="text-brand animate-pulse" />
            Generating fact sheet for {ticker}…
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-danger">
            <AlertCircle size={15} className="shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={generating}
        >
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddBlank}
          disabled={!ticker.trim() || generating}
        >
          Add Blank
        </Button>
        <Button
          variant="brand"
          size="sm"
          onClick={handleGenerate}
          disabled={!ticker.trim() || generating}
        >
          <Sparkles size={14} />
          Generate Fact Sheet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function StocksPage() {
  const { stocks, setStocks, addStock, removeStock, openFactSheet } = usePortfolioStore();
  const [loading, setLoading] = useState(true);
  const [pendingTickers, setPendingTickers] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [filterTags, setFilterTags] = useState(new Set());
  const [filterVolatility, setFilterVolatility] = useState(new Set());
  const [sortBy, setSortBy] = useState("date");

  useEffect(() => {
    fetchStocks().then(async ({ data, error }) => {
      if (error) toast.error("Failed to load stocks: " + (error.message || "unknown error"));
      if (!data) { setLoading(false); return; }

      // Migrate existing stocks that have sector but no tags array
      const needsMigration = data.filter(
        (s) => s.fact_sheet?.sector && !Array.isArray(s.fact_sheet?.tags)
      );
      const migrated = [...data];
      await Promise.all(
        needsMigration.map(async (s) => {
          const tags = s.fact_sheet.sector.split(" / ").map((t) => t.trim()).filter(Boolean);
          const newFactSheet = { ...s.fact_sheet, tags };
          await updateStock(s.id, { fact_sheet: newFactSheet });
          const idx = migrated.findIndex((x) => x.id === s.id);
          if (idx !== -1) migrated[idx] = { ...migrated[idx], fact_sheet: newFactSheet };
        })
      );

      setStocks(migrated);
      setLoading(false);
    });
  }, []);

  const allTags = [...new Set(stocks.flatMap(getSectorTags))].sort();

  const filtered = stocks
    .filter((s) => {
      if (filterTags.size > 0 && !getSectorTags(s).some((t) => filterTags.has(t))) return false;
      if (filterVolatility.size > 0 && !filterVolatility.has(s.fact_sheet?.volatilityTier)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "ticker") return a.ticker.localeCompare(b.ticker);
      if (sortBy === "name") return (a.fact_sheet?.name || "").localeCompare(b.fact_sheet?.name || "");
      if (sortBy === "volatility")
        return (VOLATILITY_ORDER[a.fact_sheet?.volatilityTier] ?? 0) -
               (VOLATILITY_ORDER[b.fact_sheet?.volatilityTier] ?? 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  const handleAdded = async (ticker, factSheet) => {
    const isBlank = factSheet === null;
    setPendingTickers((t) => [...t, ticker]);
    try {
      const { data, error } = await insertStock({ ticker, fact_sheet: factSheet || {}, notes: "" });
      if (error) {
        toast.error("Failed to save " + ticker + ": " + (error.message || "unknown error"));
        return;
      }
      if (data) {
        addStock(data);
        if (isBlank) {
          toast.success(ticker + " added. Fill in the details.");
          openFactSheet(data, { onRemove: handleRemove, editMode: true });
        } else {
          toast.success(ticker + " added to library.");
        }
      }
    } finally {
      setPendingTickers((t) => t.filter((x) => x !== ticker));
    }
  };

  const handleRemove = async (stock) => {
    const { error } = await deleteStock(stock.id);
    if (error) {
      toast.error("Failed to remove " + stock.ticker + ": " + (error.message || "unknown error"));
      return;
    }
    removeStock(stock.ticker);
    toast.success(stock.ticker + " removed.");
  };

  const isEmpty = !loading && filtered.length === 0 && pendingTickers.length === 0;

  return (
    <div>
      {/* Filter / sort bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <MultiSelect
          placeholder="All Tags"
          options={allTags.map((t) => ({ value: t, label: t }))}
          selected={filterTags}
          onChange={setFilterTags}
          disabled={loading}
        />

        <MultiSelect
          placeholder="All Volatility"
          options={[
            { value: "low",    label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high",   label: "High" },
          ]}
          selected={filterVolatility}
          onChange={setFilterVolatility}
          disabled={loading}
        />

        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-auto text-xs h-8"
          disabled={loading}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>

        {/* Active filter chips */}
        {[...filterTags].map((tag) => (
          <FilterChip
            key={`tag-${tag}`}
            label={tag}
            onRemove={() => { const n = new Set(filterTags); n.delete(tag); setFilterTags(n); }}
          />
        ))}
        {[...filterVolatility].map((v) => (
          <FilterChip
            key={`vol-${v}`}
            label={`${v} vol`}
            onRemove={() => { const n = new Set(filterVolatility); n.delete(v); setFilterVolatility(n); }}
          />
        ))}
        {filterTags.size + filterVolatility.size > 0 && (
          <button
            onClick={() => { setFilterTags(new Set()); setFilterVolatility(new Set()); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors h-8 px-1"
          >
            Clear all
          </button>
        )}

        <div className="flex-1" />

        <Button variant="brand" size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} />
          Add Stock
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
            <TrendingUp size={28} className="text-brand" />
          </div>
          <h2 className="text-base font-semibold text-foreground">No stocks yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Click "Add Stock" and enter a ticker — Claude will generate a full fact sheet instantly.
          </p>
          <Button variant="brand" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add Stock
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingTickers.map((t) => <SkeletonCard key={t} />)}
          {filtered.map((s) => (
            <StockCard
              key={s.id}
              stock={s}
              onClick={(stock) => openFactSheet(stock, { onRemove: handleRemove })}
            />
          ))}
        </div>
      )}

      <AddStockModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
        existingStocks={stocks}
      />
    </div>
  );
}
