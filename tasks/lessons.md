# Lessons

## Background scheduling: prefer future-dated Inngest events over polling crons
This project deliberately avoids polling crons. The established idiom is a
**future-dated event** — `inngest.send({ name, data, ts })` — that Inngest holds
until the moment arrives, paired with `cancelOn` to drop it when things change
(see `invoices/actions.ts` + `send-invoice-email.ts`).

For recurring work, use a **self-rescheduling chain**: the handler re-sends the
next event at the end of its run instead of an hourly `cron` trigger. Seed/cancel
the chain from the relevant mutation (e.g. `saveNotificationSettings`).
Don't reach for `triggers: [{ cron }]` here.

## "Immediately" cutoff is a badge gate, not a push trigger
The weekly reminder's `immediately` cutoff needs no push — the app is open when
the entry is created, so it only affects the in-app badge display gate. Only the
deferred cutoffs (`friday_5pm`, `sunday_midnight`) schedule a notification.
