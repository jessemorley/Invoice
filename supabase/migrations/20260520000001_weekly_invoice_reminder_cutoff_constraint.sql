alter table user_preferences
  add constraint weekly_invoice_reminder_cutoff_check
  check (weekly_invoice_reminder_cutoff in ('immediately', 'friday_5pm', 'sunday_midnight'));
