# PWA Push Notifications + Icon Badge

Implement Web Push (iOS 16.4+ PWA-compatible) and the app-icon Badging API.

Decisions: multi-device subscriptions; triggers = (1) invoice email sent,
(2) weekly uninvoiced reminder (new scheduled job, honours per-user cutoff).

## Foundations
- [ ] Add `web-push` + `@types/web-push` to package.json
- [ ] Env vars: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:). Document in README / .env.example
- [ ] Migration `<ts>_create_push_subscriptions.sql`: table (id, user_id FK→auth.users, endpoint unique, p256dh, auth, user_agent, created_at) + owner-only RLS
- [ ] Add `push_subscriptions` to src/lib/database.types.ts

## Service worker + client
- [ ] `public/sw.js`: push handler (JSON + non-JSON fallback) → waitUntil(Promise.all([showNotification, setAppBadge])); notificationclick → close + clearAppBadge + focus/openWindow(data.url); install/activate → skipWaiting + clients.claim. No fetch caching.
- [ ] `src/components/push-manager.tsx` (client): register /sw.js; clearAppBadge on load + visibilitychange→visible. Mount in src/app/(app)/layout.tsx

## Subscribe UI (Settings → Notifications)
- [ ] "Enable push notifications on this device" button (user-gesture). iOS-not-standalone → show "Add to Home Screen" hint. Reflect unsupported/not-installed/default/granted/denied
- [ ] On click: Notification.requestPermission() → pushManager.subscribe({userVisibleOnly, applicationServerKey}) → save via server action; opt-out → unsubscribe + delete

## Server side
- [ ] Server actions in settings/actions.ts: `savePushSubscription(sub)` (upsert, token client), `deletePushSubscription(endpoint)`
- [ ] `src/lib/push.ts`: `sendPushToUser(userId, payload)` using web-push + service-role client; VAPID mailto: subject; fan out to all devices; prune 404/410. Best-effort.

## Triggers
- [ ] In src/inngest/send-invoice-email.ts: after marking `sent`, sendPushToUser("Invoice sent", url=/?view=invoices). Wrapped, never fails job.
- [ ] New Inngest scheduled fn `src/inngest/weekly-invoice-reminder.ts` (cron, ~hourly): for each user with weekly_invoice_reminder=true whose cutoff has elapsed, count uninvoiced groups (mirror fetchUninvoicedGroups) → if >0 push "N clients ready to invoice" + badgeCount=N. Register in api/inngest/route.ts. Dedupe so it fires once per cutoff window.

## Verify
- [ ] npm run build + npm run lint
- [ ] Manual: install PWA → enable → send invoice → notification + icon badge; badge clears on open

## Review

Implemented:
- `public/sw.js` — push + notificationclick + badge; no fetch caching.
- `src/components/push-manager.tsx` — SW registration + badge clearing on focus; mounted in (app)/layout.
- `src/components/push-notification-toggle.tsx` — opt-in Switch in Settings → Notifications; handles unsupported / iOS-needs-install / denied states.
- `supabase/migrations/20260608000000_create_push_subscriptions.sql` — table + RLS + `weekly_reminder_last_sent_week` dedupe column; mirrored in database.types.ts.
- `savePushSubscription` / `deletePushSubscription` server actions.
- `src/lib/push.ts` — `sendPushToUser` (multi-device fan-out, prunes 404/410), best-effort.
- Trigger 1: invoice-sent push wired into `send-invoice-email.ts` (no badge count — transient).
- Trigger 2: `src/inngest/weekly-invoice-reminder.ts` hourly cron (Sydney TZ), mirrors the in-app uninvoiced badge logic + per-user cutoff, badge=count, once-per-ISO-week dedupe. Registered in inngest route.
- README documents VAPID env vars + generation.

Verified: `npm run build` passes (type-check clean). `npm run lint` — only pre-existing
errors in workflow-rates-section.tsx; new files clean.

Operator steps (cannot be done from here): generate VAPID keys, set the 3 env vars,
run the new migration.

Not done / future: in-app fallback feed; per-device labels in settings.
