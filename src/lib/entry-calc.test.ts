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

describe("calcBatchBonus — Apparel day split across Apparel and Model Shot", () => {
  it("pays nothing when every line is below its own KPI: 54 Apparel + 48 Model Shot", () => {
    const result = calcBatchBonus(
      client,
      [
        { workflow: "Apparel", skus: 54 },
        { workflow: "Model Shot", skus: 48 },
      ],
      RATES
    );
    // 54 < KPI 84 and 48 < KPI 126 — neither line has reached its threshold
    expect(result.bonus).toBe(0);
    expect(result.base).toBe(350);
    expect(result.total).toBe(350);
  });

  it("pays nothing for a sub-KPI line, however many workflows are present", () => {
    // the bug this guards: measuring raw SKUs against the upper limit paid from the
    // first SKU, so adding one Model Shot SKU to a sub-KPI Apparel day earned $22.46
    const result = calcBatchBonus(
      client,
      [
        { workflow: "Apparel", skus: 51 },
        { workflow: "Model Shot", skus: 1 },
      ],
      RATES
    );
    expect(result.bonus).toBe(0);
  });

  it("sums each line's share of its own KPI-to-limit band", () => {
    const result = calcBatchBonus(
      client,
      [
        { workflow: "Apparel", skus: 88 },
        { workflow: "Model Shot", skus: 132 },
      ],
      RATES
    );
    // Apparel 4/8 of its band = 50%, Model Shot 6/13 = 46.15% → 96.15%
    const pct = (4 / 8) * 100 + (6 / 13) * 100;
    expect(result.bonus).toBeCloseTo((pct / 100) * MAX_BONUS, 6);
    expect(result.bonus).toBeLessThan(MAX_BONUS);
  });

  it("agrees with calcDayRate when only one line is present", () => {
    for (const skus of [80, 84, 86, 88, 92, 120]) {
      expect(
        calcBatchBonus(client, [{ workflow: "Apparel", skus }], RATES).bonus,
        `${skus} SKUs`
      ).toBeCloseTo(calcDayRate(client, "full", "Apparel", skus, RATES).bonus, 6);
    }
  });

  it("caps the combined bonus at max_bonus once, rather than per line", () => {
    const result = calcBatchBonus(
      client,
      [
        { workflow: "Apparel", skus: 92 },
        { workflow: "Model Shot", skus: 139 },
      ],
      RATES
    );
    expect(result.bonus).toBe(MAX_BONUS);
  });

  it("takes the largest max_bonus across mixed lines, not the last one seen", () => {
    const mixed: WorkflowRate[] = [
      { ...rate("Apparel", 84, 92, 5.0), max_bonus: 60 },
      { ...rate("Model Shot", 126, 139, 3.08), max_bonus: 20 },
    ];
    const result = calcBatchBonus(
      client,
      [
        { workflow: "Apparel", skus: 92 },
        { workflow: "Model Shot", skus: 139 },
      ],
      mixed
    );
    expect(result.bonus).toBe(60);
  });

  it("ignores lines whose workflow has no rate row, and never divides by zero", () => {
    const withZero = [...RATES, rate("Broken", 0, 0, 0)];
    const result = calcBatchBonus(
      client,
      [
        { workflow: "Apparel", skus: 92 },
        { workflow: "Unknown", skus: 500 },
        { workflow: "Broken", skus: 500 },
      ],
      withZero
    );
    expect(Number.isFinite(result.bonus)).toBe(true);
    expect(result.bonus).toBe(MAX_BONUS);
  });

  it("is unaffected by blank rows, which the sheet filters out before costing", () => {
    const lines = [
      { workflow: "Apparel", skus: 88 },
      { workflow: "Model Shot", skus: 0 },
    ];
    const filled = lines.filter((l) => l.skus > 0);
    expect(calcBatchBonus(client, filled, RATES).bonus).toBeCloseTo(
      calcBatchBonus(client, lines, RATES).bonus,
      6
    );
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
