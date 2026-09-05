import type { Client, WorkflowRate } from "./types";

export type CalcResult = {
  base: number;
  bonus: number;
  superAmt: number;
  total: number;
  hoursWorked: number | null;
  rawMins?: number;
};

export function toMins(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function formatDuration(rawMins: number): string {
  const h = Math.floor(rawMins / 60);
  const m = rawMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function calcDayRate(
  client: Client,
  dayType: "full" | "half",
  workflow: string,
  skus: number | null,
  workflowRates: WorkflowRate[]
): CalcResult {
  const base = dayType === "full"
    ? (client.rate_full_day ?? 0)
    : (client.rate_half_day ?? 0);

  let bonus = 0;
  if (dayType === "full") {
    const rate = workflowRates.find(
      (r) => r.client_id === client.id && r.workflow === workflow
    );
    if (rate) {
      if (rate.is_flat_bonus) {
        bonus = rate.max_bonus;
      } else if (skus != null) {
        const s = skus;
        if (s >= rate.upper_limit_skus) {
          bonus = rate.max_bonus;
        } else if (s > rate.kpi) {
          bonus = Math.min(
            (s - rate.kpi) * rate.incentive_rate_per_sku,
            rate.max_bonus
          );
        }
      }
    }
  }

  const subtotal = base + bonus;
  const superAmt = client.pays_super ? subtotal * (client.super_rate || 0.12) : 0;
  return { base, bonus, superAmt, total: subtotal + superAmt, hoursWorked: null };
}

export function calcBatchBonus(
  client: Client,
  lines: { workflow: string; skus: number }[],
  workflowRates: WorkflowRate[],
  dayType: "full" | "half" = "full"
): CalcResult {
  const base = dayType === "full"
    ? (client.rate_full_day ?? 0)
    : (client.rate_half_day ?? 0);

  // A half day earns no bonus, same as calcDayRate — the KPI is a full day's worth.
  if (dayType !== "full") {
    const superAmt = client.pays_super ? base * (client.super_rate || 0.12) : 0;
    return { base, bonus: 0, superAmt, total: base + superAmt, hoursWorked: null };
  }

  // A mixed day owes ONE KPI between its workflows, and each SKU counts as a
  // fraction of its own workflow's KPI — 1 Apparel is 1/84, 1 Model Shot is 1/126 —
  // so the shares are commensurable and add up. The duty is met once they reach 1;
  // 42 Apparel + 63 Model Shot is exactly a full day.
  //
  // Past that point the leftover SKUs are the bonus, each paid at its own workflow's
  // incentive rate (that rate being max_bonus spread over the SKUs from KPI to the
  // upper limit). So 84 Apparel + 1 Model Shot earns the single surplus Model Shot
  // SKU at $3.08, and for 54 Apparel + 48 Model Shot the 45 Model Shot SKUs that
  // close Apparel's KPI gap earn nothing while the remaining 3 pay $3.08 each.
  //
  // The KPI duty is charged to the highest-rate SKUs first. That is what makes
  // Apparel the base being "topped up" by Model Shot, and it keeps the result
  // independent of the order the rows happen to be filled in.
  // A line with no SKUs is not work done, so it must not reach the cap or the
  // flat-bonus check below — an empty Apparel row alongside a worked Model Shot row
  // would otherwise lend Apparel's higher max_bonus (or its flat payout) to a day
  // where no Apparel was shot. Filtered here rather than in the caller so the
  // invariant holds for every caller.
  const rated = lines
    .filter((line) => line.skus > 0)
    .map((line) => ({
      line,
      rate: workflowRates.find(
        (r) => r.client_id === client.id && r.workflow === line.workflow
      ),
    }))
    .filter((x): x is { line: (typeof lines)[number]; rate: WorkflowRate } => !!x.rate);

  const maxBonus = rated.reduce((max, x) => Math.max(max, x.rate.max_bonus), 0);

  // Flat-bonus workflows pay out in full without reference to SKUs or KPI, and the
  // payout is the flat lines' own max — not the largest max on the day, which would
  // let a SKU line's cap inflate it.
  const flatBonus = rated
    .filter((x) => x.rate.is_flat_bonus)
    .reduce((max, x) => Math.max(max, x.rate.max_bonus), 0);
  if (rated.some((x) => x.rate.is_flat_bonus)) {
    // ponytail: flat wins outright — no live workflow mixes a flat line with SKU
    // lines (Own Brand is the only flat one and never reaches this path). Revisit
    // if a client ever needs both on one day.
    const subtotal = base + flatBonus;
    const superAmt = client.pays_super ? subtotal * (client.super_rate || 0.12) : 0;
    return { base, bonus: flatBonus, superAmt, total: subtotal + superAmt, hoursWorked: null };
  }

  let owed = 1;
  let bonus = 0;
  // Equal rates would otherwise leave the duty with whichever row was typed first
  // (Array.prototype.sort is stable), so KPI ascending breaks the tie: the duty goes
  // to the workflow where a SKU is worth more of a day.
  for (const { line, rate } of [...rated].sort(
    (a, b) =>
      b.rate.incentive_rate_per_sku - a.rate.incentive_rate_per_sku ||
      a.rate.kpi - b.rate.kpi
  )) {
    if (rate.kpi <= 0) continue;
    const share = line.skus / rate.kpi;
    if (share <= owed) {
      owed -= share;
      continue;
    }
    // the SKUs from this line that finished the KPI earn nothing; the rest are surplus
    bonus += (line.skus - owed * rate.kpi) * rate.incentive_rate_per_sku;
    owed = 0;
  }
  // still short of a full day's KPI — no bonus at all
  if (owed > 0) bonus = 0;

  bonus = Math.min(bonus, maxBonus);

  const subtotal = base + bonus;
  const superAmt = client.pays_super ? subtotal * (client.super_rate || 0.12) : 0;
  return { base, bonus, superAmt, total: subtotal + superAmt, hoursWorked: null };
}

export function calcHourly(
  client: Client,
  startStr: string,
  finishStr: string,
  breakMins: number,
  role: string
): CalcResult | null {
  if (!startStr || !finishStr) return null;
  let diffMins = (toMins(finishStr) - toMins(startStr) + 1440) % 1440;
  diffMins = Math.max(0, diffMins - (breakMins || 0));
  const roundedHours = Math.round(diffMins / 60 / 0.25) * 0.25;

  const matchedRole = role ? client.roles.find((r) => r.name === role) : undefined;
  const hourlyRate = matchedRole ? matchedRole.rate : (client.rate_hourly ?? 0);

  const base = roundedHours * hourlyRate;
  const superAmt = client.pays_super ? base * (client.super_rate || 0.12) : 0;
  return { base, bonus: 0, superAmt, total: base + superAmt, hoursWorked: roundedHours, rawMins: diffMins };
}

// amount is per-unit when quantity is set; skus doubles as the quantity column for manual entries
export function calcManual(amount: number, quantity: number | null, client: Client): CalcResult {
  const base = (amount || 0) * (quantity ?? 1);
  const superAmt = client.pays_super ? base * (client.super_rate || 0.12) : 0;
  return { base, bonus: 0, superAmt, total: base + superAmt, hoursWorked: null };
}
