import { beforeAll, describe, expect, it } from "vitest";
import { buildDashboardData, buildInvoicesView, buildTaxTotals, type DashboardEntry, type TaxRows, type UninvoicedGroup } from "./reads";
import type { Client, Invoice } from "./types";

// These builders now run on the phone, not on a UTC server. Pin the device zone.
beforeAll(() => {
  process.env.TZ = "Australia/Sydney";
});

it("runs under Sydney time", () => {
  // AEDT (UTC+11) in October
  expect(new Date("2026-10-19T00:00:00").getTimezoneOffset()).toBe(-660);
});

const client = { name: "Acme", color: "#f00" };
const entry = (date: string, base: number, bonus = 0): DashboardEntry => ({ date, base_amount: base, bonus_amount: bonus, client });

describe("buildDashboardData", () => {
  const today = "2026-10-20"; // Tuesday

  it("keys each weekly bar to its own Monday-start ISO week", () => {
    // Last complete week is Mon 12 – Sun 18 Oct. A Sunday 11 Oct entry belongs to the week before.
    const data = buildDashboardData([entry("2026-10-12", 100), entry("2026-10-11", 7)], [], today);
    const last = data.weeklyEarnings.at(-1)!;
    const prev = data.weeklyEarnings.at(-2)!;
    expect(data.weeklyEarnings).toHaveLength(52);
    expect(last.current).toBe(100);
    expect(last.yearMonth).toBe("2026-10");
    expect(prev.current).toBe(7);
  });

  it("compares against the same weeks 52 weeks earlier", () => {
    const data = buildDashboardData([entry("2025-10-13", 40)], [], today); // Monday, 52 weeks before 12 Oct
    expect(data.weeklyEarnings.at(-1)!.prior).toBe(40);
  });

  it("totals month-to-date up to today and the prior month to the same day", () => {
    const data = buildDashboardData(
      [entry("2026-10-01", 10, 5), entry("2026-10-20", 20), entry("2026-10-21", 999), entry("2026-09-20", 30), entry("2026-09-21", 999)],
      [],
      today
    );
    expect(data.mtdEarnings).toBe(35);
    expect(data.mtdPriorMonth).toBe(30);
    expect(data.mtdDailyCumulative).toHaveLength(20);
    expect(data.mtdDailyCumulative.at(-1)!.cumulative).toBe(35);
    expect(data.mtdPriorCumulative).toHaveLength(30);
  });

  it("calendar runs Monday to the Sunday of this week and skips line items whose invoice has entries", () => {
    const data = buildDashboardData(
      [entry("2026-10-14", 1), { ...entry("2026-10-15", 1), invoiceHasEntries: true }],
      [],
      today
    );
    expect(data.monthCalendar.at(-1)!.date).toBe("2026-10-25");
    expect(new Date(data.monthCalendar[0].date + "T00:00:00").getDay()).toBe(1);
    const byDate = new Map(data.monthCalendar.map((d) => [d.date, d.clients]));
    expect(byDate.get("2026-10-14")).toEqual([client]);
    expect(byDate.get("2026-10-15")).toEqual([]);
  });

  it("lists outstanding invoices by due date, undated last", () => {
    const inv = (id: string, status: Invoice["status"], due_date: string | null) => ({ id, status, due_date }) as Invoice;
    const data = buildDashboardData([], [inv("a", "issued", null), inv("b", "paid", "2026-01-01"), inv("c", "draft", "2026-11-01")], today);
    expect(data.outstanding.map((i) => i.id)).toEqual(["c", "a"]);
  });
});

describe("buildTaxTotals", () => {
  const ref = { id: "c1", name: "Acme", billing_type: "day_rate", color: null };
  const rows: TaxRows = {
    invoices: [
      { paid_date: "2026-06-30", total: 100, clients: ref },
      { paid_date: "2026-07-01", total: 200, clients: [ref] },
      { paid_date: "2026-08-01", total: 50, clients: ref },
    ],
    expenses: [{ date: "2026-07-15", amount: 30, category: "software" }],
    payg: [
      { id: "p2", paid_date: "2026-10-01", amount: 500, label: null },
      { id: "p1", paid_date: "2026-07-28", amount: 400, label: "Q4" },
    ],
    wfh: [{ fy_start_year: 2025, hours: 0 }],
    entryDates: [],
  };

  it("splits by Australian financial year, newest first", () => {
    const [fy26, fy25] = buildTaxTotals(rows, "2026-10-20");
    expect(fy26.startYear).toBe(2026);
    expect(fy26.income).toBe(250);
    expect(fy26.monthly[0]).toEqual({ month: "Jul", revenue: 200, expenses: 30 });
    expect(fy26.incomeByClient).toEqual([{ client: { id: "c1", name: "Acme", billing_type: "day_rate", color: "#9ca3af" }, income: 250 }]);
    expect(fy26.expenditure).toBe(30);
    expect(fy25.startYear).toBe(2025);
    expect(fy25.income).toBe(100);
  });

  it("sorts PAYG instalments and keeps saved 0 WFH hours distinct from never-saved", () => {
    const [fy26, fy25] = buildTaxTotals(rows, "2026-10-20");
    expect(fy26.paygInstalments.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(fy26.paygPaid).toBe(900);
    expect(fy26.wfhHours).toBeNull();
    expect(fy25.wfhHours).toBe(0);
  });

  it("always includes the current FY and counts weekdays without entries", () => {
    const [fy] = buildTaxTotals({ ...rows, invoices: [], expenses: [], payg: [], wfh: [], entryDates: ["2026-07-01"] }, "2026-07-03");
    expect(fy.startYear).toBe(2026);
    expect(fy.weekdaysWithoutEntries).toBe(2); // Wed 1 (logged), Thu 2, Fri 3
  });
});

describe("buildInvoicesView", () => {
  const group = (clientId: string, isoWeek: string): UninvoicedGroup => ({
    key: `${clientId}-${isoWeek}`, clientId, clientName: clientId, clientColor: "#000", isoWeek, dateRange: "", entryCount: 1, subtotal: 1,
  });
  const clients = [
    { id: "weekly", invoice_frequency: "weekly" },
    { id: "monthly", invoice_frequency: "monthly" },
  ] as Client[];
  const prefs = (weekly_invoice_reminder: boolean, weekly_invoice_reminder_cutoff: "immediately" | "friday_5pm" | "sunday_midnight") =>
    ({ weekly_invoice_reminder, weekly_invoice_reminder_cutoff }) as Parameters<typeof buildInvoicesView>[2];
  const groups = [group("weekly", "2026-W43"), group("monthly", "2026-W43")];
  // Week 43 = Mon 19 – Sun 25 Oct 2026; Friday 5pm Sydney = 06:00Z on the 23rd
  const beforeCutoff = new Date("2026-10-23T05:59:00Z");
  const afterCutoff = new Date("2026-10-23T06:00:00Z");

  it("holds weekly clients back until the cutoff passes", () => {
    const before = buildInvoicesView(groups, clients, prefs(true, "friday_5pm"), beforeCutoff);
    expect(before.uninvoicedCount).toBe(1);
    expect(before.suggested.map((s) => s.ready)).toEqual([false, true]);
    const after = buildInvoicesView(groups, clients, prefs(true, "friday_5pm"), afterCutoff);
    expect(after.uninvoicedCount).toBe(2);
    expect(after.suggested.map((s) => s.ready)).toEqual([true, true]);
  });

  it("reminder toggle hides weekly badges but never readiness or the generate sheet", () => {
    const view = buildInvoicesView([groups[0]], clients, prefs(false, "friday_5pm"), afterCutoff);
    expect(view.uninvoicedCount).toBe(0);
    expect(view.hasUninvoiced).toBe(true);
    expect(view.suggested[0].ready).toBe(true);
  });

  it("defaults to badge on, cutoff immediately, when no preferences are saved", () => {
    const view = buildInvoicesView(groups, clients, null, beforeCutoff);
    expect(view.uninvoicedCount).toBe(2);
    expect(view.suggested.every((s) => s.ready)).toBe(true);
  });
});
