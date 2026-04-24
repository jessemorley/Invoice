import type { Database } from "./database.types";

export type BillingType = Database["public"]["Enums"]["billing_type"];
export type DayType = Database["public"]["Enums"]["day_type"];
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

export type ClientRef = {
  id: string;
  name: string;
  color: string;
  billing_type: BillingType;
};

export type InvoiceRef = {
  id: string;
  number: string;
  status: InvoiceStatus;
};

export type Entry = {
  id: string;
  client: ClientRef;
  date: string;
  description: string | null;
  role: string | null;
  workflow_type: string | null;
  billing_type: BillingType;
  day_type?: DayType | null;
  hours?: number | null;
  shoot_client: string | null;
  skus: number | null;
  brand: string | null;
  start_time: string | null;
  finish_time: string | null;
  break_minutes: number | null;
  base_amount: number;
  bonus_amount: number;
  super_amount: number;
  total: number;
  invoice_id?: string | null;
  invoice?: InvoiceRef | null;
  iso_week: string;
};

export type Invoice = {
  id: string;
  number: string;
  client: ClientRef;
  issued_date: string | null;
  date_range: string;
  subtotal: number;
  super_amount: number;
  total: number;
  status: InvoiceStatus;
  entry_count: number;
};

export type Expense = {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  gst_included: boolean;
  notes?: string | null;
  receipt_path?: string | null;
  is_billable: boolean;
  invoice_id?: string | null;
};

export type Client = {
  id: string;
  name: string;
  color: string | null;
  billing_type: BillingType;
  rate_full_day: number | null;
  rate_half_day: number | null;
  rate_hourly: number | null;
  rate_hourly_photographer: number | null;
  rate_hourly_operator: number | null;
  pays_super: boolean;
  super_rate: number;
  show_super_on_invoice: boolean;
  invoice_frequency: "weekly" | "per_job";
  address: string;
  suburb: string;
  email: string;
  abn: string | null;
  contact_name: string | null;
  notes: string | null;
  entry_label: string | null;
  show_role: boolean;
  is_active: boolean;
  created_at: string;
  invoice_count: number;
  default_start_time: string | null;
  default_finish_time: string | null;
};

export type WorkflowRate = {
  id: string;
  client_id: string;
  workflow: string;
  is_flat_bonus: boolean;
  kpi: number;
  upper_limit_skus: number;
  incentive_rate_per_sku: number;
  max_bonus: number;
};

export type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | null;
  amount: number;
  sort_order: number;
};

export type InvoiceEntry = {
  id: string;
  date: string;
  description: string | null;
  billing_type: BillingType;
  day_type: DayType | null;
  workflow_type: string | null;
  brand: string | null;
  shoot_client: string | null;
  role: string | null;
  skus: number | null;
  hours_worked: number | null;
  start_time: string | null;
  finish_time: string | null;
  break_minutes: number | null;
  base_amount: number;
  bonus_amount: number;
  super_amount: number;
  total_amount: number;
};

export type InvoiceDetail = {
  id: string;
  number: string;
  issued_date: string | null;
  due_date: string | null;
  status: InvoiceStatus;
  subtotal: number;
  super_amount: number;
  total: number;
  notes: string | null;
  client: {
    id: string;
    name: string;
    color: string;
    address: string;
    suburb: string;
    email: string;
    abn: string | null;
    entry_label: string | null;
    pays_super: boolean;
    super_rate: number;
    show_super_on_invoice: boolean;
    rate_hourly: number | null;
  };
  entries: InvoiceEntry[];
  line_items: InvoiceLineItem[];
};

export type MonthlyEarning = {
  month: string;
  current: number;
  prior: number;
};

export type DashboardData = {
  mtdEarnings: number;
  mtdPriorMonth: number;
  outstanding: Invoice[];
  monthlyEarnings: MonthlyEarning[];
};
