import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  Plus, Sparkles, TrendingUp, AlertCircle,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input, FormField } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import usePortfolioStore from "../../stores/portfolioStore";
import { fetchStocks, insertStock, deleteStock } from "../../services/portfolioService";
import { volatilityVariant } from "../../components/portfolio/FactSheetModal";

// ── Constants ──────────────────────────────────────────────────────────────

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT =
  "You are a financial research assistant. When given a stock ticker, return ONLY " +
  "a JSON object with no markdown or code fences with these fields: " +
  "{ ticker, name, sector, volatilityTier (low/medium/high), summary (1 sentence), " +
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

function extractJSON(text) {
  const clean = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response.");
  return JSON.parse(match[0]);
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
        {fs.volatilityTier && (
          <Badge variant={vVariant} className="mt-1 shrink-0">
            {fs.volatilityTier}
          </Badge>
        )}
      </div>

      <p className="text-sm font-medium text-foreground leading-snug line-clamp-1">
        {fs.name || "—"}
      </p>

      {fs.sector && (
        <Badge variant="outline" className="w-fit">{fs.sector}</Badge>
      )}

      {fs.summary && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {fs.summary}
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

  const handleGenerate = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setError("");

    // Already in the shared library — no need to generate again
    const existing = existingStocks?.find((s) => s.ticker === t);
    if (existing) {
      toast.success(`${t} is already in the shared library.`);
      onClose();
      return;
    }

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
  const [filterSector, setFilterSector] = useState("all");
  const [filterVolatility, setFilterVolatility] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  useEffect(() => {
    fetchStocks().then(({ data, error }) => {
      if (data) setStocks(data);
      if (error) toast.error("Failed to load stocks: " + (error.message || "unknown error"));
      setLoading(false);
    });
  }, []);

  const sectors = [...new Set(stocks.map((s) => s.fact_sheet?.sector).filter(Boolean))].sort();

  const filtered = stocks
    .filter((s) => {
      if (filterSector !== "all" && s.fact_sheet?.sector !== filterSector) return false;
      if (filterVolatility !== "all" && s.fact_sheet?.volatilityTier !== filterVolatility) return false;
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
    setPendingTickers((t) => [...t, ticker]);
    try {
      const { data, error } = await insertStock({ ticker, fact_sheet: factSheet, notes: "" });
      if (error) {
        toast.error("Failed to save " + ticker + ": " + (error.message || "unknown error"));
        return;
      }
      if (data) {
        addStock(data);
        toast.success(ticker + " added to library.");
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
        <Select
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
          className="w-auto text-xs h-8"
          disabled={loading}
        >
          <option value="all">All Sectors</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>

        <Select
          value={filterVolatility}
          onChange={(e) => setFilterVolatility(e.target.value)}
          className="w-auto text-xs h-8"
          disabled={loading}
        >
          <option value="all">All Volatility</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>

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
