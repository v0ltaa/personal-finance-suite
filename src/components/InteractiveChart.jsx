import { useState, useRef, useMemo } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { C, fonts, fmtK } from "../lib/tokens";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend, zoomPlugin
);

// Annotation plugin for break-even line
const breakEvenPlugin = {
  id: "breakEvenLine",
  afterDraw(chart) {
    const meta = chart.options.plugins.breakEvenLine;
    if (!meta?.month || meta.month < 0) return;
    const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
    const xPos = x.getPixelForValue(meta.month);
    if (xPos < x.left || xPos > x.right) return;
    ctx.save();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xPos, top);
    ctx.lineTo(xPos, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.accent;
    ctx.font = `600 11px ${fonts.sans}`;
    ctx.textAlign = "center";
    ctx.fillText(meta.label || `Break-even`, xPos, top - 8);
    ctx.restore();
  },
};
ChartJS.register(breakEvenPlugin);

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthToDate(monthOffset) {
  const now = new Date();
  const m = now.getMonth() + monthOffset;
  const year = now.getFullYear() + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${MONTH_NAMES[month]} ${year}`;
}

export default function InteractiveChart({
  data, keys, colors, labels, title,
  breakEvenMonth, annotation, mobile, formatY = fmtK,
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

  // Filter + aggregate data based on granularity and year range
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

  const chartLabels = processed.map((d) =>
    granularity === "yearly" ? monthToDate(d.month) : monthToDate(d.month)
  );

  const datasets = keys.map((key, i) => ({
    label: labels?.[i] || key,
    data: processed.map((d) => Math.round(d[key])),
    borderColor: inflationAdjusted ? colors[i] + "bb" : colors[i],
    backgroundColor: i === 0
      ? (chartType === "bar" ? colors[i] + "40" : colors[i] + "10")
      : (chartType === "bar" ? colors[i] + "40" : "transparent"),
    fill: chartType === "line" && i === 0,
    tension: 0.3,
    pointRadius: processed.length > 100 ? 0 : 2,
    pointHoverRadius: 5,
    borderWidth: chartType === "line" ? 2.5 : 0,
    borderDash: inflationAdjusted && chartType === "line" ? [6, 4] : [],
  }));

  const chartData = { labels: chartLabels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: mobile ? 1.3 : 2.2,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: { family: fonts.sans, size: 11, weight: "600" },
          color: C.textMid,
          boxWidth: 14, boxHeight: 2, padding: 16,
        },
      },
      tooltip: {
        backgroundColor: C.text,
        titleFont: { family: fonts.sans, size: 11 },
        bodyFont: { family: fonts.serif, size: 13 },
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
        zoom: {
          wheel: { enabled: true }, pinch: { enabled: true },
          mode: "x",
        },
      },
      breakEvenLine: {
        month: breakEvenMonth != null ? processed.findIndex((d) => d.month >= breakEvenMonth) : -1,
        label: annotation || (breakEvenMonth != null ? `Break-even: Yr ${(breakEvenMonth / 12).toFixed(1)}` : ""),
      },
    },
    scales: {
      x: {
        grid: { color: C.borderLight },
        ticks: {
          font: { family: fonts.sans, size: 10 }, color: C.textFaint,
          maxTicksLimit: mobile ? 6 : 12,
        },
      },
      y: {
        grid: { color: C.borderLight },
        ticks: {
          font: { family: fonts.sans, size: 10 }, color: C.textFaint,
          callback: (v) => formatY(v),
        },
        title: inflationAdjusted ? {
          display: true,
          text: "Value (in today's £)",
          font: { family: fonts.sans, size: 9 },
          color: C.textFaint,
        } : { display: false },
      },
    },
  };

  const resetZoom = () => chartRef.current?.resetZoom();

  const ChartComp = chartType === "bar" ? Bar : Line;

  const btnStyle = (active) => ({
    padding: "4px 10px", border: `1px solid ${active ? C.text : C.border}`,
    borderRadius: 0, background: active ? C.text : "transparent",
    color: active ? C.bg : C.textMid, fontSize: 9, fontWeight: 600,
    cursor: "pointer", fontFamily: fonts.sans, textTransform: "uppercase",
    letterSpacing: "0.06em",
  });

  return (
    <div style={{ marginTop: 20, marginBottom: 12 }}>
      {title && (
        <div style={{ fontSize: 10, fontWeight: 600, color: C.textLight, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: fonts.sans, display: "flex", alignItems: "center", gap: 8 }}>
          {title}
          {inflationAdjusted && (
            <span style={{ fontSize: 9, fontWeight: 600, color: C.accent, background: C.accentLight, padding: "2px 6px", borderRadius: 2, textTransform: "uppercase", letterSpacing: "0.04em", border: `1px solid ${C.accent}33` }}>
              Real terms
            </span>
          )}
        </div>
      )}

      {/* Controls row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
        <button onClick={() => setChartType("line")} style={btnStyle(chartType === "line")}>Line</button>
        <button onClick={() => setChartType("bar")} style={btnStyle(chartType === "bar")}>Bar</button>
        <span style={{ width: 1, height: 18, background: C.border, margin: "0 4px" }} />
        <button onClick={() => setGranularity("monthly")} style={btnStyle(granularity === "monthly")}>Monthly</button>
        <button onClick={() => setGranularity("yearly")} style={btnStyle(granularity === "yearly")}>Yearly</button>
        <span style={{ width: 1, height: 18, background: C.border, margin: "0 4px" }} />
        <button onClick={resetZoom} style={btnStyle(false)}>Reset Zoom</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <label style={{ fontSize: 9, fontFamily: fonts.sans, color: C.textLight, fontWeight: 600, textTransform: "uppercase" }}>From Yr</label>
          <select value={yearFrom} onChange={(e) => setYearFrom(Number(e.target.value))} style={{ border: `1px solid ${C.border}`, background: C.card, padding: "3px 6px", fontSize: 11, fontFamily: fonts.sans, color: C.text }}>
            {Array.from({ length: maxYear + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <label style={{ fontSize: 9, fontFamily: fonts.sans, color: C.textLight, fontWeight: 600, textTransform: "uppercase" }}>To Yr</label>
          <select value={effectiveYearTo} onChange={(e) => setYearTo(Number(e.target.value))} style={{ border: `1px solid ${C.border}`, background: C.card, padding: "3px 6px", fontSize: 11, fontFamily: fonts.sans, color: C.text }}>
            {Array.from({ length: maxYear + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <ChartComp ref={chartRef} data={chartData} options={options} />
    </div>
  );
}
