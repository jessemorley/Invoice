-- Enable RLS on all user-scoped tables
alter table business_details enable row level security;
alter table clients enable row level security;
alter table entries enable row level security;
alter table expenses enable row level security;
alter table invoice_line_items enable row level security;
alter table invoice_sequence enable row level security;
alter table invoices enable row level security;
alter table scheduled_emails enable row level security;

-- Full access to own rows only (user_id is text, cast to uuid for comparison with auth.uid())
create policy "own rows" on business_details for all using (user_id::uuid = auth.uid());
create policy "own rows" on clients for all using (user_id::uuid = auth.uid());
create policy "own rows" on entries for all using (user_id::uuid = auth.uid());
create policy "own rows" on expenses for all using (user_id::uuid = auth.uid());
create policy "own rows" on invoice_line_items for all using (user_id::uuid = auth.uid());
create policy "own rows" on invoice_sequence for all using (user_id::uuid = auth.uid());
create policy "own rows" on invoices for all using (user_id::uuid = auth.uid());
create policy "own rows" on scheduled_emails for all using (user_id::uuid = auth.uid());

-- Storage: users can only access receipts under their own user_id prefix
create policy "own receipts" on storage.objects for all
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
