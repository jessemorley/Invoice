# Feature Gap: Original → New PWA

Features present in the original vanilla JS app (`/Users/jmorley/dev/invoicing-app/pwa`) that are missing or incomplete in this Next.js rebuild.

---

## 1. Client Management

The client sheet currently only writes two fields (`color` and `show_super_on_invoice`). Everything else is read-only.

**Missing entirely:**
- Create client
- Delete client
- Active/inactive toggle

**Editable in original, read-only here:**
- Billing type (`day_rate` / `hourly` / `manual`)
- Rates: full day, half day, hourly, photographer rate, operator rate
- Invoice frequency (`weekly` / `per_job`)
- Contact details: email, address, suburb, ABN, contact name, notes
- Super settings: `pays_super` toggle, `super_rate` percentage
- Hourly-specific: default start/finish times, entry label, show role toggle

**Workflow rates — schema exists, zero UI:**
- The `client_workflow_rates` table is in the DB and type definitions exist, but there is no interface to manage per-client KPI/SKU bonus structures (workflow name, KPI threshold, upper limit SKUs, incentive per SKU, max bonus cap, flat bonus option).

---

## 2. Expense CRUD ✅ Completed

Create, edit, and delete are now fully implemented:
- `src/app/(app)/expenses/actions.ts` — `createExpense`, `updateExpense`, `deleteExpense` server actions
- `src/components/expense-sheet.tsx` — right-side sheet with date, category, description, amount, GST toggle (with ex-GST summary), and notes fields
- `src/app/(app)/expenses/expenses-client.tsx` — sheet wired to "New expense" button, mobile FAB, row/card clicks; filters (search, timeframe, category) now functional

**Receipt uploads ✅ Completed:**
- `POST /api/expenses/[id]/receipt` — uploads file to Supabase Storage `receipts` bucket at `{userId}/{expenseId}/{filename}` and writes `receipt_path`
- `getReceiptUrl(path)` server action — generates a 1-hour signed URL and opens it in a new tab
- `deleteReceipt(expenseId, path)` server action — removes from storage and clears `receipt_path`
- Expense sheet shows "Attach receipt…" button when empty; when a file is attached shows filename with View and Remove actions; pending file (not yet saved) distinguished from saved receipt

---

## 3. Invoice Line Items

The `invoice_line_items` table, foreign key, and TypeScript types all exist. No UI has been built.

**Missing:** Add, edit, and delete custom line items on invoices (used for miscellaneous charges not tied to entries).

---

## 4. Email Invoices

The `scheduled_emails` table is fully defined in the DB (see schema below) but nothing is wired to the UI.

### Planned send flow (per redesign brief)
1. User opens invoice detail sheet → taps "Send"
2. Email compose sheet opens, pre-filled:
   - **To** — `client.email`
   - **CC / BCC** — optional free text
   - **"Send me a copy"** checkbox — appends `business_details.email` to BCC when checked
   - **Subject** — pre-filled, editable
   - **Body** — pre-filled plain text, editable
3. User optionally picks a future send time via time picker with presets (e.g. tomorrow morning, this afternoon, Monday morning)
4. On confirm, a row is inserted into `scheduled_emails` with `status = 'pending'`

### Send mechanism (planned, not built)
- A **Supabase Edge Function** polls `scheduled_emails` for rows where `status = 'pending'` AND `scheduled_for <= now()`
- Calls `/api/invoices/[id]/pdf` to generate the PDF attachment
- Passes PDF + email fields to **Resend** (third-party email API)
- On success: sets `status = 'sent'`, `sent_at = now()`
- On failure: sets `status = 'error'`, writes error message to `error` column
- If `mark_issued = true` on the row: advances the invoice from `draft` → `issued`

### `scheduled_emails` table schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth user |
| `invoice_id` | uuid \| null | FK → invoices.id |
| `to_address` | text | recipient |
| `cc_address` | text \| null | |
| `bcc_address` | text \| null | |
| `subject` | text | |
| `body_text` | text | plain-text email body |
| `invoice_html` | text | deprecated (Browserless artifact, to be dropped) |
| `filename` | text | PDF attachment filename |
| `mark_issued` | boolean | advance invoice to issued after send |
| `scheduled_for` | timestamptz | when to send (defaults to now for immediate) |
| `status` | text | `pending` / `sent` / `error` |
| `sent_at` | timestamptz \| null | |
| `error` | text \| null | error detail on failure |
| `created_at` | timestamptz | |

### Settings that affect email
- `invoice_sequence.mark_as_issued_on_send` — global toggle; when true, every sent email auto-advances its invoice to `issued`. Already persisted by `saveInvoicingSettings()` in `settings/actions.ts`.
- `business_details.email` — used as the "send me a copy" BCC address.

### Missing UI & backend
- Email compose sheet component
- "Send" button in invoice sheet
- Supabase Edge Function (poll + Resend call)
- Email status indicators on invoice cards/list
- Scheduled emails panel (view pending, cancel, resend)

---

## 5. Settings Gaps

The original app has two settings that don't appear in the new version:

- **Financial year start month** — used to scope expense totals and charts to the correct FY (e.g. July for Australian FY)
- **Mark as issued on PDF export** — automatically advances a draft invoice to issued when the user downloads the PDF (separate from the "mark as issued on send" email setting, which does exist here)
