-- shoot_client was named after one client's entry_label ("Shoot Client") but
-- actually stores the entry's primary label for all billing types — hourly
-- custom labels and now the manual entry Item. Rename to match reality.
alter table entries rename column shoot_client to label;
