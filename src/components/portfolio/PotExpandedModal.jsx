import { X, TrendingUp, Tag } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "../ui/badge";
import { volatilityVariant } from "./FactSheetModal";
import { cn } from "../../lib/utils";
import { currencySymbol } from "../../lib/currency";

const VOLATILITY_COLORS = {
  low: "#7bc47c",
  medium: "#f4a636",
  high: "#c4503a",
  unknown: "#94a3b8",
};

const SECTOR_COLORS = [
  "#c4503a", "#5aabcc", "#7bc47c", "#f4a636", "#9b5fc0",
  "#4a90d9", "#e07b54", "#22d3ee", "#a78bfa", "#fb923c",
  "#34d399", "#f87171", "#818cf8", "#fbbf24", "#60a5fa",
];

function buildVolatilityData(holdings, stockMap) {
  const totals = {};
  holdings.forEach((h) => {
    const tier = stockMap[h.ticker]?.fact_sheet?.volatilityTier || "unknown";
    totals[tier] = (totals[tier] || 0) + (Number(h.weight) || 0);
  });
  const order = ["low", "medium", "high", "unknown"];
  return order
    .filter((k) => totals[k] > 0)
    .map((k) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: parseFloat(totals[k].toFixed(2)),
      fill: VOLATILITY_COLORS[k],
    }));
}

function buildSectorData(holdings, stockMap) {
  const totals = {};
  holdings.forEach((h) => {
    const weight = Number(h.weight) || 0;
    const tags = stockMap[h.ticker]?.fact_sheet?.tags;
    if (!tags || tags.length === 0) {
      totals["Other"] = (totals["Other"] || 0) + weight;
      return;
    }
    const share = weight / tags.length;
    tags.forEach((tag) => {
      totals[tag] = (totals[tag] || 0) + share;
    });
  });
  return Object.entries(totals)
    .filter(([, v]) => v > 0.01)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value: parseFloat(value.toFixed(2)),
      fill: SECTOR_COLORS[i % SECTOR_COLORS.length],
    }));
}

function AnalyticsCard({ data, title, Icon }) {
  const isEmpty = data.length === 0;
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 flex-1">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Icon size={13} />
        {title}
      </div>
      {isEmpty ? (
        <p className="text-xs text-muted-foreground/40 italic text-center py-8">No data available</p>
      ) : (
        <div className="flex gap-5 items-center">
          {/* Donut */}
          <div className="shrink-0 w-[180px] h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%" cy="50%"
                  innerRadius={54} outerRadius={82}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(1)}%`]}
                  contentStyle={{
                    background: "var(--color-card,#fff)",
                    border: "1px solid var(--color-border,#e5e7eb)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: d.fill }}
                  />
                  <span className="text-foreground truncate">{d.name}</span>
                </div>
                <span className="font-mono text-muted-foreground tabular-nums shrink-0">
                  {d.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PotExpandedModal({
  open, onClose, stratDef, holdings, stocks,
  target, totalCapital, displayCurrency, showEntryDate = true,
}) {
  if (!open || !stratDef) return null;

  const stockMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));
  const volatilityData = buildVolatilityData(holdings, stockMap);
  const sectorData = buildSectorData(holdings, stockMap);
  const totalWeight = holdings.reduce((s, h) => s + (Number(h.weight) || 0), 0);
  const sym = currencySymbol(displayCurrency);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0"
        style={{ borderLeftColor: stratDef.color, borderLeftWidth: 4 }}
      >
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-foreground">{stratDef.label}</h2>
          {target != null && (
            <Badge variant={totalWeight > target + 0.01 ? "danger" : "muted"} className="font-mono text-xs">
              {totalWeight.toFixed(1)}% / {target}%
            </Badge>
          )}
          <span className="text-xs text-muted-foreground hidden sm:block">{stratDef.description}</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
          {holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <TrendingUp size={24} className="text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">No positions in this section yet.</p>
            </div>
          ) : (
            <>
              {/* Analytics charts */}
              <div className="flex flex-col md:flex-row gap-4">
                <AnalyticsCard
                  data={volatilityData}
                  title="Volatility Breakdown"
                  Icon={TrendingUp}
                />
                <AnalyticsCard
                  data={sectorData}
                  title="Sector Breakdown"
                  Icon={Tag}
                />
              </div>

              {/* Holdings table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/20">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Holdings — {holdings.length} position{holdings.length !== 1 ? "s" : ""}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-xs">
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Ticker</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Company</th>
                        <th className="text-right px-5 py-3 font-medium text-muted-foreground">Weight</th>
                        {totalCapital > 0 && (
                          <th className="text-right px-5 py-3 font-medium text-muted-foreground">Amount</th>
                        )}
                        {showEntryDate && (
                          <th className="text-left px-5 py-3 font-medium text-muted-foreground">Entry</th>
                        )}
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Volatility</th>
                        <th className="text-left px-5 py-3 font-medium text-muted-foreground">Sectors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h) => {
                        const stock = stockMap[h.ticker];
                        const weight = Number(h.weight);
                        const amount = totalCapital ? (totalCapital * weight) / 100 : null;
                        const vol = stock?.fact_sheet?.volatilityTier;
                        const tags = stock?.fact_sheet?.tags || [];

                        return (
                          <tr
                            key={h.id || h.ticker}
                            className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-5 py-3 font-mono font-bold text-foreground">
                              {h.ticker}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground text-xs">
                              {stock?.fact_sheet?.name || "—"}
                            </td>
                            <td className="px-5 py-3 text-right font-mono font-semibold text-foreground tabular-nums">
                              {weight.toFixed(1)}%
                            </td>
                            {totalCapital > 0 && (
                              <td className="px-5 py-3 text-right font-mono text-muted-foreground tabular-nums text-xs">
                                {amount
                                  ? `${sym}${Math.round(amount).toLocaleString("en-GB")}`
                                  : "—"}
                              </td>
                            )}
                            {showEntryDate && (
                              <td className="px-5 py-3 text-xs text-muted-foreground tabular-nums">
                                {h.entry_date
                                  ? new Date(h.entry_date).toLocaleDateString("en-GB", {
                                      day: "2-digit", month: "short", year: "2-digit",
                                    })
                                  : "—"}
                              </td>
                            )}
                            <td className="px-5 py-3">
                              {vol ? (
                                <Badge variant={volatilityVariant(vol)} className="text-[10px] py-0">
                                  {vol}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/40 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex flex-wrap gap-1">
                                {tags.length > 0
                                  ? tags.map((t) => (
                                    <Badge key={t} variant="outline" className="text-[10px] py-0">
                                      {t}
                                    </Badge>
                                  ))
                                  : <span className="text-muted-foreground/40 text-xs">—</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
