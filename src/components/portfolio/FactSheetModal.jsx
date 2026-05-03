import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, Pencil, Check, Plus, BookMarked, ChevronDown, Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { updateStock, upsertSandbox } from "../../services/portfolioService";
import usePortfolioStore from "../../stores/portfolioStore";

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

// ── Draft builder ──────────────────────────────────────────────────────────

function buildDraft(stock) {
  const fs = stock.fact_sheet || {};
  const sentiment = parseSentiment(fs.analystSentiment);
  const tagArr = Array.isArray(fs.tags) && fs.tags.length > 0
    ? fs.tags
    : fs.sector ? fs.sector.split(" / ").map((t) => t.trim()).filter(Boolean) : [];
  return {
    name: fs.name || "",
    tags: tagArr.join(", "),
    volatilityTier: fs.volatilityTier || "",
    summary: fs.summary || "",
    businessModel: fs.businessModel || "",
    moat: fs.moat || "",
    growthOutlook: fs.growthOutlook || "",
    riskFactors: Array.isArray(fs.riskFactors) ? [...fs.riskFactors] : [],
    sentimentRating: sentiment.rating || "",
    sentimentRationale: sentiment.rationale || "",
    pe: fs.keyRatios?.pe ?? "",
    evEbitda: fs.keyRatios?.evEbitda ?? "",
    roe: fs.keyRatios?.roe ?? "",
    grossMargin: fs.keyRatios?.grossMargin ?? "",
    netMargin: fs.keyRatios?.netMargin ?? "",
    debtToEquity: fs.keyRatios?.debtToEquity ?? "",
    notes: stock.notes || "",
  };
}

// ── Shared style helpers ───────────────────────────────────────────────────

const editTextarea = cn(
  "w-full rounded-lg border border-input bg-background px-3 py-2",
  "text-sm text-foreground placeholder:text-muted-foreground resize-y",
  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
  "transition-colors"
);

const editInput = cn(
  "w-full rounded-lg border border-input bg-background px-3 py-2",
  "text-sm text-foreground placeholder:text-muted-foreground",
  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
  "transition-colors"
);

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

// ── SandboxPicker ──────────────────────────────────────────────────────────

function SandboxPicker({ sandboxes, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const selected = sandboxes.find((s) => s.id === value);

  const filtered = query
    ? sandboxes.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : sandboxes;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        (!triggerRef.current || !triggerRef.current.contains(e.target)) &&
        (!listRef.current || !listRef.current.contains(e.target))
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openDropdown = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setQuery("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleSelect = (sb) => { onChange(sb.id); setOpen(false); setQuery(""); };

  return (
    <div ref={triggerRef} className="flex-1 min-w-0">
      <div
        onClick={openDropdown}
        className={cn(
          "flex items-center gap-2 h-8 px-3 rounded-lg border bg-background cursor-pointer transition-colors select-none",
          open ? "border-ring ring-2 ring-ring/30" : "border-input hover:border-brand/40"
        )}
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="flex-1 min-w-0 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn("flex-1 min-w-0 text-xs truncate", selected ? "text-foreground" : "text-muted-foreground")}>
            {selected ? selected.name : "Select scenario…"}
          </span>
        )}
        <ChevronDown size={12} className={cn("text-muted-foreground shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </div>

      {open && dropPos && createPortal(
        <div
          ref={listRef}
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
        >
          {filtered.length > 0 ? filtered.map((sb) => (
            <button
              key={sb.id}
              onMouseDown={() => handleSelect(sb)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors",
                value === sb.id && "bg-brand/5 text-brand font-medium"
              )}
            >
              {sb.name}
            </button>
          )) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">No matching scenarios.</p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── FactSheetModal ─────────────────────────────────────────────────────────

export function FactSheetModal({
  stock,
  onClose,
  onRemove,
  onNotesSaved,
  onFactSheetSaved,
  initialEditMode = false,
}) {
  const { sandboxes, saveSandbox: saveSandboxStore } = usePortfolioStore();

  const fs = stock.fact_sheet || {};
  const ratios = fs.keyRatios || {};
  const sentiment = parseSentiment(fs.analystSentiment);

  const [notes, setNotes] = useState(stock.notes || "");
  const [saving, setSaving] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [editing, setEditing] = useState(initialEditMode);
  const [draft, setDraft] = useState(() => buildDraft(stock));
  const [sbTarget, setSbTarget] = useState("");
  const [sbSection, setSbSection] = useState("buy_and_hold");
  const [addingToSb, setAddingToSb] = useState(false);

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  // ── Notes auto-save (view mode only) ──
  const handleNotesBlur = async () => {
    if (editing) return;
    if (notes === (stock.notes || "")) return;
    setSaving(true);
    await updateStock(stock.id, { notes });
    setSaving(false);
    onNotesSaved?.(stock.id, notes);
  };

  // ── Edit mode actions ──
  const handleEdit = () => {
    setDraft(buildDraft(stock));
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(buildDraft(stock));
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tags = draft.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const newFactSheet = {
        ...(stock.fact_sheet || {}),
        name: draft.name,
        tags,
        sector: tags.join(" / "),
        volatilityTier: draft.volatilityTier || undefined,
        summary: draft.summary,
        businessModel: draft.businessModel,
        moat: draft.moat,
        growthOutlook: draft.growthOutlook,
        riskFactors: draft.riskFactors.filter((r) => r.trim()),
        analystSentiment: draft.sentimentRating
          ? { rating: draft.sentimentRating, rationale: draft.sentimentRationale }
          : undefined,
        keyRatios: {
          pe: draft.pe,
          evEbitda: draft.evEbitda,
          roe: draft.roe,
          grossMargin: draft.grossMargin,
          netMargin: draft.netMargin,
          debtToEquity: draft.debtToEquity,
        },
      };
      const savedNotes = draft.notes;
      await updateStock(stock.id, { fact_sheet: newFactSheet, notes: savedNotes });
      setNotes(savedNotes);
      setEditing(false);
      onFactSheetSaved?.(stock.id, newFactSheet, savedNotes);
      toast.success("Fact sheet saved.");
    } catch (err) {
      toast.error("Failed to save: " + (err.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Add to sandbox ──
  const handleAddToSandbox = async () => {
    const sandbox = sandboxes.find((s) => s.id === sbTarget);
    if (!sandbox) return;
    if ((sandbox.holdings || []).some((h) => h.ticker === stock.ticker)) {
      toast.error(`${stock.ticker} is already in "${sandbox.name}".`);
      return;
    }
    setAddingToSb(true);
    try {
      const updated = {
        ...sandbox,
        holdings: [...(sandbox.holdings || []), { ticker: stock.ticker, weight: 0, sectionOverride: sbSection }],
      };
      const { error } = await upsertSandbox({
        id: updated.id, name: updated.name,
        holdings: updated.holdings, correlations: updated.correlations,
      });
      if (error) { toast.error("Failed to add: " + error.message); return; }
      saveSandboxStore(updated);
      toast.success(`${stock.ticker} added to "${sandbox.name}" — set weight when ready.`);
      setSbTarget("");
    } finally {
      setAddingToSb(false);
    }
  };

  // ── Derived display values (view mode) ──
  const displayTags = Array.isArray(fs.tags) && fs.tags.length > 0
    ? fs.tags
    : fs.sector ? fs.sector.split(" / ").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={editing ? undefined : onClose}
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
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-3xl font-bold text-foreground tracking-tight">
                  {stock.ticker}
                </span>

                {editing ? (
                  <select
                    value={draft.sentimentRating}
                    onChange={set("sentimentRating")}
                    className={cn(editInput, "w-auto text-xs h-7 py-0 px-2")}
                  >
                    <option value="">No sentiment</option>
                    <option value="bullish">Bullish</option>
                    <option value="neutral">Neutral</option>
                    <option value="bearish">Bearish</option>
                  </select>
                ) : (
                  sentiment.rating && (
                    <Badge variant={sentimentVariant(sentiment.rating)} className="capitalize">
                      {sentiment.rating}
                    </Badge>
                  )
                )}

                {editing ? (
                  <select
                    value={draft.volatilityTier}
                    onChange={set("volatilityTier")}
                    className={cn(editInput, "w-auto text-xs h-7 py-0 px-2")}
                  >
                    <option value="">No volatility</option>
                    <option value="low">Low volatility</option>
                    <option value="medium">Medium volatility</option>
                    <option value="high">High volatility</option>
                  </select>
                ) : (
                  fs.volatilityTier && (
                    <Badge variant={volatilityVariant(fs.volatilityTier)}>
                      {fs.volatilityTier} volatility
                    </Badge>
                  )
                )}
              </div>

              {editing ? (
                <input
                  value={draft.name}
                  onChange={set("name")}
                  placeholder="Company name"
                  className={cn(editInput, "text-sm")}
                />
              ) : (
                <p className="text-sm text-muted-foreground truncate">{fs.name}</p>
              )}

              {editing ? (
                <div>
                  <input
                    value={draft.tags}
                    onChange={set("tags")}
                    placeholder="Tags, comma-separated (e.g. Technology, Semiconductors, AI)"
                    className={cn(editInput, "text-xs")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Comma-separated tags</p>
                </div>
              ) : displayTags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {displayTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="w-fit">{tag}</Badge>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-1.5 shrink-0 mt-1">
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="brand" size="sm" onClick={handleSave} disabled={saving}>
                    <Check size={13} />
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleEdit}
                    title="Edit fact sheet"
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
                  >
                    <X size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Summary */}
          {(editing || fs.summary) && (
            <div>
              {editing ? (
                <Section title="Summary">
                  <textarea
                    value={draft.summary}
                    onChange={set("summary")}
                    rows={2}
                    placeholder="One-sentence summary of the company…"
                    className={editTextarea}
                  />
                </Section>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-brand/40 pl-4">
                  {fs.summary}
                </p>
              )}
            </div>
          )}

          {/* Business Model */}
          {(editing || fs.businessModel) && (
            <Section title="Business Model">
              {editing ? (
                <textarea
                  value={draft.businessModel}
                  onChange={set("businessModel")}
                  rows={3}
                  placeholder="Describe how the company makes money…"
                  className={editTextarea}
                />
              ) : (
                <p className="text-sm text-foreground leading-relaxed">{fs.businessModel}</p>
              )}
            </Section>
          )}

          {/* Competitive Moat */}
          {(editing || fs.moat) && (
            <Section title="Competitive Moat">
              {editing ? (
                <textarea
                  value={draft.moat}
                  onChange={set("moat")}
                  rows={3}
                  placeholder="Describe the company's competitive advantages…"
                  className={editTextarea}
                />
              ) : (
                <p className="text-sm text-foreground leading-relaxed">{fs.moat}</p>
              )}
            </Section>
          )}

          {/* Key Ratios */}
          <Section title="Key Ratios">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {KEY_RATIOS.map(({ label, key }) => (
                <div key={key} className="bg-background rounded-lg border border-border px-3.5 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  {editing ? (
                    <input
                      type="text"
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      placeholder="—"
                      className={cn(
                        "w-full text-sm font-semibold font-mono text-foreground bg-transparent",
                        "outline-none border-b border-transparent focus:border-input transition-colors"
                      )}
                    />
                  ) : (
                    <p className="text-sm font-semibold text-foreground font-mono">
                      {formatRatio(ratios[key])}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Growth Outlook */}
          {(editing || fs.growthOutlook) && (
            <Section title="Growth Outlook">
              {editing ? (
                <textarea
                  value={draft.growthOutlook}
                  onChange={set("growthOutlook")}
                  rows={3}
                  placeholder="Describe growth prospects and catalysts…"
                  className={editTextarea}
                />
              ) : (
                <p className="text-sm text-foreground leading-relaxed">{fs.growthOutlook}</p>
              )}
            </Section>
          )}

          {/* Risk Factors */}
          {(editing || (Array.isArray(fs.riskFactors) && fs.riskFactors.length > 0)) && (
            <Section title="Risk Factors">
              {editing ? (
                <div className="flex flex-col gap-2">
                  {draft.riskFactors.map((risk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger/60 shrink-0" />
                      <input
                        type="text"
                        value={risk}
                        onChange={(e) => {
                          const next = [...draft.riskFactors];
                          next[i] = e.target.value;
                          setDraft((d) => ({ ...d, riskFactors: next }));
                        }}
                        placeholder="Risk factor…"
                        className={cn(editInput, "flex-1 py-1.5")}
                      />
                      <button
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            riskFactors: d.riskFactors.filter((_, j) => j !== i),
                          }))
                        }
                        className="text-muted-foreground hover:text-danger transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDraft((d) => ({ ...d, riskFactors: [...d.riskFactors, ""] }))}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 w-fit"
                  >
                    <Plus size={13} />
                    Add risk factor
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {fs.riskFactors.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-danger/60 shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* Analyst Sentiment */}
          {(editing || sentiment.rating) && (
            <Section title="Analyst Sentiment">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={draft.sentimentRationale}
                    onChange={set("sentimentRationale")}
                    rows={2}
                    placeholder="Rationale for the sentiment rating…"
                    className={editTextarea}
                  />
                  <p className="text-xs text-muted-foreground">Rating is set in the header above.</p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Badge variant={sentimentVariant(sentiment.rating)} className="capitalize shrink-0 mt-0.5">
                    {sentiment.rating}
                  </Badge>
                  {sentiment.rationale && (
                    <p className="text-sm text-muted-foreground">{sentiment.rationale}</p>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Notes */}
          <Section title="Notes">
            <textarea
              value={editing ? draft.notes : notes}
              onChange={editing
                ? (e) => setDraft((d) => ({ ...d, notes: e.target.value }))
                : (e) => setNotes(e.target.value)
              }
              onBlur={editing ? undefined : handleNotesBlur}
              placeholder="Add your personal research notes…"
              rows={4}
              className={cn(
                "w-full rounded-lg border border-input bg-background px-3 py-2",
                "text-sm text-foreground placeholder:text-muted-foreground resize-y",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                "transition-colors duration-150"
              )}
            />
            {saving && !editing && <p className="text-xs text-muted-foreground mt-1">Saving…</p>}
          </Section>

          {/* Add to Scenario Portfolio */}
          {!editing && sandboxes.length > 0 && (
            <Section title="Add to Scenario Portfolio">
              <div className="flex flex-wrap items-center gap-2">
                <SandboxPicker
                  sandboxes={sandboxes}
                  value={sbTarget}
                  onChange={setSbTarget}
                />
                <select
                  value={sbSection}
                  onChange={(e) => setSbSection(e.target.value)}
                  className={cn(
                    "w-auto rounded-lg border border-input bg-background px-3 py-1.5",
                    "text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                  )}
                >
                  <option value="buy_and_hold">Buy & Hold</option>
                  <option value="fortress">Fortress</option>
                  <option value="slingshot">Slingshot</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddToSandbox}
                  disabled={!sbTarget || addingToSb}
                >
                  <BookMarked size={13} />
                  {addingToSb ? "Adding…" : "Add"}
                </Button>
              </div>
            </Section>
          )}

          {/* Remove */}
          {!editing && onRemove && (
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
