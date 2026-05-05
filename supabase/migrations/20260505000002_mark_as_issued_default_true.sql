ALTER TABLE user_preferences ALTER COLUMN mark_as_issued_on_send SET DEFAULT true;
UPDATE user_preferences SET mark_as_issued_on_send = true WHERE mark_as_issued_on_send = false;
