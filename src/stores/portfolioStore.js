import { create } from "zustand";

const usePortfolioStore = create((set) => ({
  // ── State ──
  stocks: [],
  holdings: { buy_and_hold: [], fortress: [], slingshot: [] },
  indicatorLog: [],
  sandboxes: [],

  // ── FactSheet Modal (global, no prop-drilling) ──
  factSheetStock: null,
  factSheetOnRemove: null,
  factSheetEditMode: false,
  openFactSheet: (stock, { onRemove, editMode } = {}) =>
    set({ factSheetStock: stock, factSheetOnRemove: onRemove ?? null, factSheetEditMode: editMode ?? false }),
  closeFactSheet: () => set({ factSheetStock: null, factSheetOnRemove: null, factSheetEditMode: false }),
  updateFactSheetStock: (id, patch) =>
    set((s) =>
      s.factSheetStock?.id === id
        ? { factSheetStock: { ...s.factSheetStock, ...patch } }
        : {}
    ),

  // ── Stocks ──
  setStocks: (stocks) => set({ stocks }),
  addStock: (stock) => set((s) => ({ stocks: [...s.stocks, stock] })),
  removeStock: (ticker) =>
    set((s) => ({ stocks: s.stocks.filter((x) => x.ticker !== ticker) })),
  updateStockInStore: (id, patch) =>
    set((s) => ({ stocks: s.stocks.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

  // ── Holdings ──
  setHoldings: (holdings) => set({ holdings }),
  addHolding: (strategy, holding) =>
    set((s) => ({
      holdings: {
        ...s.holdings,
        [strategy]: [...(s.holdings[strategy] || []), holding],
      },
    })),
  removeHolding: (strategy, id) =>
    set((s) => ({
      holdings: {
        ...s.holdings,
        [strategy]: (s.holdings[strategy] || []).filter((h) => h.id !== id),
      },
    })),
  updateHoldingInStore: (strategy, id, patch) =>
    set((s) => ({
      holdings: {
        ...s.holdings,
        [strategy]: (s.holdings[strategy] || []).map((h) => h.id === id ? { ...h, ...patch } : h),
      },
    })),

  // ── Indicator Log ──
  setIndicatorLog: (indicatorLog) => set({ indicatorLog }),
  addIndicatorEntry: (entry) =>
    set((s) => ({ indicatorLog: [entry, ...s.indicatorLog] })),
  removeIndicatorEntry: (id) =>
    set((s) => ({ indicatorLog: s.indicatorLog.filter((e) => e.id !== id) })),

  // ── Sandboxes ──
  setSandboxes: (sandboxes) => set({ sandboxes }),
  saveSandbox: (sandbox) =>
    set((s) => {
      const existing = s.sandboxes.findIndex((sb) => sb.id === sandbox.id);
      if (existing >= 0) {
        const updated = [...s.sandboxes];
        updated[existing] = sandbox;
        return { sandboxes: updated };
      }
      return { sandboxes: [...s.sandboxes, sandbox] };
    }),
}));

export default usePortfolioStore;
