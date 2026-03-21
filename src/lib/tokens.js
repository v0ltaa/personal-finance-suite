// ── Design tokens ──

export const darkTheme = {
  bg: "#0e0b0a", card: "#1a1410", border: "#2e2520", borderLight: "#231d18",
  text: "#e8ddd5", textMid: "#9a8880", textLight: "#6a5a54", textFaint: "#3d2e28",
  accent: "#c4503a", accentLight: "rgba(196,80,58,0.12)",
  green: "#5aabcc", greenBg: "rgba(90,171,204,0.10)", greenBorder: "rgba(90,171,204,0.22)",
  red: "#d45840", redBg: "rgba(212,88,64,0.10)", redBorder: "rgba(212,88,64,0.22)",
  amber: "#d09040",
  pill: "#c4503a", pillText: "#fdf5f0",
};

export const lightTheme = {
  bg: "#f5ede5", card: "#faf5f0", border: "#ddd0c6", borderLight: "#ece4db",
  text: "#1e1410", textMid: "#7a6258", textLight: "#a89490", textFaint: "#ccbfb8",
  accent: "#8c3520", accentLight: "rgba(140,53,32,0.06)",
  green: "#3a7fa8", greenBg: "rgba(58,127,168,0.07)", greenBorder: "rgba(58,127,168,0.18)",
  red: "#b83825", redBg: "rgba(184,56,37,0.07)", redBorder: "rgba(184,56,37,0.18)",
  amber: "#b07830",
  pill: "#8c3520", pillText: "#fdf7f3",
};

// Module-level theme state — light only
let _theme = "light";
export function _setTheme(t) { _theme = t; }
export function _getTheme() { return _theme; }

// Reactive proxy: all existing `import { C }` consumers stay unchanged;
// on re-render they automatically pick up the new theme.
export const C = new Proxy({}, {
  get(_, key) {
    return (_theme === "dark" ? darkTheme : lightTheme)[key];
  },
});

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

// Chart colors — brighter palette works on both light and dark
export const scenarioColors = [
  "#c4503a", "#5aabcc", "#d09040", "#8b6cc4", "#4aaa88", "#d4786a"
];
