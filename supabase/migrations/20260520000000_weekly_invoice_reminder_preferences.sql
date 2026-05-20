alter table user_preferences
  add column if not exists weekly_invoice_reminder boolean not null default true,
  add column if not exists weekly_invoice_reminder_cutoff text not null default 'immediately';
