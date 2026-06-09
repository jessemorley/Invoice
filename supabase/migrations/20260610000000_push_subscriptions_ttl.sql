-- Prune push subscriptions that haven't been refreshed in 90 days.
-- Endpoints go stale when a user uninstalls the PWA without toggling the switch;
-- the send path prunes 404/410 responses reactively, but this catches devices
-- that are simply never pushed to again.
alter table public.push_subscriptions
  add column if not exists updated_at timestamptz not null default now();

-- Touch updated_at on every upsert so the TTL clock resets on re-subscription.
create or replace function public.touch_push_subscription_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.touch_push_subscription_updated_at();

-- pg_cron job: runs daily at 03:00 UTC, deletes rows idle for >90 days.
select cron.schedule(
  'prune-stale-push-subscriptions',
  '0 3 * * *',
  $$delete from public.push_subscriptions where updated_at < now() - interval '90 days'$$
);
