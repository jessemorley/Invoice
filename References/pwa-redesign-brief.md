# PWA Redesign Brief
**Invoicing App — Next.js Rebuild**

---

## Purpose

A mobile-first responsive web app for a freelance photographer to log shoot entries, generate invoices, and track payment. Single user. Australian freelance context (AUD, super, ABN).

---

## Tech Stack

| Layer | Current | Proposed |
|---|---|---|
| Framework | Vanilla HTML/JS | Next.js 15+ (App Router) |
| Styling | Playful Tailwind | shadcn/ui + Tailwind (precision/grid) |
| Data/Auth | Supabase CDN script | Supabase SSR (`@supabase/ssr`) |
| Runtime | Browser interpreted | Turbopack |
| Icons | Lucide CDN | Lucide React |
| Typography | System sans | JetBrains Mono + Inter |
| PDF | Browserless → browser print | `@react-pdf/renderer` → Route Handler download |
| Email | Browserless + Edge Function | Resend + Supabase Edge Function |

---

## Data & State

- **Server components** for all initial page data fetches (entries, invoices, clients, dashboard)
- **Server Actions** for all mutations (create, update, delete)
- **No React Query / SWR** — refetch-on-navigate is sufficient at this data volume; add SWR later if specific screens feel slow
- **Client components** only where interactivity requires it (forms, sheets, command palette, charts)
- Super rate always read from `client.super_rate` — never hardcoded. 12% is a DB default only.

---

## Navigation

**Mobile** (below `md` / 768px): Bottom tab bar — Dashboard, Entries, Invoices, Clients. Overflow sheet for Expenses, Settings, Calendar.

**Desktop** (`md` and above): Left sidebar with all items visible.

**Routing:** Real Next.js App Router routes. `/` redirects to `/entries`.

**Auth:** Email/password via Supabase Auth. `/login` page. All other routes redirect to `/login` if no session. Session stored in cookies via `@supabase/ssr` middleware.

---

## Screens

### Entries (`/entries`)

**Purpose:** Log and review work entries. Primary daily-use screen.

**Behaviour:**
- Loads last 4 weeks on mount, grouped by **client + ISO week**
- Each group header: client colour dot, client name, ISO week label, group subtotal
- Each group has its own **"Invoice" action button** — the only place invoice generation is triggered
- Tapping "Invoice" opens a focused Sheet for that group: entry list, total, "Generate Invoice →" confirm
- After generation: navigates directly to the new invoice's detail
- Each entry row: date (DOW/day/month), description, hours or day type, amounts
- Tapping an entry opens an edit Sheet (fields vary by billing type)
- **Delete entry** available inside the edit Sheet — destructive button, confirm Dialog before executing
- **"Load earlier"** button at top of list loads the previous 4-week chunk (replaces upward infinite scroll — simpler and avoids scroll anchor complexity)
- FAB on mobile → client picker → entry form Sheet
- Desktop: "New entry" button in header

**Entry form fields by billing type:**
- `day_rate`: date, day type (full/half), workflow (Apparel/ICONIC), brand, SKUs (if ICONIC), description
- `hourly`: date, role (Photographer/Operator), start/finish time, break minutes, description
- `manual`: date, description, amount

---

### Invoices (`/invoices`)

**Purpose:** View all invoices and act on them. Generation signal, not generation interface.

**Behaviour:**
- Count badge when uninvoiced groups exist: *"3 groups ready to invoice"* — tapping navigates to `/entries`
- Desktop: shadcn `Table` — invoice number, client, date range, issued date, subtotal, status badge
- Mobile: card list
- Tap row/card → invoice detail Sheet
- **Sort:** default chronological; toggle to client-grouped. Persisted to `localStorage`.

**Invoice detail Sheet:**
- Entry list (date, description, hours, amount)
- Free-form line items (description, amount) — add/edit/remove inline
- Expense line items (if any expenses are linked — future v2)
- Totals: subtotal, super, total
- Action strip: **[Preview] [Download PDF] [Send] [Mark Paid]**
- Status auto-advances draft → issued when email is sent; manual mark paid with date picker
- **Delete invoice** — confirm Dialog with radio choice: "Keep entries (unlink from invoice)" (default) or "Delete entries too." Default is unlink — safer, less destructive.

**Invoice action flow (post-generation):**
```
Generate (from Entries group) →
  land on invoice detail →
    Preview    → /invoices/[id] — full HTML render of invoice template
    Download   → /api/invoices/[id]/pdf — react-pdf, streams as download
    Send       → email compose Sheet (pre-filled: client email, subject, body)
                   Fields: To (pre-filled), CC, BCC, Subject, Body
                   Checkbox: "Send me a copy" (pre-fills BCC with user's email)
                 → confirm → creates scheduled_emails row (scheduled_for = now by default,
                   or user-picked future time) → status advances to issued
    Mark Paid  → date picker (defaults to today) → status → paid
```

**Invoice number format:** `{prefix}-{zero-padded number}` e.g. `INV-042`. Generated by existing `next_invoice_number()` RPC. Unchanged.

---

### Dashboard (`/dashboard`)

**Purpose:** Financial overview + scheduled email management.

**Behaviour:**
- Month-to-date earnings vs same period last month
- Outstanding invoices (draft + issued) listed with client + amount
- 6-month earnings bar chart (current vs same period prior year) — shadcn Chart
- **Scheduled emails — priority panel:**
  - Pending sends: invoice number, recipient, scheduled time, cancel action
  - Recently sent: invoice number, recipient, sent time, status (sent/error)
  - "New email" action: pick invoice → compose → set send time (default: now) → schedule

---

### Clients (`/clients` and `/clients/[id]`)

**Purpose:** Manage client records.

**Behaviour:**
- List: active clients first, inactive below fold
- Tap → `/clients/[id]` — full detail and edit page
- Edit form: billing config, rates, super, contact info, address, ABN, notes, active toggle
- **Colour picker:** fixed 12-swatch palette (see Design section), stored as `clients.color`
- New client flow

---

### Expenses (`/expenses`)

**Purpose:** Personal expense records for tax purposes.

**Behaviour:**
- List of expenses, newest first
- Each row: date, category badge, description, amount
- Tap → edit Sheet
- "New expense" → Sheet: date, category (enum), description, amount, notes
- Filter by category, filter by financial year
- Running total for current FY in header
- Australian FY: July 1 – June 30. Labelled "FY 2025–26". FY start = July 1 of the opening year.

**Invoice integration (groundwork — not active in v1):**
- `expenses.is_billable` defaults to false; `expenses.invoice_id` always null in v1
- Future: uninvoiced billable expenses surfaced during invoice generation, pulled in as line items

---

### Settings (`/settings`)

**Purpose:** Business details used in invoice PDF header.

**Behaviour:**
- Business name, ABN, address, BSB/account number, super fund details
- `include_super_in_totals` toggle

---

### Calendar (`/calendar`) — v2

Deprioritised. Build after core flow is complete.

**Planned:** Monthly grid, entries per day, click empty date → new entry form pre-filled with that date, invoice status indicators, month navigation.

---

## Global Search

**Command palette** — `⌘K` on desktop, search icon → full-screen overlay on mobile.

- Searches: entries (description, brand, client), invoices (number, client, notes), clients (name, contact)
- Categorised results: Entries / Invoices / Clients
- Click result → navigate to that record
- Implementation: Supabase `ilike`. No full-text index needed at current data volume.
- Floats over any page via shadcn `Command` component. No dedicated route.

---

## Data Model

### Existing tables (unchanged)
Source of truth: migration files in `supabase/migrations/`. `supabase-schema.md` is the human-readable reference.

`clients`, `entries`, `invoices`, `invoice_line_items`, `invoice_sequence`, `business_details`, `client_workflow_rates`, `scheduled_emails`

**Invoice line items:** Free-form rows on an invoice. Structurally different from expenses — no source record, no billing type, cascade-deleted with invoice.

**`scheduled_emails`:** Key fields: `invoice_id`, `to_address`, `subject`, `body_text`, `scheduled_for`, `mark_issued`, `status` (pending/sent/error), `sent_at`, `error`. `invoice_html` is a Browserless artefact — drop in a future migration once Browserless is removed.

### Schema additions (migrations required)

**`clients.color text`** — user-selected hex from fixed palette. No default — existing rows will be `null`. UI renders a gray dot (`#9ca3af`) as fallback until user assigns a colour.

**Postgres enum `expense_category`** — values: `equipment`, `software`, `travel`, `education`, `meals`, `studio`, `props`, `other`

**`expenses` table**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → `auth.users.id` | RLS owner |
| `date` | date | `"YYYY-MM-DD"` string via PostgREST |
| `category` | `expense_category` enum | |
| `description` | text | |
| `amount` | numeric | |
| `notes` | text? | |
| `is_billable` | boolean | Default false |
| `invoice_id` | uuid? FK → `invoices.id` | Null in v1 |
| `created_at` | timestamptz | |

RLS: `user_id = auth.uid()`, WITH CHECK on insert/update.

---

## Business Logic

Keep in `lib/calculations.ts`.

### `calcDayRate(entry, client, workflowRates)`
- Full: `client.rate_full_day` / Half: `client.rate_half_day`
- ICONIC bonus via `client_workflow_rates`:
  - `is_flat_bonus`: pay `max_bonus` if `skus >= kpi`, else 0
  - Otherwise: `incentive_rate_per_sku × min(max(skus − kpi, 0), upper_limit_skus)`, capped at `max_bonus`
- Super: `client.pays_super` → `(base + bonus) × client.super_rate`

### `calcHourly(entry, client)`
- `hours_worked = (finish − start − break_minutes) / 60`
- Rate: `rate_hourly_photographer` or `rate_hourly_operator`, fallback `rate_hourly`
- Super: same

### `calcManual(entry, client)`
- `base_amount` user-entered; super same

---

## PDF Generation

**One template, three render modes** — `InvoiceDocument.tsx` uses `@react-pdf/renderer` primitives throughout:

- **Preview** (`/invoices/[id]`): `<PDFViewer>` client component renders the PDF inline via iframe/blob URL — no separate HTML template needed
- **Download** (`/api/invoices/[id]/pdf`): Route Handler calls `renderToBuffer()` server-side, streams as `Content-Disposition: attachment`
- **Email attachment**: same Route Handler buffer passed to Resend as attachment

No template duplication. No sync problem. Preview shows the actual PDF — appropriate since it *is* the document the client will receive.

Removes Browserless dependency entirely. Email Edge Function fetches invoice data and calls the Route Handler (or calls `renderToBuffer` directly) instead of using stored `invoice_html`.

---

## Email

- **Provider:** Resend
- **Mechanism:** Rewrite of the existing Supabase Edge Function (not a new function alongside it). Polls `scheduled_emails` for `status = 'pending'` and `scheduled_for <= now()`, generates PDF via `renderToBuffer`, calls Resend API with PDF attachment, updates `status` to `sent` or `error`, sets `sent_at`
- If `mark_issued = true`: advances linked invoice to `issued` after successful send
- **Switchover is atomic** — deploy rewritten function and stop writing `invoice_html` in the same release. Legacy rows with `invoice_html` are ignored by the new function (it fetches invoice data directly). Drop `invoice_html` column in a follow-up migration once legacy rows are cleared.
- Next.js app only creates/cancels `scheduled_emails` rows — does not send directly
- `scheduled_emails.error text` column already exists — no migration needed

**Email compose fields:**
- **To** — pre-filled from `client.email`
- **CC** — optional free-text field
- **BCC** — optional free-text field
- **"Send me a copy"** checkbox — when checked, appends user's own email to BCC
- **Subject** — pre-filled
- **Body** — pre-filled, editable

**Schema:** `scheduled_emails` needs `cc text` and `bcc text` columns (migration required). Edge Function passes these to Resend's `cc`/`bcc` fields.

---

## Design Direction

**From:** Playful, rounded, DOM-mutated.
**To:** Precision tool. Grid-aligned. Comfortable density. Professional, not corporate.

### Principles
- **Mono for data, Inter for labels.** JetBrains Mono for amounts, dates, invoice numbers, times, codes. Inter for labels, headings, body.
- **Grid discipline.** Consistent column alignment across entry rows, invoice tables, client lists.
- **Minimal chrome.** Borders and separators over cards and shadows. `rounded-sm` or none on data surfaces.
- **Status as colour.** Chips text-first, small: draft = muted gray, issued = amber, paid = green.
- **Comfortable density.** Compact rows, generous internal padding. Spreadsheet rhythm — not crowded.
- **Dark mode from the start.** `darkMode: 'class'`. shadcn CSS variables handle all variants.

### Client colour palette
12 swatches at Tailwind ~500 saturation — readable on both light and dark backgrounds:

| | Name | Hex |
|---|---|---|
| ● | Indigo | `#6366f1` |
| ● | Violet | `#8b5cf6` |
| ● | Purple | `#a855f7` |
| ● | Pink | `#ec4899` |
| ● | Rose | `#f43f5e` |
| ● | Orange | `#f97316` |
| ● | Amber | `#f59e0b` |
| ● | Emerald | `#10b981` |
| ● | Teal | `#14b8a6` |
| ● | Cyan | `#06b6d4` |
| ● | Blue | `#3b82f6` |
| ● | Sky | `#0ea5e9` |

### shadcn/ui components
- `Table` — invoice list (desktop), expense list (desktop), invoice line items
- `Sheet` — entry form, invoice detail (mobile), expense form, email compose
- `Dialog` — delete confirmations
- `Command` — global search palette (`⌘K`)
- `Select`, `Form`, `Input`, `Textarea` — forms
- `Badge` — status chips, billing type, expense category
- `Button`, `Separator`, `Skeleton` — standard
- `Chart` — dashboard earnings chart

---

## What to Drop

- **Browserless** — replaced by `@react-pdf/renderer` + Resend
- **View slider / CSS panel hack** — replaced by routes
- **sessionStorage view persistence** — URL is state
- **Global `getState()` pattern** — server components + React context
- **Custom drag-to-dismiss** — shadcn Sheet native
- **iframe invoice preview** — replaced by `/invoices/[id]` route
- **Generate bar on Invoices tab** — replaced by per-group action on Entries
- **"PWA" framing** — online-only responsive web app; no service worker or manifest needed

---

## Decisions Log

| Decision | Outcome |
|---|---|
| Dark mode | From the start — `darkMode: 'class'` |
| Client colours | User-defined, 12-swatch palette, `clients.color` migration |
| Mobile tabs | Dashboard, Entries, Invoices, Clients — Expenses/Settings/Calendar in overflow |
| Desktop breakpoint | `md` (768px) — sidebar replaces bottom tabs |
| Default route | `/entries` |
| Data fetching | Server components for reads, Server Actions for mutations, no SWR |
| Auth method | Email/password, Supabase Auth |
| Infinite scroll | "Load earlier" button — simpler than upward anchor scroll |
| Invoice generation UX | Per-group action on Entries; Invoices tab shows count signal only |
| Invoice sort default | Chronological; toggle to client-grouped; persisted to localStorage |
| Invoice number format | `{prefix}-{padded}` e.g. `INV-042`, existing RPC unchanged |
| Entry deletion | Delete in edit Sheet, confirm Dialog |
| Invoice deletion | Radio in confirm Dialog — default: unlink entries; option: delete entries |
| Colour null fallback | Gray dot `#9ca3af` for clients with no colour assigned |
| Edge Function | Rewrite existing (not new); atomic switchover with `invoice_html` deprecation |
| Australian FY | July 1 – June 30; labelled "FY 2025–26" |
| Send = schedule | Creates `scheduled_emails` row; `scheduled_for` defaults to now |
| Scheduled emails | Priority dashboard panel; Resend as provider |
| Email mechanism | Supabase Edge Function cron — not Next.js |
| PDF templates | One `@react-pdf/renderer` template; `PDFViewer` for preview, `renderToBuffer` for download/email |
| Super rate | Always `client.super_rate` — 12% is DB default only, never hardcoded |
| Expense categories | Postgres enum `expense_category` |
| Expenses v1 | Personal records only — schema future-ready for billable |
| Calendar | v2 |
| Global search | `Command` palette, `ilike`, no dedicated route |
| PDF generation | `@react-pdf/renderer`, Route Handler |

---

## Constraints

- Supabase RLS policies unchanged; new migrations additive only
- Same Supabase keys in `.env.local`
- All dates are `"YYYY-MM-DD"` strings — never `Date` objects from API
- Australian locale: AUD, `en-AU` formatting
- `client.super_rate` always used — no hardcoded rates in application code
