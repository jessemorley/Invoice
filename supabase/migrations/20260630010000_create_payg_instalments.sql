create table public.payg_instalments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  paid_date date not null,
  amount numeric not null check (amount > 0),
  label text,
  created_at timestamptz not null default now()
);

create index payg_instalments_user_id_idx on public.payg_instalments(user_id);

alter table public.payg_instalments enable row level security;

create policy "Users can manage their own PAYG instalments"
  on public.payg_instalments
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
