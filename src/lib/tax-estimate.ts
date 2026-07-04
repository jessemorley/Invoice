// Australian resident individual tax estimate.
// ponytail: single hardcoded bracket set (FY24-25 "Stage 3", still current for
// FY25-26). Applied to all years — wrong for pre-2024 FYs. Key these by FY
// start year if historical accuracy matters.
// Source: https://www.ato.gov.au/tax-rates-and-codes/tax-tables-overview
// Singles thresholds only — no spouse/dependants data exists in this app.

type Bracket = { over: number; base: number; rate: number };

// each bracket: tax = base + rate * (income - over)
const BRACKETS: Bracket[] = [
  { over: 190_000, base: 51_638, rate: 0.45 },
  { over: 135_000, base: 31_288, rate: 0.37 },
  { over: 45_000, base: 4_288, rate: 0.3 },
  { over: 18_200, base: 0, rate: 0.16 },
  { over: 0, base: 0, rate: 0 },
];

// Medicare levy (2% flat above threshold, shaded in below).
const MEDICARE_RATE = 0.02;
const MEDICARE_LOWER = 27_222; // nil at or below
const MEDICARE_UPPER = 34_027; // full 2% above; shaded in between
const MEDICARE_SHADE_RATE = 0.1; // 10c per $1 over lower threshold

// HECS/HELP — 2025-26 marginal system (replaced the old 19-tier flat-rate
// system). Repayment income ≈ taxable income here (no reportable fringe
// benefits / super in this app). The bottom two tiers are marginal
// (base + rate over threshold); the top tier reverts to 10% of WHOLE income.
// Source: https://www.ato.gov.au/.../study-and-training-support-loans-rates
// ponytail: repayment income approximated as taxable income — add back
// reportable super/fringe benefits if you ever record them.
const HECS_TOP_THRESHOLD = 179_286;
const HECS_TOP_RATE = 0.1; // whole-of-income, not marginal
const HECS_MARGINAL: Bracket[] = [
  { over: 125_000, base: 8_700, rate: 0.17 },
  { over: 67_000, base: 0, rate: 0.15 },
  { over: 0, base: 0, rate: 0 },
];

export function incomeTax(taxable: number): number {
  if (taxable <= 0) return 0;
  const b = BRACKETS.find((b) => taxable > b.over)!;
  return b.base + b.rate * (taxable - b.over);
}

export function medicareLevy(taxable: number): number {
  if (taxable <= MEDICARE_LOWER) return 0;
  if (taxable <= MEDICARE_UPPER) return MEDICARE_SHADE_RATE * (taxable - MEDICARE_LOWER);
  return MEDICARE_RATE * taxable;
}

export function hecsRepayment(taxable: number): number {
  if (taxable <= 0) return 0;
  if (taxable >= HECS_TOP_THRESHOLD) return HECS_TOP_RATE * taxable;
  const t = HECS_MARGINAL.find((t) => taxable > t.over)!;
  return t.base + t.rate * (taxable - t.over);
}

export function taxEstimate(taxable: number): {
  incomeTax: number;
  medicareLevy: number;
  hecs: number;
  total: number;
} {
  const tax = incomeTax(taxable);
  const levy = medicareLevy(taxable);
  const hecs = hecsRepayment(taxable);
  return { incomeTax: tax, medicareLevy: levy, hecs, total: tax + levy + hecs };
}
