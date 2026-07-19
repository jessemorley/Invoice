-- Resend's send id, needed to match bounce webhooks back to the row.
alter table scheduled_emails add column resend_id text;
