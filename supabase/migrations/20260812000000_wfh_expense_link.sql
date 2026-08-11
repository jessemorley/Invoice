-- Linked each FY's WFH deduction to a materialised expense row.
-- Reverted by 20260812000001 — the deduction is a tax-view-only calculation.
alter table public.wfh_hours
  add column expense_id uuid references public.expenses (id) on delete set null;
