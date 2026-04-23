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

  let hourlyRate = client.rate_hourly ?? 0;
  if (client.show_role && role) {
    hourlyRate = role === "Operator"
      ? (client.rate_hourly_operator ?? client.rate_hourly ?? 0)
      : (client.rate_hourly_photographer ?? client.rate_hourly ?? 0);
  }

  const base = roundedHours * hourlyRate;
  const superAmt = client.pays_super ? base * (client.super_rate || 0.12) : 0;
  return { base, bonus: 0, superAmt, total: base + superAmt, hoursWorked: roundedHours, rawMins: diffMins };
}

export function calcManual(amount: number, client: Client): CalcResult {
  const base = amount || 0;
  const superAmt = client.pays_super ? base * (client.super_rate || 0.12) : 0;
  return { base, bonus: 0, superAmt, total: base + superAmt, hoursWorked: null };
}
