import { describe, it, expect } from "vitest";
import { calcBatchBonus, calcDayRate } from "./entry-calc";
import type { Client, WorkflowRate } from "./types";

// Figures mirror docs/INVOICES - Sheet21.csv
const MAX_BONUS = 40;

const rate = (workflow: string, kpi: number, upper: number, perSku: number): WorkflowRate => ({
  id: workflow,
  client_id: "c1",
  workflow,
  is_flat_bonus: false,
  kpi,
  upper_limit_skus: upper,
  incentive_rate_per_sku: perSku,
  max_bonus: MAX_BONUS,
});

const RATES: WorkflowRate[] = [
  rate("Apparel", 84, 92, 5.0),
  rate("Model Shot", 126, 139, 3.08),
];

const client = {
  id: "c1",
  rate_full_day: 350,
  rate_half_day: 175,
  pays_super: false,
  super_rate: 0.12,
} as Client;

describe("calcBatchBonus — one KPI shared across workflows", () => {
  it("counts each SKU as a fraction of its own workflow's KPI", () => {
    // 42 Apparel (half of 84) + 63 Model Shot (half of 126) = exactly one day's KPI
    expect(calcBatchBonus(client, [
      { workflow: "Apparel", skus: 42 },
      { workflow: "Model Shot", skus: 63 },
    ], RATES).bonus).toBe(0);
  });

  it("pays the surplus SKUs at their own rate: 84 Apparel + 1 Model Shot = $3.08", () => {
    // Apparel alone meets KPI, so the single Model Shot SKU is pure surplus
    const result = calcBatchBonus(client, [
      { workflow: "Apparel", skus: 84 },
      { workflow: "Model Shot", skus: 1 },
    ], RATES);
    expect(result.bonus).toBeCloseTo(3.08, 6);
  });

  it("charges the KPI gap first: 54 Apparel + 48 Model Shot = $9.24", () => {
    // 54 Apparel is 64.29% of KPI; closing the 35.71% gap takes 45 Model Shot SKUs,
    // leaving 3 surplus at $3.08
    const result = calcBatchBonus(client, [
      { workflow: "Apparel", skus: 54 },
      { workflow: "Model Shot", skus: 48 },
    ], RATES);
    expect(result.bonus).toBeCloseTo(3 * 3.08, 6);
    expect(result.bonus).toBeCloseTo(9.24, 6);
  });

  it("pays nothing until the shared KPI is met", () => {
    // 51/84 + 1/126 = 61.5% of a day
    expect(calcBatchBonus(client, [
      { workflow: "Apparel", skus: 51 },
      { workflow: "Model Shot", skus: 1 },
    ], RATES).bonus).toBe(0);
  });

  it("does not depend on the order the rows were filled in", () => {
    const lines = [
      { workflow: "Apparel", skus: 54 },
      { workflow: "Model Shot", skus: 48 },
    ];
    expect(calcBatchBonus(client, lines, RATES).bonus).toBeCloseTo(
      calcBatchBonus(client, [...lines].reverse(), RATES).bonus,
      9
    );
  });

  it("stays order-independent when two workflows tie on incentive rate", () => {
    // Equal rates leave the sort with nothing to separate them, so the KPI duty
    // used to fall on whichever row was typed first. Figures sit under the cap,
    // where the difference actually shows.
    const tied: WorkflowRate[] = [
      rate("Low KPI", 60, 200, 0.5),
      rate("High KPI", 100, 300, 0.5),
    ];
    const lines = [
      { workflow: "Low KPI", skus: 40 },
      { workflow: "High KPI", skus: 60 },
    ];
    const forward = calcBatchBonus(client, lines, tied).bonus;
    const reversed = calcBatchBonus(client, [...lines].reverse(), tied).bonus;
    expect(forward).toBeCloseTo(reversed, 9);
    // Duty charged to the lower-KPI workflow, where a SKU is worth more of a day
    // (1/60 > 1/100) — the same "dearest SKUs pay the duty" rule as the rate sort.
    // 40/60 of the day leaves 0.333 owed; 33.3 High KPI SKUs close it, 26.67 surplus.
    expect(forward).toBeCloseTo(13.333333, 5);
  });

  it("agrees with calcDayRate when only one line is present", () => {
    for (const skus of [0, 40, 84, 86, 88, 92, 120]) {
      expect(
        calcBatchBonus(client, [{ workflow: "Apparel", skus }], RATES).bonus,
        `${skus} SKUs`
      ).toBeCloseTo(calcDayRate(client, "full", "Apparel", skus, RATES).bonus, 6);
    }
  });

  it("caps the combined bonus at max_bonus once, rather than per line", () => {
    const result = calcBatchBonus(client, [
      { workflow: "Apparel", skus: 92 },
      { workflow: "Model Shot", skus: 139 },
    ], RATES);
    expect(result.bonus).toBe(MAX_BONUS);
  });

  it("takes the largest max_bonus across mixed lines, not the last one seen", () => {
    const mixed: WorkflowRate[] = [
      { ...rate("Apparel", 84, 92, 5.0), max_bonus: 60 },
      { ...rate("Model Shot", 126, 139, 3.08), max_bonus: 20 },
    ];
    const result = calcBatchBonus(client, [
      { workflow: "Apparel", skus: 92 },
      { workflow: "Model Shot", skus: 139 },
    ], mixed);
    expect(result.bonus).toBe(60);
  });

  it("ignores lines whose workflow has no rate row, and never divides by zero", () => {
    const withZero = [...RATES, rate("Broken", 0, 0, 0)];
    const result = calcBatchBonus(client, [
      { workflow: "Apparel", skus: 92 },
      { workflow: "Unknown", skus: 500 },
      { workflow: "Broken", skus: 500 },
    ], withZero);
    expect(Number.isFinite(result.bonus)).toBe(true);
    expect(result.bonus).toBe(MAX_BONUS);
  });

  it("pays a flat-bonus workflow in full", () => {
    const flat = [{ ...rate("Apparel", 84, 92, 5.0), is_flat_bonus: true }];
    expect(calcBatchBonus(client, [{ workflow: "Apparel", skus: 1 }], flat).bonus).toBe(MAX_BONUS);
  });

  it("pays a flat line its own max, not the largest max on the day", () => {
    // Every live workflow shares max_bonus 40, so this only bites if the rates
    // ever diverge — but the flat branch must answer for its own lines either way.
    const mixed: WorkflowRate[] = [
      { ...rate("Flat", 0, 0, 0), is_flat_bonus: true, max_bonus: 15 },
      rate("Apparel", 84, 92, 5.0),
    ];
    const result = calcBatchBonus(client, [
      { workflow: "Flat", skus: 0 },
      { workflow: "Apparel", skus: 10 },
    ], mixed);
    expect(result.bonus).toBe(15);
  });

  it("pays no bonus on a half day, matching calcDayRate", () => {
    const result = calcBatchBonus(client, [
      { workflow: "Apparel", skus: 92 },
      { workflow: "Model Shot", skus: 139 },
    ], RATES, "half");
    expect(result.base).toBe(175);
    expect(result.bonus).toBe(0);
    expect(result.total).toBe(175);
  });

  it("adds super when the client pays it", () => {
    const superClient = { ...client, pays_super: true, super_rate: 0.12 } as Client;
    const result = calcBatchBonus(superClient, [{ workflow: "Apparel", skus: 92 }], RATES);
    const subtotal = 350 + MAX_BONUS;
    expect(result.superAmt).toBeCloseTo(subtotal * 0.12, 6);
    expect(result.total).toBeCloseTo(subtotal * 1.12, 6);
  });
});

describe("calcDayRate — single-workflow Apparel is unchanged", () => {
  it("pays nothing at or below KPI, and the full bonus at the upper limit", () => {
    expect(calcDayRate(client, "full", "Apparel", 84, RATES).bonus).toBe(0);
    expect(calcDayRate(client, "full", "Apparel", 92, RATES).bonus).toBe(MAX_BONUS);
  });

  it("uses the per-SKU incentive rate between KPI and the upper limit", () => {
    // 88 SKUs = 4 over KPI × $5.00
    expect(calcDayRate(client, "full", "Apparel", 88, RATES).bonus).toBeCloseTo(20, 6);
  });

  it("pays no bonus on a half day", () => {
    const result = calcDayRate(client, "half", "Apparel", 92, RATES);
    expect(result.base).toBe(175);
    expect(result.bonus).toBe(0);
  });
});
