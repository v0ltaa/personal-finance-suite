import { useState, useEffect, useMemo } from "react";
import { C, fonts, fmt, fmtK, scenarioColors } from "../lib/tokens";
import { runProjection, calcStampDuty } from "../lib/calc";
import { useIsMobile, useAuth } from "../lib/hooks";
import { loadAllScenarios } from "../lib/supabase";
import InteractiveChart from "../components/InteractiveChart";
import Stat from "../components/Stat";

export default function Sandbox() {
  const mobile = useIsMobile();
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("wealth"); // "wealth" or "cost"

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadAllScenarios().then(({ data }) => {
      const full = (data || []).filter((s) => s.section === "full");
      setScenarios(full);
      setLoading(false);
    });
  }, [user]);

  const toggleScenario = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  // Run projections for selected scenarios
  const projections = useMemo(() => {
    return selected.map((id) => {
      const s = scenarios.find((x) => x.id === id);
      if (!s) return null;
      const cfg = s.config;
      const deposit = cfg.depositMode === "pct"
        ? cfg.propertyValue * (cfg.depositPct / 100)
        : cfg.depositCash;
      const stampDuty = cfg.stampDutyOverride != null
        ? cfg.stampDutyOverride
        : calcStampDuty(cfg.propertyValue, cfg.isFirstTimeBuyer);
      const result = runProjection({ ...cfg, deposit, stampDuty });
      return { ...s, result };
    }).filter(Boolean);
  }, [selected, scenarios]);

  // Build combined chart data
  const chartData = useMemo(() => {
    if (projections.length === 0) return null;
    const maxLen = Math.max(...projections.map((p) =>
      viewMode === "wealth" ? p.result.wD.length : p.result.cD.length
    ));
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      const point = { month: i };
      projections.forEach((p, pi) => {
        const src = viewMode === "wealth" ? p.result.wD : p.result.cD;
        if (i < src.length) {
          if (viewMode === "wealth") {
            point[`buy_${pi}`] = src[i].buyWealth;
            point[`rent_${pi}`] = src[i].rentWealth;
          } else {
            point[`buy_${pi}`] = src[i].buyCost;
            point[`rent_${pi}`] = src[i].rentCost;
          }
        }
      });
      data.push(point);
    }
    return data;
  }, [projections, viewMode]);

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, marginBottom: 12 }}>Sandbox</h2>
        <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>
          Sign in to compare saved scenarios side-by-side.
        </p>
      </div>
    );
  }

  const btnStyle = (active) => ({
    padding: "6px 14px", border: `1.5px solid ${active ? C.text : C.border}`,
    borderRadius: 0, background: active ? C.text : "transparent",
    color: active ? C.bg : C.textMid, fontSize: 11, fontWeight: 600,
    cursor: "pointer", fontFamily: fonts.sans, textTransform: "uppercase",
  });

  return (
    <div>
      <h2 style={{ fontFamily: fonts.serif, fontWeight: 400, color: C.text, margin: "0 0 8px 0", fontSize: mobile ? 24 : 32 }}>
        Scenario Sandbox
      </h2>
      <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic", margin: "0 0 28px 0" }}>
        Select up to 4 saved scenarios to compare their projections.
      </p>

      {loading && <div style={{ color: C.textLight }}>Loading scenarios...</div>}

      {!loading && scenarios.length === 0 && (
        <div style={{
          padding: 32, border: `1.5px dashed ${C.border}`, textAlign: "center",
        }}>
          <p style={{ fontFamily: fonts.serif, color: C.textMid, fontStyle: "italic" }}>
            No full scenarios saved yet. Go to Buy vs Rent, configure your inputs, then click "Save All Inputs".
          </p>
        </div>
      )}

      {/* Scenario picker */}
      {scenarios.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
          {scenarios.map((s, i) => {
            const isSelected = selected.includes(s.id);
            const colorIdx = selected.indexOf(s.id);
            return (
              <button key={s.id} onClick={() => toggleScenario(s.id)} style={{
                padding: "10px 18px",
                border: `2px solid ${isSelected ? scenarioColors[colorIdx] : C.border}`,
                borderRadius: 0,
                background: isSelected ? scenarioColors[colorIdx] + "10" : "transparent",
                color: isSelected ? scenarioColors[colorIdx] : C.textMid,
                fontSize: 13, fontWeight: isSelected ? 600 : 400, cursor: "pointer",
                fontFamily: fonts.serif, transition: "all 0.15s",
              }}>
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* View mode toggle */}
      {projections.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            <button onClick={() => setViewMode("wealth")} style={btnStyle(viewMode === "wealth")}>Wealth</button>
            <button onClick={() => setViewMode("cost")} style={btnStyle(viewMode === "cost")}>Cost</button>
          </div>

          {/* Stats comparison */}
          <div style={{ overflowX: "auto", marginBottom: 28 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 12px", fontSize: 10, fontFamily: fonts.sans, color: C.textLight, fontWeight: 600, textAlign: "left", borderBottom: `2px solid ${C.text}`, letterSpacing: "0.06em" }}>Metric</th>
                  {projections.map((p, i) => (
                    <th key={p.id} style={{ padding: "8px 12px", fontSize: 12, fontFamily: fonts.serif, color: scenarioColors[i], fontWeight: 600, textAlign: "center", borderBottom: `2px solid ${C.text}` }}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Property Value", fn: (p) => fmt(p.config.propertyValue) },
                  { label: "Monthly Rent", fn: (p) => fmt(p.config.monthlyRent) },
                  { label: "Final Buy Wealth", fn: (p) => fmt(Math.round(p.result.wD[p.result.wD.length - 1].buyWealth)) },
                  { label: "Final Rent Wealth", fn: (p) => fmt(Math.round(p.result.wD[p.result.wD.length - 1].rentWealth)) },
                  { label: "Cost Break-Even", fn: (p) => p.result.costBE ? `${(p.result.costBE / 12).toFixed(1)} yrs` : "N/A" },
                  { label: "Wealth Break-Even", fn: (p) => p.result.wBE ? `${(p.result.wBE / 12).toFixed(1)} yrs` : "N/A" },
                ].map((row) => (
                  <tr key={row.label}>
                    <td style={{ padding: "9px 12px", fontSize: 12, fontFamily: fonts.sans, color: C.textMid, borderBottom: `1px solid ${C.borderLight}` }}>{row.label}</td>
                    {projections.map((p, i) => (
                      <td key={p.id} style={{ padding: "9px 12px", fontSize: 14, fontFamily: fonts.serif, color: C.text, textAlign: "center", borderBottom: `1px solid ${C.borderLight}` }}>
                        {row.fn(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Overlay chart */}
          {chartData && (
            <InteractiveChart
              mobile={mobile}
              data={chartData}
              keys={projections.flatMap((_, i) => [`buy_${i}`, `rent_${i}`])}
              colors={projections.flatMap((_, i) => [scenarioColors[i], scenarioColors[i] + "80"])}
              labels={projections.flatMap((p, i) => [`${p.name} (Buy)`, `${p.name} (Rent)`])}
              title={viewMode === "wealth" ? "Wealth Comparison" : "Cost Comparison"}
            />
          )}
        </>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 48, borderTop: `2px solid ${C.text}`, paddingTop: 16,
        display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 10, color: C.textLight, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>Personal Finance Suite</span>
        <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.15em", textTransform: "uppercase" }}>Sandbox</span>
      </div>
    </div>
  );
}
