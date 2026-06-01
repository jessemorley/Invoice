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
- **Vercel** — hosting