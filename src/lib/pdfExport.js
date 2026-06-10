import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ── Constants ──────────────────────────────────────────────────────────────

const STRATEGIES_DEF = [
  { key: "buy_and_hold", label: "Buy & Hold",  color: [196, 80, 58]  },
  { key: "fortress",     label: "Fortress",    color: [90, 171, 204] },
  { key: "slingshot",    label: "Slingshot",   color: [244, 166, 54] },
];

const STOCK_COLORS = [
  "#c4503a", "#5aabcc", "#7bc47c", "#f4a636", "#9b5fc0",
  "#4a90d9", "#e07b54", "#22d3ee", "#a78bfa", "#fb923c",
  "#34d399", "#f87171", "#818cf8", "#fbbf24", "#60a5fa",
];

const VOL_COLORS = {
  Low: "#7bc47c", Medium: "#f4a636", High: "#c4503a", Unknown: "#94a3b8",
};

const SECTOR_COLORS = [
  "#c4503a", "#5aabcc", "#7bc47c", "#f4a636", "#9b5fc0",
  "#4a90d9", "#e07b54", "#22d3ee", "#a78bfa", "#fb923c",
  "#34d399", "#f87171", "#818cf8", "#fbbf24", "#60a5fa",
];

// ── Data builders ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [128, 128, 128];
}

function buildStocksChartData(holdings) {
  return holdings
    .filter((h) => Number(h.weight) > 0)
    .map((h, i) => ({ name: h.ticker, value: Number(h.weight), color: STOCK_COLORS[i % STOCK_COLORS.length] }));
}

function buildVolatilityChartData(holdings, stockMap) {
  const totals = {};
  holdings.forEach((h) => {
    const tier = stockMap[h.ticker]?.fact_sheet?.volatilityTier || "unknown";
    const key = tier.charAt(0).toUpperCase() + tier.slice(1);
    totals[key] = (totals[key] || 0) + (Number(h.weight) || 0);
  });
  return Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, color: VOL_COLORS[name] || "#94a3b8" }));
}

function buildSectorChartData(holdings, stockMap) {
  const totals = {};
  holdings.forEach((h) => {
    const weight = Number(h.weight) || 0;
    const tags = stockMap[h.ticker]?.fact_sheet?.tags;
    if (!tags || tags.length === 0) {
      totals["Other"] = (totals["Other"] || 0) + weight;
      return;
    }
    const share = weight / tags.length;
    tags.forEach((tag) => { totals[tag] = (totals[tag] || 0) + share; });
  });
  return Object.entries(totals)
    .filter(([, v]) => v > 0.01)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }));
}

// ── Donut chart drawing ────────────────────────────────────────────────────

function drawDonutSlice(doc, cx, cy, innerR, outerR, startAngle, endAngle, rgb) {
  const steps = Math.max(20, Math.ceil(Math.abs(endAngle - startAngle) * 14));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / steps);
    pts.push([cx + outerR * Math.cos(a), cy + outerR * Math.sin(a)]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = startAngle + (endAngle - startAngle) * (i / steps);
    pts.push([cx + innerR * Math.cos(a), cy + innerR * Math.sin(a)]);
  }
  doc.setFillColor(...rgb);
  const lines = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.lines(lines, pts[0][0], pts[0][1], [1, 1], "F", true);
}

function drawDonutChart(doc, cx, cy, innerR, outerR, data) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.4);
    doc.circle(cx, cy, outerR, "D");
    return;
  }
  const gap = data.length > 1 ? 0.06 : 0;
  let angle = -Math.PI / 2;
  data.forEach((slice) => {
    const portion = slice.value / total;
    const sweep = portion * Math.PI * 2 - gap;
    if (sweep > 0.02) {
      drawDonutSlice(doc, cx, cy, innerR, outerR, angle + gap / 2, angle + gap / 2 + sweep, hexToRgb(slice.color));
    }
    angle += portion * Math.PI * 2;
  });
}

// ── Layout helpers ─────────────────────────────────────────────────────────

function addPageHeader(doc, title, subtitle, accentColor) {
  const pageWidth = 210;
  const margin = 14;
  doc.setFillColor(...accentColor);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title, margin, 12);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, pageWidth - margin, 12, { align: "right" });
  return 28;
}

function addSectionHeading(doc, label, color, y) {
  doc.setFillColor(...color);
  doc.rect(14, y, 3, 6, "F");
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(label, 20, y + 4.5);
  return y + 11;
}

// Draws 3 donut charts side by side: Stocks | Volatility | Sectors
function addThreeCharts(doc, stocksData, volData, sectorData, y) {
  const margin = 14;
  const pageWidth = 210;
  const colW = (pageWidth - margin * 2) / 3;
  const outerR = 17;
  const innerR = 9;
  const chartCY = y + outerR + 6;
  const MAX_LEGEND = 12;

  const charts = [
    { title: "STOCKS",     data: stocksData },
    { title: "VOLATILITY", data: volData    },
    { title: "SECTORS",    data: sectorData },
  ];

  charts.forEach(({ title, data }, col) => {
    const leftX = margin + colW * col;
    const cx = leftX + colW / 2;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(110, 110, 110);
    doc.text(title, cx, y + 4, { align: "center" });

    drawDonutChart(doc, cx, chartCY, innerR, outerR, data);

    const legendStartY = chartCY + outerR + 5;
    data.slice(0, MAX_LEGEND).forEach((item, j) => {
      const ly = legendStartY + j * 4.5;
      doc.setFillColor(...hexToRgb(item.color));
      doc.circle(leftX + 3, ly, 1.4, "F");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(45, 45, 45);
      const label = item.name.length > 18 ? item.name.slice(0, 17) + "…" : item.name;
      doc.text(label, leftX + 7, ly + 0.5);
      doc.setTextColor(110, 110, 110);
      doc.text(`${item.value.toFixed(1)}%`, leftX + colW - 2, ly + 0.5, { align: "right" });
    });

    if (data.length > MAX_LEGEND) {
      const ly = legendStartY + MAX_LEGEND * 4.5;
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(160, 160, 160);
      doc.text(`+${data.length - MAX_LEGEND} more`, leftX + 3, ly);
    }
  });

  const maxRows = Math.min(MAX_LEGEND, Math.max(stocksData.length, volData.length, sectorData.length));
  const hasOverflow = stocksData.length > MAX_LEGEND || volData.length > MAX_LEGEND || sectorData.length > MAX_LEGEND;
  return chartCY + outerR + 5 + maxRows * 4.5 + (hasOverflow ? 6 : 0) + 7;
}

// ── Exports ────────────────────────────────────────────────────────────────

export function exportPortfolioPdf({ holdings, stocks, totalCapital, activeMode, buyHoldPct, displayCurrency }) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const margin = 14;
  const stockMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));
  const dateStr = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  const activePct = 100 - buyHoldPct;
  const sym = displayCurrency === "GBP" ? "£" : displayCurrency === "USD" ? "$" : displayCurrency === "EUR" ? "€" : "";

  let y = addPageHeader(doc, "Portfolio Report", dateStr, [196, 80, 58]);

  const capitalStr = totalCapital ? `${sym}${Math.round(totalCapital).toLocaleString("en-GB")}` : "Not set";
  const modeName = activeMode ? activeMode.charAt(0).toUpperCase() + activeMode.slice(1) : "—";
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(
    `Portfolio Value: ${capitalStr}   ·   Active Mode: ${modeName}   ·   Allocation: ${buyHoldPct}% Buy & Hold / ${activePct}% Active`,
    margin, y
  );
  y += 12;

  // ── Total Portfolio ──────────────────────────────────────────────────────

  y = addSectionHeading(doc, "Total Portfolio", [50, 50, 50], y);

  const bhMap     = Object.fromEntries((holdings.buy_and_hold || []).map((h) => [h.ticker, h]));
  const fMap      = Object.fromEntries((holdings.fortress    || []).map((h) => [h.ticker, h]));
  const sMap      = Object.fromEntries((holdings.slingshot   || []).map((h) => [h.ticker, h]));
  const allTickers = [...new Set([
    ...(holdings.buy_and_hold || []).map((h) => h.ticker),
    ...(holdings.fortress    || []).map((h) => h.ticker),
    ...(holdings.slingshot   || []).map((h) => h.ticker),
  ])];

  const totalColumns = ["Ticker", "Company", "B&H %", "Fortress %", "Slingshot %", "Total %"];
  if (totalCapital) totalColumns.push("Amount");

  const totalRows = allTickers.map((ticker) => {
    const stock = stockMap[ticker];
    const bh  = bhMap[ticker] ? Number(bhMap[ticker].weight) : 0;
    const ft  = fMap[ticker]  ? Number(fMap[ticker].weight)  : 0;
    const sl  = sMap[ticker]  ? Number(sMap[ticker].weight)  : 0;
    const tot = bh + ft + sl;
    const row = [
      ticker,
      stock?.fact_sheet?.name || "—",
      bh  > 0 ? `${bh.toFixed(1)}%`  : "—",
      ft  > 0 ? `${ft.toFixed(1)}%`  : "—",
      sl  > 0 ? `${sl.toFixed(1)}%`  : "—",
      `${tot.toFixed(1)}%`,
    ];
    if (totalCapital) row.push(`${sym}${Math.round((totalCapital * tot) / 100).toLocaleString("en-GB")}`);
    return row;
  });

  if (totalRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [totalColumns],
      body: totalRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      theme: "striped",
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Charts for the combined portfolio
  const combinedHoldings = allTickers.map((ticker) => ({
    ticker,
    weight: (bhMap[ticker] ? Number(bhMap[ticker].weight) : 0)
          + (fMap[ticker]  ? Number(fMap[ticker].weight)  : 0)
          + (sMap[ticker]  ? Number(sMap[ticker].weight)  : 0),
  })).filter((h) => h.weight > 0);

  if (combinedHoldings.length > 0) {
    if (y > 210) { doc.addPage(); y = 16; }
    y = addThreeCharts(
      doc,
      buildStocksChartData(combinedHoldings),
      buildVolatilityChartData(combinedHoldings, stockMap),
      buildSectorChartData(combinedHoldings, stockMap),
      y
    );
  }

  // ── Individual strategies ────────────────────────────────────────────────

  STRATEGIES_DEF.forEach(({ key, label, color }) => {
    const stratHoldings = holdings[key] || [];
    if (stratHoldings.length === 0) return;

    if (y > 215) { doc.addPage(); y = 16; }

    y = addSectionHeading(doc, label, color, y);

    const columns = ["Ticker", "Company", "Weight", ...(totalCapital ? ["Amount"] : []), "Volatility", "Entry"];
    const rows = stratHoldings.map((h) => {
      const stock = stockMap[h.ticker];
      const weight = Number(h.weight);
      const amount = totalCapital ? `${sym}${Math.round((totalCapital * weight) / 100).toLocaleString("en-GB")}` : null;
      const vol = stock?.fact_sheet?.volatilityTier || "—";
      const entry = h.entry_date
        ? new Date(h.entry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
        : "—";
      return [h.ticker, stock?.fact_sheet?.name || "—", `${weight.toFixed(1)}%`, ...(totalCapital ? [amount] : []), vol, entry];
    });

    autoTable(doc, {
      startY: y,
      head: [columns],
      body: rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: color, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      theme: "striped",
    });

    y = doc.lastAutoTable.finalY + 6;

    const stocksData = buildStocksChartData(stratHoldings);
    const volData    = buildVolatilityChartData(stratHoldings, stockMap);
    const sectorData = buildSectorChartData(stratHoldings, stockMap);

    if (stocksData.length > 0) {
      if (y > 210) { doc.addPage(); y = 16; }
      y = addThreeCharts(doc, stocksData, volData, sectorData, y);
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(`Generated ${dateStr}`, margin, 292);
    doc.text(`Page ${i} of ${pageCount}`, 210 - margin, 292, { align: "right" });
  }

  doc.save(`portfolio-report-${new Date().toISOString().split("T")[0]}.pdf`);
}

export function exportSandboxPdf({ sandbox, stocks }) {
  if (!sandbox) return;
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const margin = 14;
  const stockMap = Object.fromEntries(stocks.map((s) => [s.ticker, s]));
  const dateStr = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  const totalWeight = sandbox.holdings.reduce((s, h) => s + (Number(h.weight) || 0), 0);

  let y = addPageHeader(doc, `Sandbox: ${sandbox.name}`, dateStr, [90, 171, 204]);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(`Total Weight: ${totalWeight.toFixed(1)}%   ·   Holdings: ${sandbox.holdings.length}`, margin, y);
  y += 9;

  STRATEGIES_DEF.forEach(({ key, label, color }) => {
    const stratHoldings = sandbox.holdings.filter((h) => (h.sectionOverride || "buy_and_hold") === key);
    if (stratHoldings.length === 0) return;

    if (y > 215) { doc.addPage(); y = 16; }

    y = addSectionHeading(doc, label, color, y);

    const rows = stratHoldings.map((h) => {
      const stock = stockMap[h.ticker];
      const vol  = stock?.fact_sheet?.volatilityTier || "—";
      const tags = (stock?.fact_sheet?.tags || []).join(", ") || "—";
      return [h.ticker, stock?.fact_sheet?.name || "—", `${Number(h.weight).toFixed(1)}%`, vol, tags];
    });

    autoTable(doc, {
      startY: y,
      head: [["Ticker", "Company", "Weight", "Volatility", "Sectors / Tags"]],
      body: rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: color, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      theme: "striped",
    });

    y = doc.lastAutoTable.finalY + 6;

    const stocksData = buildStocksChartData(stratHoldings);
    const volData    = buildVolatilityChartData(stratHoldings, stockMap);
    const sectorData = buildSectorChartData(stratHoldings, stockMap);

    if (stocksData.length > 0) {
      if (y > 210) { doc.addPage(); y = 16; }
      y = addThreeCharts(doc, stocksData, volData, sectorData, y);
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(`Generated ${dateStr}`, margin, 292);
    doc.text(`Page ${i} of ${pageCount}`, 210 - margin, 292, { align: "right" });
  }

  doc.save(`sandbox-${sandbox.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`);
}
