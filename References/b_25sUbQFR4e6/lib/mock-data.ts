export type MockEntry = {
  id: string;
  date: string;
  iso_week: string;
  description: string;
  client: {
    id: string;
    name: string;
    color: string;
  };
  billing_type: "day_rate" | "hourly";
  day_type?: "full" | "half";
  hours?: number;
  base_amount: number;
  bonus_amount: number;
  invoice_id?: string;
};

export const ENTRIES: MockEntry[] = [
  {
    id: "1",
    date: "2024-03-15",
    iso_week: "2024-W11",
    description: "Frontend development - Dashboard redesign",
    client: { id: "c1", name: "Acme Corp", color: "#3b82f6" },
    billing_type: "day_rate",
    day_type: "full",
    base_amount: 850,
    bonus_amount: 0,
    invoice_id: "inv-001",
  },
  {
    id: "2",
    date: "2024-03-14",
    iso_week: "2024-W11",
    description: "API integration work",
    client: { id: "c1", name: "Acme Corp", color: "#3b82f6" },
    billing_type: "day_rate",
    day_type: "full",
    base_amount: 850,
    bonus_amount: 100,
    invoice_id: "inv-001",
  },
  {
    id: "3",
    date: "2024-03-13",
    iso_week: "2024-W11",
    description: "Code review and documentation",
    client: { id: "c1", name: "Acme Corp", color: "#3b82f6" },
    billing_type: "day_rate",
    day_type: "half",
    base_amount: 425,
    bonus_amount: 0,
    invoice_id: "inv-001",
  },
  {
    id: "4",
    date: "2024-03-15",
    iso_week: "2024-W11",
    description: "Mobile app bug fixes",
    client: { id: "c2", name: "TechStart", color: "#10b981" },
    billing_type: "hourly",
    hours: 4,
    base_amount: 400,
    bonus_amount: 0,
  },
  {
    id: "5",
    date: "2024-03-14",
    iso_week: "2024-W11",
    description: "Performance optimization",
    client: { id: "c2", name: "TechStart", color: "#10b981" },
    billing_type: "hourly",
    hours: 6,
    base_amount: 600,
    bonus_amount: 50,
  },
  {
    id: "6",
    date: "2024-03-08",
    iso_week: "2024-W10",
    description: "Database schema design",
    client: { id: "c3", name: "DataFlow Inc", color: "#f59e0b" },
    billing_type: "day_rate",
    day_type: "full",
    base_amount: 900,
    bonus_amount: 0,
  },
  {
    id: "7",
    date: "2024-03-07",
    iso_week: "2024-W10",
    description: "Backend API development",
    client: { id: "c3", name: "DataFlow Inc", color: "#f59e0b" },
    billing_type: "day_rate",
    day_type: "full",
    base_amount: 900,
    bonus_amount: 150,
  },
  {
    id: "8",
    date: "2024-03-06",
    iso_week: "2024-W10",
    description: "Client meeting and requirements gathering",
    client: { id: "c1", name: "Acme Corp", color: "#3b82f6" },
    billing_type: "hourly",
    hours: 2,
    base_amount: 200,
    bonus_amount: 0,
  },
];
