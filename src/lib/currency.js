// ── Currency utilities ──────────────────────────────────────────────────────

export const CURRENCIES = {
  GBP: { symbol: "£",   name: "British Pound" },
  USD: { symbol: "$",   name: "US Dollar" },
  HKD: { symbol: "HK$", name: "Hong Kong Dollar" },
  ZAR: { symbol: "R",   name: "South African Rand" },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES);

const RATES_KEY    = "fx_rates_cache";
const EXPIRY_KEY   = "fx_rates_expiry";
const DISPLAY_KEY  = "display_currency";

export const currencySymbol = (code) => CURRENCIES[code]?.symbol || code;
export const currencyName   = (code) => CURRENCIES[code]?.name   || code;

export const getDisplayCurrency = () =>
  localStorage.getItem(DISPLAY_KEY) || "GBP";

export const setDisplayCurrency = (code) =>
  localStorage.setItem(DISPLAY_KEY, code);

// Fallback rates if API is unreachable
const FALLBACK_RATES = { GBP: 1, USD: 1.27, HKD: 9.9, ZAR: 23.5 };

export async function fetchRates() {
  // Return cached rates if still fresh (24 h)
  const expiry = Number(localStorage.getItem(EXPIRY_KEY) || 0);
  if (Date.now() < expiry) {
    try {
      const cached = JSON.parse(localStorage.getItem(RATES_KEY) || "null");
      if (cached && Object.keys(cached).length > 0) return cached;
    } catch { /* ignore */ }
  }
  try {
    const res  = await fetch("https://open.er-api.com/v6/latest/GBP");
    const json = await res.json();
    if (json.result === "success") {
      localStorage.setItem(RATES_KEY,   JSON.stringify(json.rates));
      localStorage.setItem(EXPIRY_KEY,  String(Date.now() + 24 * 3600 * 1000));
      return json.rates;
    }
  } catch { /* fall through */ }
  return FALLBACK_RATES;
}

/** Convert amount in `fromCurrency` → GBP */
export function toGBP(amount, fromCurrency, rates) {
  if (!amount || fromCurrency === "GBP") return Number(amount) || 0;
  const rate = rates?.[fromCurrency] || FALLBACK_RATES[fromCurrency] || 1;
  return (Number(amount) || 0) / rate;
}

/** Convert a GBP amount → `toCurrency` */
export function fromGBP(gbpAmount, toCurrency, rates) {
  if (!toCurrency || toCurrency === "GBP") return gbpAmount;
  const rate = rates?.[toCurrency] || FALLBACK_RATES[toCurrency] || 1;
  return gbpAmount * rate;
}

/** Format a GBP amount in the display currency */
export function fmtCurrency(gbpAmount, displayCurrency, rates) {
  const amount    = fromGBP(gbpAmount || 0, displayCurrency, rates);
  const sym       = currencySymbol(displayCurrency || "GBP");
  const abs       = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString("en-GB");
  return (amount < 0 ? "−" : "") + sym + formatted;
}
