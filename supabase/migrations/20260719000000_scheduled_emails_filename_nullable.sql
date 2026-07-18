-- Free-form emails have no PDF attachment, so filename becomes optional.
alter table scheduled_emails alter column filename drop not null;
