-- Run this migration ONLY after populating client_roles for all existing clients
-- that previously used show_role / rate_hourly_photographer / rate_hourly_operator.
alter table public.clients
  drop column if exists show_role,
  drop column if exists rate_hourly_photographer,
  drop column if exists rate_hourly_operator;
