// Static mock data for prototype pages — no Supabase connection

export const CLIENTS = {
  iconic: { id: "c1", name: "THE ICONIC", color: "#6366f1", billing_type: "day_rate" as const },
  countryRoad: { id: "c2", name: "Country Road", color: "#10b981", billing_type: "day_rate" as const },
  sportscraft: { id: "c3", name: "Sportscraft", color: "#f97316", billing_type: "hourly" as const },
  mimco: { id: "c4", name: "Mimco", color: "#ec4899", billing_type: "day_rate" as const },
};

export type MockEntry = {
  id: string;
  client: (typeof CLIENTS)[keyof typeof CLIENTS];
  date: string;
  description: string;
  billing_type: "day_rate" | "hourly" | "manual";
  day_type?: "full" | "half";
  hours?: number;
  base_amount: number;
  bonus_amount: number;
  super_amount: number;
  total: number;
  invoice_id?: string;
  iso_week: string;
};

export const ENTRIES: MockEntry[] = [
  // Week 14 — 2026-03-30 to 2026-04-05
  {
    id: "e1", client: CLIENTS.iconic, date: "2026-04-03", description: "Apparel — Summer campaign hero shots", billing_type: "day_rate", day_type: "full",
    base_amount: 850, bonus_amount: 120, super_amount: 116.40, total: 1086.40, iso_week: "W14",
  },
  {
    id: "e2", client: CLIENTS.iconic, date: "2026-04-02", description: "Apparel — Summer campaign flatlays", billing_type: "day_rate", day_type: "full",
    base_amount: 850, bonus_amount: 95, super_amount: 113.40, total: 1058.40, iso_week: "W14",
  },
  {
    id: "e3", client: CLIENTS.iconic, date: "2026-04-01", description: "ICONIC — Accessories reshoot", billing_type: "day_rate", day_type: "half",
    base_amount: 425, bonus_amount: 0, super_amount: 51.00, total: 476.00, iso_week: "W14",
  },
  {
    id: "e4", client: CLIENTS.countryRoad, date: "2026-04-04", description: "AW26 knitwear campaign", billing_type: "day_rate", day_type: "full",
    base_amount: 900, bonus_amount: 0, super_amount: 108.00, total: 1008.00, iso_week: "W14",
  },
  {
    id: "e5", client: CLIENTS.sportscraft, date: "2026-04-05", description: "Studio — Spring preview shoot", billing_type: "hourly", hours: 7.5,
    base_amount: 562.50, bonus_amount: 0, super_amount: 67.50, total: 630.00, iso_week: "W14",
  },
  // Week 13 — 2026-03-23 to 2026-03-29
  {
    id: "e6", client: CLIENTS.iconic, date: "2026-03-27", description: "Apparel — Denim edit", billing_type: "day_rate", day_type: "full",
    base_amount: 850, bonus_amount: 110, super_amount: 115.20, total: 1075.20, iso_week: "W13",
  },
  {
    id: "e7", client: CLIENTS.iconic, date: "2026-03-26", description: "Apparel — Denim edit day 2", billing_type: "day_rate", day_type: "full",
    base_amount: 850, bonus_amount: 105, super_amount: 114.60, total: 1069.60, iso_week: "W13", invoice_id: "inv2",
  },
  {
    id: "e8", client: CLIENTS.countryRoad, date: "2026-03-25", description: "Heritage collection ecomm", billing_type: "day_rate", day_type: "full",
    base_amount: 900, bonus_amount: 0, super_amount: 108.00, total: 1008.00, iso_week: "W13", invoice_id: "inv1",
  },
  {
    id: "e9", client: CLIENTS.countryRoad, date: "2026-03-24", description: "Heritage collection campaign", billing_type: "day_rate", day_type: "full",
    base_amount: 900, bonus_amount: 0, super_amount: 108.00, total: 1008.00, iso_week: "W13", invoice_id: "inv1",
  },
  {
    id: "e10", client: CLIENTS.mimco, date: "2026-03-28", description: "Autumn accessories lookbook", billing_type: "day_rate", day_type: "full",
    base_amount: 800, bonus_amount: 0, super_amount: 96.00, total: 896.00, iso_week: "W13",
  },
];

export type MockInvoice = {
  id: string;
  number: string;
  client: (typeof CLIENTS)[keyof typeof CLIENTS];
  issued_date: string;
  date_range: string;
  subtotal: number;
  super_amount: number;
  total: number;
  status: "draft" | "issued" | "paid";
  entry_count: number;
};

export const INVOICES: MockInvoice[] = [
  {
    id: "inv1", number: "INV-042", client: CLIENTS.countryRoad,
    issued_date: "2026-03-29", date_range: "24–25 Mar",
    subtotal: 1800, super_amount: 216, total: 2016, status: "paid", entry_count: 2,
  },
  {
    id: "inv2", number: "INV-041", client: CLIENTS.iconic,
    issued_date: "2026-03-28", date_range: "26–27 Mar",
    subtotal: 1915, super_amount: 229.80, total: 2144.80, status: "issued", entry_count: 2,
  },
  {
    id: "inv3", number: "INV-040", client: CLIENTS.sportscraft,
    issued_date: "2026-03-20", date_range: "17–19 Mar",
    subtotal: 1687.50, super_amount: 202.50, total: 1890.00, status: "issued", entry_count: 3,
  },
  {
    id: "inv4", number: "INV-039", client: CLIENTS.iconic,
    issued_date: "2026-03-14", date_range: "10–14 Mar",
    subtotal: 4370, super_amount: 524.40, total: 4894.40, status: "paid", entry_count: 5,
  },
  {
    id: "inv5", number: "INV-038", client: CLIENTS.mimco,
    issued_date: "2026-03-07", date_range: "3–7 Mar",
    subtotal: 3200, super_amount: 384, total: 3584, status: "paid", entry_count: 4,
  },
  {
    id: "inv6", number: "INV-037", client: CLIENTS.countryRoad,
    issued_date: "2026-02-28", date_range: "24–28 Feb",
    subtotal: 4500, super_amount: 540, total: 5040, status: "paid", entry_count: 5,
  },
];

// Dashboard data
export const DASHBOARD = {
  mtdEarnings: 6259.80,
  mtdPriorMonth: 8928.40,
  outstanding: [
    { invoice: INVOICES[1], label: "INV-041 — THE ICONIC" },
    { invoice: INVOICES[2], label: "INV-040 — Sportscraft" },
  ],
  // 6-month chart data
  monthlyEarnings: [
    { month: "Nov", current: 9200, prior: 7800 },
    { month: "Dec", current: 6400, prior: 8100 },
    { month: "Jan", current: 11200, prior: 9500 },
    { month: "Feb", current: 10540, prior: 8400 },
    { month: "Mar", current: 12529, prior: 10200 },
    { month: "Apr", current: 6260, prior: 8900 },
  ],
};
