-- User-editable email body templates. Null = use the built-in default.
alter table user_preferences
  add column if not exists invoice_email_template text,
  add column if not exists followup_email_template text;
