import { useState, useRef, useMemo } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { fmtK } from "../lib/tokens";
import { cn } from "../lib/utils";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend, zoomPlugin
);

// Brand color resolved from CSS variable at runtime
function getBrandColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--brand").trim()
    ? `hsl(${getComputedStyle(document.documentElement).getPropertyValue("--brand").trim()})`
    : "#c26540";
}

function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    border: `hsl(${style.getPropertyValue("--border").trim()})`,
    muted: `hsl(${style.getPropertyValue("--muted-foreground").trim()})`,
    faint: `hsl(${style.getPropertyValue("--muted-foreground").trim()})`,
    card: `hsl(${style.getPropertyValue("--card").trim()})`,
    fg: `hsl(${style.getPropertyValue("--foreground").trim()})`,
    brand: `hsl(${style.getPropertyValue("--brand").trim()})`,
  };
}

function resolveColor(color) {
  const match = color?.match(/^var\(--([^)]+)\)$/);
  if (!match) return color;
  const val = getComputedStyle(document.documentElement).getPropertyValue(`--${match[1]}`).trim();
  return val ? `hsl(${val})` : color;
}

function withAlpha(color, alpha) {
  if (color?.startsWith("hsl(")) {
    return color.slice(0, -1) + ` / ${alpha})`;
  }
  if (color?.startsWith("#") && color.length === 7) {
    return color + Math.round(alpha * 255).toString(16).padStart(2, "0");
  }
  return color;
}

const breakEvenPlugin = {
  id: "breakEvenLine",
  afterDraw(chart) {
    const meta = chart.options.plugins.breakEvenLine;
    if (!meta?.month || meta.month < 0) return;
    const { ctx, chartArea: { top }, scales: { x } } = chart;
    const xPos = x.getPixelForValue(meta.month);
    if (xPos < x.left || xPos > x.right) return;
    const cc = getChartColors();
    ctx.save();
    ctx.strokeStyle = cc.brand;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xPos, top);
    ctx.lineTo(xPos, chart.chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cc.brand;
    ctx.font = `600 11px "Instrument Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(meta.label || "Break-even", xPos, top - 8);
    ctx.restore();
  },
};

const markersPlugin = {
  id: "chartMarkers",
  afterDraw(chart) {
    const items = chart.options.plugins.chartMarkers?.items;
    if (!items?.length) return;
    const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
    const cc = getChartColors();
    const padding = 5;
    const badgeHeight = 18;
    const fontSize = 10;
    items.forEach((m, i) => {
      if (m.index < 0) return;
      const xPos = x.getPixelForValue(m.index);
      if (xPos < x.left || xPos > x.right) return;
      const color = m.color || cc.faint;
      ctx.save();
      // Dashed vertical line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      // Pill badge inside chart at top of line, stacked per marker
      const label = m.label || `${i + 1}`;
      const text = m.text ? `${label}  ${m.text}` : label;
      ctx.font = `600 ${fontSize}px "Instrument Sans", sans-serif`;
      const textW = ctx.measureText(text).width;
      const badgeW = textW + padding * 2;
      const yTop = top + 6 + i * (badgeHeight + 4);
      // Clamp x so badge stays inside chart area
      const bx = Math.max(x.left + 2, Math.min(xPos - badgeW / 2, x.right - badgeW - 2));
      // Badge background
      ctx.fillStyle = color + "22";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const r = 4;
      ctx.beginPath();
      ctx.roundRect(bx, yTop, badgeW, badgeHeight, r);
      ctx.fill();
      ctx.stroke();
      // Badge text
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, bx + padding, yTop + badgeHeight / 2);
      ctx.restore();
    });
  },
};
ChartJS.register(breakEvenPlugin, markersPlugin);

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthToDate(monthOffset) {
  const now = new Date();
  const m = now.getMonth() + monthOffset;
  const year = now.getFullYear() + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${MONTH_NAMES[month]} ${year}`;
}

function ChartBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-md text-[9px] font-semibold uppercase tracking-wide transition-colors duration-150",
        active
          ? "bg-foreground text-background"
          : "bg-transparent text-muted-foreground border border-border hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export default function InteractiveChart({
  data, keys, colors, labels, title,
  breakEvenMonth, annotation, markers, mobile, formatY = fmtK,
  inflationAdjusted = false,
}) {
  const [chartType, setChartType] = useState("line");
  const [granularity, setGranularity] = useState("monthly");
  const [yearFrom, setYearFrom] = useState(0);
  const [yearTo, setYearTo] = useState(null);
  const chartRef = useRef(null);

  const maxMonth = data.length > 0 ? data[data.length - 1].month : 0;
  const maxYear = Math.floor(maxMonth / 12);
  const effectiveYearTo = yearTo ?? maxYear;

  const processed = useMemo(() => {
    const fromM = yearFrom * 12;
    const toM = effectiveYearTo * 12;
    let filtered = data.filter((d) => d.month >= fromM && d.month <= toM);
    if (granularity === "yearly") {
      filtered = filtered.filter((d) => d.month % 12 === 0);
    }
    return filtered;
  }, [data, granularity, yearFrom, effectiveYearTo]);

  if (!processed || processed.length < 2) return null;

  const cc = getChartColors();

  const chartLabels = processed.map((d) => monthToDate(d.month));

  const resolvedColors = colors.map(resolveColor);

  const datasets = keys.map((key, i) => ({
    label: labels?.[i] || key,
    data: processed.map((d) => Math.round(d[key])),
    borderColor: inflationAdjusted ? withAlpha(resolvedColors[i], 0.73) : resolvedColors[i],
    backgroundColor: i === 0
      ? (chartType === "bar" ? withAlpha(resolvedColors[i], 0.25) : withAlpha(resolvedColors[i], 0.06))
      : (chartType === "bar" ? withAlpha(resolvedColors[i], 0.25) : "transparent"),
    fill: chartType === "line" && i === 0,
    tension: 0.3,
    pointRadius: processed.length > 100 ? 0 : 2,
    pointHoverRadius: 5,
    borderWidth: chartType === "line" ? 2.5 : 0,
    borderDash: [],
  }));

  const chartData = { labels: chartLabels, datasets };

  const markerCount = markers?.length || 0;
  const options = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: mobile ? 1.3 : 2.2,
    layout: undefined,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: { family: "Instrument Sans", size: 11, weight: "600" },
          color: cc.muted,
          boxWidth: 14, boxHeight: 2, padding: 16,
        },
      },
      tooltip: {
        backgroundColor: cc.fg,
        titleFont: { family: "Instrument Sans", size: 11 },
        bodyFont: { family: "Instrument Serif", size: 13 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: (items) => {
            const d = processed[items[0].dataIndex];
            const yr = (d.month / 12).toFixed(1);
            return `${monthToDate(d.month)} — Year ${yr}`;
          },
          label: (item) => ` ${item.dataset.label}: ${formatY(item.raw)}`,
        },
      },
      zoom: {
        pan: { enabled: true, mode: "x" },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
      },
      breakEvenLine: {
        month: breakEvenMonth != null ? processed.findIndex((d) => d.month >= breakEvenMonth) : -1,
        label: annotation || (breakEvenMonth != null ? `Break-even: Yr ${(breakEvenMonth / 12).toFixed(1)}` : ""),
      },
      chartMarkers: {
        items: (markers || []).map((m) => ({
          ...m,
          index: processed.findIndex((d) => d.month >= m.month),
        })),
      },
    },
    scales: {
      x: {
        grid: { color: cc.border + "55" },
        ticks: { font: { family: "Instrument Sans", size: 10 }, color: cc.faint, maxTicksLimit: mobile ? 6 : 12 },
      },
      y: {
        grid: { color: cc.border + "55" },
        ticks: { font: { family: "Instrument Sans", size: 10 }, color: cc.faint, callback: (v) => formatY(v) },
        title: inflationAdjusted ? {
          display: true, text: "Value (in today's £)",
          font: { family: "Instrument Sans", size: 9 }, color: cc.faint,
        } : { display: false },
      },
    },
  };

  const resetZoom = () => chartRef.current?.resetZoom();
  const ChartComp = chartType === "bar" ? Bar : Line;

  return (
    <div className="mt-5 mb-3">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          {inflationAdjusted && (
            <span className="text-[9px] font-semibold uppercase tracking-wide text-brand bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded-md">
              Real terms
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-1.5 mb-3 items-center">
        <ChartBtn active={chartType === "line"} onClick={() => setChartType("line")}>Line</ChartBtn>
        <ChartBtn active={chartType === "bar"} onClick={() => setChartType("bar")}>Bar</ChartBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ChartBtn active={granularity === "monthly"} onClick={() => setGranularity("monthly")}>Monthly</ChartBtn>
        <ChartBtn active={granularity === "yearly"} onClick={() => setGranularity("yearly")}>Yearly</ChartBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ChartBtn active={false} onClick={resetZoom}>Reset Zoom</ChartBtn>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-[9px] font-semibold uppercase text-muted-foreground">From Yr</label>
          <select
            value={yearFrom}
            onChange={(e) => setYearFrom(Number(e.target.value))}
            className="border border-border bg-card rounded px-2 py-1 text-xs text-foreground"
          >
            {Array.from({ length: maxYear + 1 }, (_, i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <label className="text-[9px] font-semibold uppercase text-muted-foreground">To Yr</label>
          <select
            value={effectiveYearTo}
            onChange={(e) => setYearTo(Number(e.target.value))}
            className="border border-border bg-card rounded px-2 py-1 text-xs text-foreground"
          >
            {Array.from({ length: maxYear + 1 }, (_, i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
      </div>

      <ChartComp ref={chartRef} data={chartData} options={options} />
    </div>
  );
}
