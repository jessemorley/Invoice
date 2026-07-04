import { incomeTax, medicareLevy, hecsRepayment, taxEstimate } from "./tax-estimate";

function approx(a: number, b: number, msg: string) {
  if (Math.abs(a - b) > 0.5) throw new Error(`${msg}: got ${a}, expected ${b}`);
}

// income tax: bracket boundaries + mid-points
approx(incomeTax(0), 0, "nil at 0");
approx(incomeTax(18_200), 0, "nil at tax-free threshold");
approx(incomeTax(45_000), 4_288, "top of 16c bracket");
approx(incomeTax(135_000), 31_288, "top of 30c bracket");
approx(incomeTax(190_000), 51_638, "top of 37c bracket");
approx(incomeTax(200_000), 51_638 + 0.45 * 10_000, "into 45c bracket");

// medicare: nil / shade-in / flat
approx(medicareLevy(27_222), 0, "medicare nil at lower threshold");
approx(medicareLevy(30_000), 0.1 * (30_000 - 27_222), "medicare shaded in");
approx(medicareLevy(34_027), 0.1 * (34_027 - 27_222), "medicare top of shade range");
approx(medicareLevy(34_028), 0.02 * 34_028, "medicare flat 2% above");

// HECS: nil below threshold / marginal tiers / whole-income top tier
approx(hecsRepayment(67_000), 0, "hecs nil at threshold");
approx(hecsRepayment(100_000), 0.15 * (100_000 - 67_000), "hecs tier 1 marginal");
approx(hecsRepayment(125_000), 0.15 * (125_000 - 67_000), "hecs top of tier 1");
approx(hecsRepayment(150_000), 8_700 + 0.17 * (150_000 - 125_000), "hecs tier 2 marginal");
approx(hecsRepayment(179_286), 0.1 * 179_286, "hecs top tier = 10% whole income");
approx(hecsRepayment(200_000), 0.1 * 200_000, "hecs top tier above");

// total combines all three
const e = taxEstimate(100_000);
approx(e.total, e.incomeTax + e.medicareLevy + e.hecs, "total = tax + levy + hecs");
approx(e.incomeTax, 4_288 + 0.3 * (100_000 - 45_000), "100k income tax");
approx(e.medicareLevy, 0.02 * 100_000, "100k levy");
approx(e.hecs, 0.15 * (100_000 - 67_000), "100k hecs");

console.log("tax-estimate: all checks passed");
