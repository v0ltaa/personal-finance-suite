import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { updateStock } from "../../services/portfolioService";

// ── Shared helpers & constants ─────────────────────────────────────────────

export const KEY_RATIOS = [
  { label: "P/E",          key: "pe" },
  { label: "EV/EBITDA",    key: "evEbitda" },
  { label: "ROE",          key: "roe" },
  { label: "Gross Margin", key: "grossMargin" },
  { label: "Net Margin",   key: "netMargin" },
  { label: "Debt/Equity",  key: "debtToEquity" },
];

export function volatilityVariant(tier) {
  return { low: "success", medium: "warning", high: "danger" }[tier] ?? "muted";
}

export function sentimentVariant(rating) {
  return { bullish: "success", bearish: "danger", neutral: "warning" }[rating] ?? "muted";
}

export function formatRatio(val) {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "number") return Number.isFinite(val) ? val.toFixed(2).replace(/\.00$/, "") : "—";
  return String(val);
}

export function parseSentiment(raw) {
  if (!raw) return { rating: "", rationale: "" };
  if (typeof raw === "object") {
    return { rating: (raw.rating || "").toLowerCase(), rationale: raw.rationale || "" };
  }
  const m = String(raw).match(/^(bullish|neutral|bearish)[:\s\-]*(.*)/i);
  if (m) return { rating: m[1].toLowerCase(), rationale: m[2].trim() };
  return { rating: String(raw).toLowerCase(), rationale: "" };
}

// ── Internal sub-components ────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── FactSheetModal ─────────────────────────────────────────────────────────
//
// Props:
//   stock       – stock object with { id, ticker, fact_sheet, notes }
//   onClose     – () => void
//   onRemove    – optional (stock) => void — if provided, shows Remove button
//   onNotesSaved– optional (id, notes) => void — called after DB save

export function FactSheetModal({ stock, onClose, onRemove, onNotesSaved }) {
  const fs = stock.fact_sheet || {};
  const ratios = fs.keyRatios || {};
  const sentiment = parseSentiment(fs.analystSentiment);
  const [notes, setNotes] = useState(stock.notes || "");
  const [saving, setSaving] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);

  const handleNotesBlur = async () => {
    if (notes === (stock.notes || "")) return;
    setSaving(true);
    await updateStock(stock.id, { notes });
    setSaving(false);
    onNotesSaved?.(stock.id, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto",
          "bg-card border border-border rounded-2xl shadow-xl animate-slide-in"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-3xl font-bold text-foreground tracking-tight">
                  {stock.ticker}
                </span>
                {sentiment.rating && (
                  <Badge variant={sentimentVariant(sentiment.rating)} className="capitalize">
                    {sentiment.rating}
                  </Badge>
                )}
                {fs.volatilityTier && (
                  <Badge variant={volatilityVariant(fs.volatilityTier)}>
                    {fs.volatilityTier} volatility
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{fs.name}</p>
              {fs.sector && <Badge variant="outline" className="w-fit">{fs.sector}</Badge>}
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors mt-1 shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {fs.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-brand/40 pl-4">
              {fs.summary}
            </p>
          )}

          {fs.businessModel && (
            <Section title="Business Model">
              <p className="text-sm text-foreground leading-relaxed">{fs.businessModel}</p>
            </Section>
          )}

          {fs.moat && (
            <Section title="Competitive Moat">
              <p className="text-sm text-foreground leading-relaxed">{fs.moat}</p>
            </Section>
          )}

          <Section title="Key Ratios">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {KEY_RATIOS.map(({ label, key }) => (
                <div key={key} className="bg-background rounded-lg border border-border px-3.5 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {formatRatio(ratios[key])}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          {fs.growthOutlook && (
            <Section title="Growth Outlook">
              <p className="text-sm text-foreground leading-relaxed">{fs.growthOutlook}</p>
            </Section>
          )}

          {Array.isArray(fs.riskFactors) && fs.riskFactors.length > 0 && (
            <Section title="Risk Factors">
              <ul className="flex flex-col gap-2">
                {fs.riskFactors.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-danger/60 shrink-0" />
                    {risk}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {sentiment.rating && (
            <Section title="Analyst Sentiment">
              <div className="flex items-start gap-3">
                <Badge variant={sentimentVariant(sentiment.rating)} className="capitalize shrink-0 mt-0.5">
                  {sentiment.rating}
                </Badge>
                {sentiment.rationale && (
                  <p className="text-sm text-muted-foreground">{sentiment.rationale}</p>
                )}
              </div>
            </Section>
          )}

          <Section title="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add your personal research notes…"
              rows={4}
              className={cn(
                "w-full rounded-lg border border-input bg-background px-3 py-2",
                "text-sm text-foreground placeholder:text-muted-foreground resize-y",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                "transition-colors duration-150"
              )}
            />
            {saving && <p className="text-xs text-muted-foreground mt-1">Saving…</p>}
          </Section>

          {onRemove && (
            <div className="pt-2 border-t border-border">
              {removeConfirm ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground flex-1">Remove {stock.ticker}?</p>
                  <Button variant="outline" size="sm" onClick={() => setRemoveConfirm(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    className="bg-danger text-white hover:bg-danger/90"
                    onClick={() => onRemove(stock)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRemoveConfirm(true)}
                  className="text-danger border-danger/30 hover:bg-danger/5 hover:border-danger/50"
                >
                  <Trash2 size={13} />
                  Remove Stock
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
