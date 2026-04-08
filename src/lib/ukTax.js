// ── UK Tax Calculations 2025/26 ──

const PERSONAL_ALLOWANCE = 12570;
const BASIC_LIMIT = 50270;
const HIGHER_LIMIT = 125140;
const PA_TAPER_START = 100000;

const NI_PRIMARY_THRESHOLD = 12570;
const NI_UPPER_LIMIT = 50270;
const NI_RATE_BASIC = 0.08;
const NI_RATE_UPPER = 0.02;

const STUDENT_LOANS = {
  none: null,
  plan1: { threshold: 24990, rate: 0.09 },
  plan2: { threshold: 27295, rate: 0.09 },
  plan4: { threshold: 31395, rate: 0.09 },
  plan5: { threshold: 25000, rate: 0.09 },
  postgrad: { threshold: 21000, rate: 0.06 },
};

function personalAllowance(grossIncome) {
  if (grossIncome <= PA_TAPER_START) return PERSONAL_ALLOWANCE;
  const reduction = Math.floor((grossIncome - PA_TAPER_START) / 2);
  return Math.max(0, PERSONAL_ALLOWANCE - reduction);
}

export function calcIncomeTax(taxableIncome) {
  const pa = personalAllowance(taxableIncome);
  let remaining = Math.max(0, taxableIncome - pa);
  let tax = 0;

  // Basic rate: 20%
  const basicBand = Math.max(0, BASIC_LIMIT - pa);
  const basicTaxable = Math.min(remaining, basicBand);
  tax += basicTaxable * 0.2;
  remaining -= basicTaxable;

  // Higher rate: 40%
  const higherBand = HIGHER_LIMIT - BASIC_LIMIT;
  const higherTaxable = Math.min(remaining, higherBand);
  tax += higherTaxable * 0.4;
  remaining -= higherTaxable;

  // Additional rate: 45%
  tax += remaining * 0.45;

  return tax;
}

export function calcNI(grossIncome) {
  if (grossIncome <= NI_PRIMARY_THRESHOLD) return 0;
  let ni = 0;
  const basicNI = Math.min(grossIncome, NI_UPPER_LIMIT) - NI_PRIMARY_THRESHOLD;
  ni += Math.max(0, basicNI) * NI_RATE_BASIC;
  if (grossIncome > NI_UPPER_LIMIT) {
    ni += (grossIncome - NI_UPPER_LIMIT) * NI_RATE_UPPER;
  }
  return ni;
}

export function calcStudentLoan(grossIncome, plan) {
  const loan = STUDENT_LOANS[plan];
  if (!loan) return 0;
  return Math.max(0, (grossIncome - loan.threshold) * loan.rate);
}

/**
 * Calculate monthly take-home pay.
 * Pension is salary sacrifice (reduces gross before tax).
 */
export function calcMonthlyTakeHome({ grossAnnual, pensionPct, studentLoan, otherDeductions }) {
  const pensionAnnual = grossAnnual * (pensionPct / 100);
  const taxableIncome = grossAnnual - pensionAnnual;

  const incomeTax = calcIncomeTax(taxableIncome);
  const ni = calcNI(taxableIncome);
  const studentLoanRepayment = calcStudentLoan(taxableIncome, studentLoan);

  const annualNet = taxableIncome - incomeTax - ni - studentLoanRepayment - (otherDeductions * 12);
  return {
    monthlyTakeHome: Math.max(0, annualNet / 12),
    annualGross: grossAnnual,
    annualPension: pensionAnnual,
    annualTax: incomeTax,
    annualNI: ni,
    annualStudentLoan: studentLoanRepayment,
    annualOtherDeductions: otherDeductions * 12,
    annualNet: Math.max(0, annualNet),
  };
}

export const STUDENT_LOAN_OPTIONS = [
  { value: "none", label: "None" },
  { value: "plan1", label: "Plan 1" },
  { value: "plan2", label: "Plan 2" },
  { value: "plan4", label: "Plan 4" },
  { value: "plan5", label: "Plan 5" },
  { value: "postgrad", label: "Postgrad" },
];

export const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly", multiplier: 52 / 12 },
  { value: "monthly", label: "Monthly", multiplier: 1 },
  { value: "quarterly", label: "Quarterly", multiplier: 1 / 3 },
  { value: "annual", label: "Annual", multiplier: 1 / 12 },
];

export function toMonthly(amount, frequency) {
  const freq = FREQUENCY_OPTIONS.find((f) => f.value === frequency);
  return amount * (freq?.multiplier ?? 1);
}
