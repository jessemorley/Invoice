-- Resend sometimes reports a bounce for mail that was actually delivered.
-- Clearing a false bounce returns the row to "sent", which is exactly what the
-- bounce webhook matches on — so a redelivered or retried bounce event for the
-- same resend_id would silently re-bounce the row the user just cleared.
-- This timestamp is the terminal marker: set when the user clears, and checked
-- by the webhook so a re-bounce of a cleared row is a no-op.
alter table public.scheduled_emails add column bounce_cleared_at timestamptz;
