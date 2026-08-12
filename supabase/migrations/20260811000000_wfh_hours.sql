-- Working-from-home hours for the ATO fixed-rate method (PCG 2023/1).
-- One total per financial year, identified by FY start year (FY26 = 2025).
create table public.wfh_hours (
  user_id uuid not null references auth.users on delete cascade,
  fy_start_year int not null,
  hours numeric not null check (hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, fy_start_year)
);

alter table public.wfh_hours enable row level security;

create policy "Users can manage their own WFH hours"
  on public.wfh_hours
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
