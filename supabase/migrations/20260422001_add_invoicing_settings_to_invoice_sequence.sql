alter table invoice_sequence
  add column if not exists due_date_offset integer not null default 30,
  add column if not exists mark_as_issued_on_send boolean not null default false;
