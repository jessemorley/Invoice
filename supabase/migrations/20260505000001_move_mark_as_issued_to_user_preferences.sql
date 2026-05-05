ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS mark_as_issued_on_send boolean NOT NULL DEFAULT false;
ALTER TABLE invoice_sequence DROP COLUMN IF EXISTS mark_as_issued_on_send;
