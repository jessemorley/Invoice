# Plan: Email Invoice Feature — Full UI Implementation

## Context

The backend is already more complete than the feature-gap doc suggests. Two Edge Functions are deployed and active:
- **`send-invoice-email`** — inserts a `scheduled_emails` row (for future send) or fires immediately via Resend. Uses Browserless to render `invoice_html` → PDF attachment.
- **`process-scheduled-emails`** — cron-triggered, picks up `pending` rows past their `scheduled_for` time, sends via Resend + Browserless, updates status, and advances invoice to `issued` if `mark_issued = true`.

The DB has 5 real rows (3 `sent`, 1 `cancelled`, 1 also `cancelled`), confirming the pipeline works end-to-end.

**The only thing missing is the UI.** There is no Send button, no compose sheet, and no way to view or cancel scheduled/sent emails from within the PWA.

**PDF pipeline decision:** Switch from Browserless → react-pdf. The `/api/invoices/[id]/pdf` route already works and produces the canonical PDF. The Edge Functions will be updated to call this route instead of Browserless, removing the Browserless dependency and the `invoice_html` field from the payload.

---

## What to Build

### 1. "Send" button in `invoice-sheet.tsx`

Add a **Send** button next to the existing Download PDF button in the Actions section (line 128–135). Clicking it opens the email compose sheet.

The button should show a **status indicator** derived from the invoice's scheduled email state:
- No pending email → plain "Send" button
- Pending email exists → "Scheduled" badge/button (clicking lets you view/cancel)
- Last email was sent → "Sent" with timestamp

To support this, `InvoiceSheet` needs to receive the scheduled email status. The cleanest approach: pass a `scheduledEmail` prop of type `ScheduledEmail | null`.

---

### 2. `EmailComposeSheet` component

**File:** `src/components/email-compose-sheet.tsx`

A right-side sheet following the exact same pattern as `invoice-sheet.tsx`. Pre-filled fields:

| Field | Pre-fill source |
|---|---|
| To | `invoice.client.email` |
| CC | empty |
| BCC | empty |
| "Send me a copy" checkbox | if checked, appends `business_details.email` to BCC |
| Subject | `"Invoice {invoice.number}"` |
| Body | Plain text template (greeting + invoice details + payment info) |
| Send time | "Now" (immediate) or a future datetime |

**Send time UX:** A segmented control or select with presets:
- Now (immediate)
- This afternoon (today 5 PM local)
- Tomorrow morning (tomorrow 8 AM local)
- Monday morning (next Mon 8 AM local)
- Custom → shows a `<input type="datetime-local">` 

All times stored as UTC in `scheduled_for`.

**On submit:** Calls a new server action `scheduleInvoiceEmail()` in `src/app/(app)/invoices/actions.ts` which inserts directly into `scheduled_emails` via Supabase (no longer needs to call the Edge Function for scheduling — only the cron `process-scheduled-emails` function needs updating).

---

### 3. Server action: `scheduleInvoiceEmail()`

**File:** `src/app/(app)/invoices/actions.ts`

```ts
export async function scheduleInvoiceEmail(invoiceId: string, data: EmailFormData): Promise<void>
```

- Inserts a row into `scheduled_emails` directly via Supabase server client
- `filename`: `"{invoice.number}.pdf"` — fetch the invoice number via a lightweight query
- `scheduled_for`: `data.scheduled_for ?? new Date().toISOString()` (immediate = now)
- Invalidates a new `CACHE_TAGS.scheduledEmails` cache tag and calls `refresh()`

**EmailFormData type:**
```ts
export type EmailFormData = {
  to: string;
  cc: string;
  bcc: string;
  send_copy_to_self: boolean;  // if true, append business_details.email to bcc
  subject: string;
  body_text: string;
  scheduled_for: string | null; // ISO string, null = send now
  mark_issued: boolean;
}
```

### 3b. Update `process-scheduled-emails` Edge Function

Replace the Browserless PDF generation with a fetch to the Next.js PDF route:

```ts
// Instead of Browserless:
const pdfRes = await fetch(`${NEXTJS_BASE_URL}/api/invoices/${row.invoice_id}/pdf`);
const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
```

Add `NEXTJS_BASE_URL` env var to the Edge Function (e.g. `https://invoicing-pwa.vercel.app`).

The `send-invoice-email` function (immediate send path) similarly gets updated to call the PDF route instead of Browserless. Since scheduling now happens via server action directly, the `send-invoice-email` function becomes optional/legacy — but updating it keeps parity if it's ever called directly.

**New env var needed:** `NEXTJS_BASE_URL` set in Supabase Edge Function secrets.

---

### 4. Fetch scheduled email state for invoices

**File:** `src/lib/queries.ts`

Add:
```ts
export type ScheduledEmail = {
  id: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  to_address: string;
  scheduled_for: string;
  sent_at: string | null;
  error: string | null;
}

export async function fetchScheduledEmailForInvoice(invoiceId: string, userId: string): Promise<ScheduledEmail | null>
```

Fetches the most recent non-cancelled `scheduled_emails` row for the invoice (ordered by `created_at desc`, limit 1). Cached with `CACHE_TAGS.scheduledEmails`.

Add `scheduledEmails` to `CACHE_TAGS`.

---

### 5. Wire scheduled email state into the invoices page

**File:** `src/app/(app)/invoices/invoices-client.tsx`

When an invoice sheet opens, fetch the scheduled email for that invoice and pass it as a prop to `InvoiceSheet`.

Simplest approach: add a `loadScheduledEmail(invoiceId)` server action that calls `fetchScheduledEmailForInvoice`. The invoices client calls it when the sheet opens (via `useEffect` on the selected invoice ID).

---

### 6. Cancel scheduled email action

**File:** `src/app/(app)/invoices/actions.ts`

```ts
export async function cancelScheduledEmail(scheduledEmailId: string): Promise<void>
```

Updates `scheduled_emails.status = 'cancelled'` where `id = scheduledEmailId` and `user_id = PROTOTYPE_USER_ID`. Invalidates cache and refreshes.

Show a "Cancel scheduled send" button in the invoice sheet when a `pending` email exists.

---

## Files to Create / Modify

**New files:**
| File | Purpose |
|---|---|
| `src/components/email-compose-sheet.tsx` | Email compose sheet component |

**Modified files:**
| File | Change |
|---|---|
| `src/components/invoice-sheet.tsx` | Add Send button + email status indicator, accept `scheduledEmail` prop |
| `src/app/(app)/invoices/actions.ts` | Add `scheduleInvoiceEmail()`, `cancelScheduledEmail()`, `loadScheduledEmail()` |
| `src/lib/queries.ts` | Add `fetchScheduledEmailForInvoice()`, `ScheduledEmail` type, `scheduledEmails` CACHE_TAG |
| `src/app/(app)/invoices/invoices-client.tsx` | Call `loadScheduledEmail` when sheet opens, pass result to `InvoiceSheet` |

**New migration:**
| File | Change |
|---|---|
| `supabase/migrations/20260427_drop_invoice_html_from_scheduled_emails.sql` | `ALTER TABLE scheduled_emails DROP COLUMN invoice_html` |

**Edge Functions to update (via Supabase MCP `deploy_edge_function`):**
| Function | Change |
|---|---|
| `process-scheduled-emails` | Replace Browserless PDF with fetch to `{NEXTJS_BASE_URL}/api/invoices/{id}/pdf` |
| `send-invoice-email` | Same Browserless → react-pdf swap for parity |

---

## Key Implementation Notes

- **PDF pipeline:** Edge Functions fetch `{NEXTJS_BASE_URL}/api/invoices/{id}/pdf` for the PDF bytes. No Browserless. No `invoice_html` HTML rendering in the server action.
- **`invoice_html` column:** Drop it with a migration (`ALTER TABLE scheduled_emails DROP COLUMN invoice_html`). It's deprecated and unused after the Browserless → react-pdf switch.
- **Prototype auth:** The app uses `PROTOTYPE_USER_ID` consistently across every server action (invoices, entries, expenses, settings). This feature follows the same pattern. Auth migration is a separate, app-wide concern — not something to solve here. The `process-scheduled-emails` cron runs with service role and processes all pending rows regardless of user, so the pipeline functions correctly.
- **`cancelled` status:** The DB already has cancelled rows. The `ScheduledEmail` type must include `'cancelled'` and `'failed'` (the cron function uses `'failed'`, not `'error'` — note this differs from the feature-gap doc).
- **`mark_issued` default:** Read `invoice_sequence.mark_as_issued_on_send` and use it as the default for the checkbox in the compose sheet.
- **`NEXTJS_BASE_URL` env var:** Must be set in Supabase Edge Function secrets before the updated Edge Functions will work. Use the production Vercel URL.

---

## Verification

1. Open an invoice sheet → "Send" button appears in the actions row
2. Click Send → email compose sheet opens, pre-filled with client email and invoice number in subject
3. Toggle "Send me a copy" → business email appears in BCC field
4. Choose "Tomorrow morning" → scheduled_for is set to next day 8 AM local
5. Submit → row appears in `scheduled_emails` with status `pending`
6. Check Supabase: `SELECT * FROM scheduled_emails ORDER BY created_at DESC LIMIT 1`
7. For immediate send: row transitions to `sent` within seconds (cron fires)
8. If `mark_issued = true`: invoice status in UI updates to `issued`
9. Reopen invoice sheet → status indicator shows "Scheduled" or "Sent [date]"
10. For a pending email: "Cancel scheduled send" button appears and works
