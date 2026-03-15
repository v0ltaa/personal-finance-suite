// ── Design tokens ──
export const C = {
  bg: "#ffffff", card: "#fff", border: "#e5e5e5", borderLight: "#f0f0f0",
  text: "#1a1a1a", textMid: "#666", textLight: "#999", textFaint: "#ccc",
  accent: "#1a1a1a", accentLight: "rgba(26,26,26,0.06)",
  green: "#2a7d2a", greenBg: "rgba(42,125,42,0.06)", greenBorder: "rgba(42,125,42,0.15)",
  red: "#c44", redBg: "rgba(204,68,68,0.06)", redBorder: "rgba(204,68,68,0.15)",
  amber: "#c07d00",
  pill: "#1a1a1a", pillText: "#fff",
};
export const fonts = { serif: "'Instrument Serif', serif", sans: "'Instrument Sans', sans-serif" };

export const fmt = (n) => "£" + Math.round(n).toLocaleString("en-GB");
export const fmtK = (n) => {
  if (Math.abs(n) >= 1e6) return "£" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "£" + (n / 1e3).toFixed(0) + "k";
  return "£" + Math.round(n);
};

// ── Presets ──
export const hpPresets = [
  { label: "Conservative", value: 2, desc: "Below long-term average" },
  { label: "UK Average", value: 3.5, desc: "~3.5% long-term UK average" },
  { label: "City Growth", value: 5, desc: "Birmingham / Manchester tier" },
  { label: "Optimistic", value: 7, desc: "High-demand area" },
];
export const invPresets = [
  { label: "Cash ISA", value: 4.5, desc: "Current best easy-access rates" },
  { label: "Bonds", value: 5, desc: "UK gilt / bond fund average" },
  { label: "Global Index", value: 7, desc: "MSCI World long-term avg" },
  { label: "S&P 500", value: 10, desc: "US large cap long-term avg" },
];

// Chart color palette for scenario comparison
export const scenarioColors = [
  "#2a7d2a", "#c44", "#b8860b", "#4a6fa5", "#8b5cf6", "#059669"
];
