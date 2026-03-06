// ── Financial Calculations ──

export function calcStampDuty(price, ftb) {
  if (ftb) {
    if (price <= 425000) return 0;
    if (price <= 625000) return (price - 425000) * 0.05;
  }
  let duty = 0;
  const bands = [{ l: 250000, r: 0 }, { l: 925000, r: 0.05 }, { l: 1500000, r: 0.1 }, { l: Infinity, r: 0.12 }];
  let prev = 0;
  for (const b of bands) {
    if (price <= prev) break;
    const t = Math.min(price, b.l) - prev;
    if (t > 0) duty += t * b.r;
    prev = b.l;
  }
  return duty;
}

export function pmtCalc(principal, rate, years) {
  if (rate === 0 || years === 0 || principal <= 0) return 0;
  const r = rate / 100 / 12, n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function balCalc(principal, rate, years, mPaid) {
  if (principal <= 0) return 0;
  if (rate === 0) return Math.max(0, principal - (principal / (years * 12)) * mPaid);
  const r = rate / 100 / 12;
  const p = pmtCalc(principal, rate, years);
  return Math.max(0, principal * Math.pow(1 + r, mPaid) - p * ((Math.pow(1 + r, mPaid) - 1) / r));
}

/**
 * Run the full Buy vs Rent projection given a config object.
 * Returns { wD, cD, mC, costBE, wBE } — same shape as the old useMemo result.
 */
export function runProjection(cfg) {
  const {
    propertyValue, deposit, mortgageTerm, fixedRate, fixedPeriod, revertRate,
    monthlyRent, rentInflation, stampDuty, solicitorFees, surveyFees, movingCosts,
    maintenance, serviceCharge, buildingsInsurance, lifeInsurance, boilerCover, groundRent,
    estateAgentPct, sellingConveyancing, epcCost, houseGrowth, investReturn, horizonYears,
  } = cfg;

  const loanAmount = Math.max(0, propertyValue - deposit);
  const ongoingMonthly = maintenance + serviceCharge + buildingsInsurance + lifeInsurance + boilerCover + groundRent;
  const totalUpfront = deposit + stampDuty + solicitorFees + surveyFees + movingCosts;

  const months = horizonYears * 12, fM = fixedPeriod * 12, mM = mortgageTerm * 12;
  const p1 = pmtCalc(loanAmount, fixedRate, mortgageTerm);
  const bR = fM < mM ? balCalc(loanAmount, fixedRate, mortgageTerm, fM) : 0;
  const rT = Math.max(0, mortgageTerm - fixedPeriod);
  const p2 = rT > 0 ? pmtCalc(Math.max(0, bR), revertRate, rT) : 0;
  const mI = investReturn / 100 / 12, mH = houseGrowth / 100 / 12, mR = rentInflation / 100 / 12;
  let rW = totalUpfront, cB = totalUpfront, cR = 0, costBE = null, wBE = null;
  const wD = [], cD = [], mC = [];

  for (let m = 0; m <= months; m++) {
    const pV = propertyValue * Math.pow(1 + mH, m);
    let b = m === 0 ? loanAmount : m <= fM && m <= mM ? balCalc(loanAmount, fixedRate, mortgageTerm, m) : m <= mM ? balCalc(Math.max(0, bR), revertRate, rT, m - fM) : 0;
    b = Math.max(0, b);
    const sC = pV * (estateAgentPct * 1.2 / 100) + sellingConveyancing + epcCost;
    const nE = pV - b - sC;
    const mp = m > 0 && m <= mM ? (m <= fM ? p1 : p2) : 0;
    const bM = mp + ongoingMonthly;
    const rent = monthlyRent * Math.pow(1 + mR, m);
    if (m > 0) { cB += bM; cR += rent; rW *= (1 + mI); if (bM > rent) rW += bM - rent; }
    wD.push({ month: m, buyWealth: nE, rentWealth: rW });
    cD.push({ month: m, buyCost: cB - nE, rentCost: cR });
    if (m % 12 === 0) mC.push({ year: m / 12, buy: Math.round(bM), rent: Math.round(rent) });
    if (costBE === null && m > 0 && (cB - nE) < cR) costBE = m;
    if (wBE === null && m > 0 && nE > rW) wBE = m;
  }
  return { wD, cD, mC, costBE, wBE, loanAmount, ongoingMonthly, totalUpfront };
}

/** Default config values */
export const defaultConfig = {
  propertyValue: 250000, depositMode: "pct", depositPct: 10, depositCash: 25000,
  mortgageTerm: 25, fixedRate: 4.5, fixedPeriod: 5, revertRate: 5.5,
  monthlyRent: 1000, rentInflation: 4,
  isFirstTimeBuyer: true, stampDutyOverride: null,
  solicitorFees: 1500, surveyFees: 500, movingCosts: 1000,
  maintenance: 100, serviceCharge: 150, buildingsInsurance: 30,
  lifeInsurance: 25, boilerCover: 15, groundRent: 0,
  estateAgentPct: 1.5, sellingConveyancing: 1200, epcCost: 80,
  houseGrowth: 3.5, investReturn: 7, horizonYears: 25,
};

/** Slider ranges per field key */
export const sliderRanges = {
  propertyValue: { min: 50000, max: 2000000, step: 5000 },
  depositPct: { min: 0, max: 100, step: 1 },
  depositCash: { min: 0, max: 500000, step: 1000 },
  mortgageTerm: { min: 5, max: 40, step: 1 },
  fixedRate: { min: 0, max: 15, step: 0.1 },
  fixedPeriod: { min: 1, max: 10, step: 1 },
  revertRate: { min: 0, max: 15, step: 0.1 },
  monthlyRent: { min: 200, max: 5000, step: 50 },
  rentInflation: { min: 0, max: 15, step: 0.5 },
  solicitorFees: { min: 0, max: 5000, step: 100 },
  surveyFees: { min: 0, max: 2000, step: 50 },
  movingCosts: { min: 0, max: 5000, step: 100 },
  maintenance: { min: 0, max: 500, step: 10 },
  serviceCharge: { min: 0, max: 500, step: 10 },
  buildingsInsurance: { min: 0, max: 100, step: 5 },
  lifeInsurance: { min: 0, max: 100, step: 5 },
  boilerCover: { min: 0, max: 50, step: 5 },
  groundRent: { min: 0, max: 500, step: 10 },
  estateAgentPct: { min: 0, max: 5, step: 0.1 },
  sellingConveyancing: { min: 0, max: 3000, step: 100 },
  epcCost: { min: 0, max: 300, step: 10 },
  houseGrowth: { min: -5, max: 15, step: 0.5 },
  investReturn: { min: 0, max: 20, step: 0.5 },
  horizonYears: { min: 1, max: 40, step: 1 },
};
