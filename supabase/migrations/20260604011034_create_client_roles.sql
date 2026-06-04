create table public.client_roles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  rate numeric not null
);

alter table public.client_roles enable row level security;

create policy "Users can manage their own client roles"
  on public.client_roles
  to authenticated
  using (
    client_id in (
      select id from public.clients where user_id = (select auth.uid())
    )
  )
  with check (
    client_id in (
      select id from public.clients where user_id = (select auth.uid())
    )
  );
