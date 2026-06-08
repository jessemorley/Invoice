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
(to fill in after implementation)
