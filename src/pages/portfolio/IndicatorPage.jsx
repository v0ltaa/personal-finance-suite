import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Save, Trash2, Info, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";
import usePortfolioStore from "../../stores/portfolioStore";
import { fetchIndicatorLog, insertIndicatorEntry, deleteIndicatorEntry } from "../../services/portfolioService";

// ── Constants ──────────────────────────────────────────────────────────────

const SIGNALS = [
  { value: "slingshot", label: "Slingshot" },
  { value: "fortress",  label: "Fortress"  },
];

const SIGNAL_CONFIG = {
  slingshot: {
    dot: "#22c55e",
    badge: "success",
    label: "SLINGSHOT CONDITIONS MET",
    sub: "Deploy capital into high-volatility assets",
    gradientFrom: "rgba(34,197,94,0.18)",
    gradientTo:   "rgba(34,197,94,0.04)",
    borderColor:  "rgba(34,197,94,0.4)",
  },
  fortress: {
    dot: "#ef4444",
    badge: "danger",
    label: "ROTATE TO FORTRESS",
    sub: "Preserve gains, reduce volatility exposure",
    gradientFrom: "rgba(239,68,68,0.18)",
    gradientTo:   "rgba(239,68,68,0.04)",
    borderColor:  "rgba(239,68,68,0.4)",
  },
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Signal Display ─────────────────────────────────────────────────────────

function SignalDisplay({ latest }) {
  const signal = latest?.signal || "slingshot";
  const cfg = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.slingshot;

  return (
    <div
      className="rounded-2xl border-2 p-8 sm:p-10 text-center relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`,
        borderColor: cfg.borderColor,
      }}
    >
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10" style={{ background: cfg.dot }} />

      <div className="flex items-center justify-center gap-3 mb-4">
        <span className="relative flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: cfg.dot }} />
          <span className="relative inline-flex rounded-full h-4 w-4" style={{ background: cfg.dot }} />
        </span>
        <Badge variant={cfg.badge} className="text-xs font-semibold tracking-wide px-3 py-1">
          LIVE SIGNAL
        </Badge>
      </div>

      <h2 className="text-2xl sm:text-3xl font-black tracking-widest uppercase font-mono leading-tight mb-2" style={{ color: cfg.dot }}>
        {cfg.label}
      </h2>
      <p className="text-sm text-muted-foreground">{cfg.sub}</p>

      {latest ? (
        <div className="mt-6 inline-flex items-center gap-4 bg-card/60 border border-border rounded-xl px-5 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Logged</p>
            <p className="text-sm font-medium text-foreground">{fmtDate(latest.logged_at)}</p>
          </div>
          {latest.notes && (
            <>
              <div className="w-px h-8 bg-border" />
              <p className="text-xs text-muted-foreground max-w-[200px] text-left leading-relaxed line-clamp-2">
                {latest.notes}
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="mt-6 text-xs text-muted-foreground italic">
          No entries yet — log your first reading below.
        </p>
      )}
    </div>
  );
}

// ── Entry Form ─────────────────────────────────────────────────────────────

function EntryForm({ onSave, saving }) {
  const [date, setDate]     = useState(today());
  const [signal, setSignal] = useState("slingshot");
  const [notes, setNotes]   = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave({
      logged_at: new Date(date).toISOString(),
      signal,
      notes: notes.trim(),
    });
    setNotes("");
    setDate(today());
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Log Reading</h3>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cn(
            "w-full h-9 rounded-lg border border-input bg-background px-3 py-2",
            "text-sm text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          )}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Signal</label>
        <div className="flex gap-2">
          {SIGNALS.map((s) => {
            const active = signal === s.value;
            const cfg = SIGNAL_CONFIG[s.value];
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setSignal(s.value)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all",
                  active ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-border/80"
                )}
                style={active ? { background: cfg.dot } : {}}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What's driving this signal?"
          rows={2}
          className={cn(
            "w-full rounded-lg border border-input bg-background px-3 py-2",
            "text-sm text-foreground placeholder:text-muted-foreground resize-none",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          )}
        />
      </div>

      <Button type="submit" variant="brand" size="sm" disabled={saving} className="self-end">
        <Save size={13} />
        {saving ? "Saving…" : "Save Reading"}
      </Button>
    </form>
  );
}

// ── History Table ──────────────────────────────────────────────────────────

function HistoryTable({ entries, onDelete }) {
  const [sortAsc, setSortAsc] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const sorted = [...entries].sort((a, b) => {
    const diff = new Date(a.logged_at) - new Date(b.logged_at);
    return sortAsc ? diff : -diff;
  });

  const handleDelete = async (entry) => {
    setDeleting(entry.id);
    await onDelete(entry);
    setDeleting(null);
  };

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground/60 italic text-center py-4">No history yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left pb-2 pr-4">
              <button
                onClick={() => setSortAsc((a) => !a)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Date
                {sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </th>
            <th className="text-left pb-2 pr-4 text-xs font-semibold text-muted-foreground">Signal</th>
            <th className="text-left pb-2 pr-4 text-xs font-semibold text-muted-foreground">Notes</th>
            <th className="pb-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
            const cfg = SIGNAL_CONFIG[e.signal] || SIGNAL_CONFIG.slingshot;
            return (
              <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-2.5 pr-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {fmtDate(e.logged_at)}
                </td>
                <td className="py-2.5 pr-4">
                  <Badge variant={cfg.badge} className="text-[10px] capitalize">{e.signal}</Badge>
                </td>
                <td className="py-2.5 pr-4 text-xs text-muted-foreground max-w-[260px] truncate">
                  {e.notes || "—"}
                </td>
                <td className="py-2.5">
                  <button
                    onClick={() => handleDelete(e)}
                    disabled={deleting === e.id}
                    className="text-muted-foreground/40 hover:text-danger transition-colors disabled:opacity-30"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Info Panel ─────────────────────────────────────────────────────────────

function InfoPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <Info size={15} className="text-muted-foreground" />
        What does this mean?
        {open ? <ChevronUp size={14} className="ml-auto text-muted-foreground" /> : <ChevronDown size={14} className="ml-auto text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-4 text-sm text-muted-foreground leading-relaxed">
          <div className="flex gap-3">
            <div className="w-1 rounded-full bg-success shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-foreground mb-1">Slingshot Mode</p>
              <p>
                Market conditions are favourable for deploying capital into high-volatility,
                high-growth positions. Your Slingshot bucket is active — hold positions
                for 90 trading days to capture momentum-driven returns.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-1 rounded-full bg-danger shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-foreground mb-1">Fortress Mode</p>
              <p>
                Defensive posture is warranted. Rotate the active allocation toward
                capital-preservation assets — dividend payers, bonds, low-beta stocks —
                to protect gains and reduce drawdown risk.
              </p>
            </div>
          </div>
          <p className="text-xs border-t border-border pt-3">
            Log a new reading whenever your view on market conditions changes.
            The Portfolio tab automatically reflects whichever mode you logged most recently.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function IndicatorPage() {
  const { indicatorLog, setIndicatorLog, addIndicatorEntry, removeIndicatorEntry } = usePortfolioStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIndicatorLog().then(({ data, error }) => {
      if (error) toast.error("Failed to load indicator log: " + error.message);
      if (data) setIndicatorLog(data);
      setLoading(false);
    });
  }, []);

  const handleSave = async (entry) => {
    setSaving(true);
    const { data, error } = await insertIndicatorEntry(entry);
    setSaving(false);
    if (error) { toast.error("Failed to save: " + error.message); return; }
    if (data) {
      addIndicatorEntry(data);
      localStorage.setItem("pf_active_mode", entry.signal);
      toast.success("Reading saved.");
    }
  };

  const handleDelete = async (entry) => {
    const { error } = await deleteIndicatorEntry(entry.id);
    if (error) { toast.error("Failed to delete: " + error.message); return; }
    removeIndicatorEntry(entry.id);
    toast.success("Entry removed.");
  };

  const latest = indicatorLog.length > 0
    ? [...indicatorLog].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0]
    : null;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-44 bg-card border border-border rounded-2xl animate-pulse" />
        <div className="h-48 bg-card border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SignalDisplay latest={latest} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EntryForm onSave={handleSave} saving={saving} />
        <InfoPanel />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Signal Log</h3>
        <HistoryTable entries={indicatorLog} onDelete={handleDelete} />
      </div>
    </div>
  );
}
