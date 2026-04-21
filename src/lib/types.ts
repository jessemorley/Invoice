import type { BillingType, DayType, ExpenseCategory, InvoiceStatus } from "./database.types";

export type { ExpenseCategory, InvoiceStatus, BillingType, DayType };

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
  issued_date: string;
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
