-- Reverts 20260812000000: the WFH deduction stays a tax-view-only calculation,
-- not a materialised expense row.
alter table public.wfh_hours drop column expense_id;
