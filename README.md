<img src="public/app_icon.png" width="80" alt="App icon" />

# Invoice

A personal invoicing app I use to track time entries, manage clients, generate invoices, and send them as PDFs via email.

## Stack

- **Next.js 16** (React 19) — SPA-style view switching via `?view=` param
- **Supabase** — Postgres database with RLS + auth
- **Tailwind CSS v4** + **shadcn/ui** — styling and components
- **Inngest** — background job queue for invoice email delivery
- **Resend** — transactional email with PDF attachments
- **@react-pdf/renderer** — PDF generation for invoices
- **web-push** — Web Push notifications (iOS 16.4+ PWA) + Badging API
- **Vercel** — hosting

## Push notifications

The installed PWA can receive Web Push notifications (invoice sent + weekly
"time to invoice" reminder) and shows an app-icon badge via the Badging API.
On iOS this only works once the app is added to the home screen (iOS 16.4+).

Generate a VAPID key pair once and add these environment variables:

```bash
npx web-push generate-vapid-keys
```

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public key (exposed to the browser) |
| `VAPID_PRIVATE_KEY` | Private key — keep server-side only |
| `VAPID_SUBJECT` | `mailto:you@example.com` or an `https://` URL |

Run the `push_subscriptions` migration in `supabase/migrations/` before use.