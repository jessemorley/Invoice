# Plan: FY Monthly Earnings Summary PDF

## Context

The user wants a printable PDF summarising month-by-month earnings for the current Australian financial year (July 1 – June 30). The app already generates invoice PDFs via `@react-pdf/renderer`; this reuses that pattern for a new report type, accessible via a download button on the Dashboard.

**Data semantics (verified against code):**
- "Earnings" = `base_amount + bonus_amount`. This matches how the dashboard already defines earnings — `fetchDashboardEntries` selects only `base_amount, bonus_amount` ([src/lib/queries.ts:155](src/lib/queries.ts#L155)).
- Super is tracked separately in `super_amount`.
- `total_amount` is stored as `base + bonus + super` ([src/lib/entry-calc.ts:59](src/lib/entry-calc.ts#L59)). We **read `total_amount` directly** rather than recomputing, so the report never drifts from the stored value.
- There is a `business_details.include_super_in_totals` flag ([src/lib/queries.ts:591](src/lib/queries.ts#L591)) that is currently unused everywhere. **Decision:** this report shows Earnings, Super, and Total as three separate columns regardless of that flag, so the flag is intentionally irrelevant here.

---

## Execution guide (read first)

This plan is precise enough to execute step-by-step. Work in the listed order — each step compiles on its own except the component+route, which depend on the types and query. **Verify against the live files, not from memory** — line numbers below were accurate at plan time but may have shifted; re-grep before editing.

### Rules that override your defaults (this is Next.js 16, not your training data)
1. **Never** create a Supabase client and pass it into a `"use cache"` function — it is not serializable and breaks the cache. Query functions take `(userId, token)` and call `createTokenClient(token)` themselves. See any function in `src/lib/queries.ts`.
2. **Never** invent `format.ts` exports. The real ones are `formatAUD`, `formatDate`, `formatDateShort`, `todayInSydney`. There is **no** `fmtAmount`/`fmtDateShort`. The invoice PDF's `fmtAmount` is a local helper inside `invoice-document.tsx`.
3. Copy the auth block in the route **verbatim** from the invoice route GET handler. Do not paraphrase it.
4. Read `src/components/invoice-document.tsx` in full before writing the new PDF component — match its `StyleSheet.create()` idiom, Helvetica usage, and structure exactly.
5. Before adding any shadcn/ui component, invoke the `shadcn` MCP skill. (This plan needs only `Button`, which already exists — so no new component is expected.)
6. Run `npm run build` **and** `npm run lint` before declaring done. Do not commit on `main` — use the `feature/fy-earnings-summary-pdf` branch (step 1).
7. No `Co-Authored-By` lines in commits.

### Before you start — confirm these still hold (1 min)
```bash
# Each should print the expected anchor; if not, re-locate before editing.
grep -n "export function todayInSydney" src/lib/format.ts          # FY utils go after this
grep -n "export async function fetchBusinessDetails" src/lib/queries.ts
grep -n "import { TrendingDown" src/app/(app)/dashboard/dashboard-client.tsx  # add Download here
grep -n "PageHeader title=\"Dashboard\"" src/app/(app)/dashboard/dashboard-client.tsx  # TWO hits: skeleton + real
sed -n '43,65p' "src/app/api/invoices/[id]/pdf/route.ts"           # the auth block to copy verbatim
```

### TODO checklist
- [ ] **0. Branch** — `git checkout -b feature/fy-earnings-summary-pdf` (confirm not on `main`).
- [ ] **1. format.ts** — append `currentFYYear()` + `fyDateRange()` (step 2). Build-check.
- [ ] **2. types.ts** — add `FYMonthlyRow` + `FYSummary` exactly as in step 3 (note `rangeLabel`).
- [ ] **3. queries.ts** — add private `monthLabel()` + `fetchFYMonthlySummary(userId, token)` (step 4). Confirm signature is `(userId, token)`, `"use cache"` + `cacheTag(CACHE_TAGS.entries)`, and that it selects `total_amount` (not recomputed). Add `currentFYYear, fyDateRange` to the existing `@/lib/format` import.
- [ ] **4. earnings-summary-document.tsx** — new component (step 5). Read `invoice-document.tsx` first. `business` typed `BusinessDetails | null`; null-guard **every** `business?.x`. Local amount formatter or `formatAUD`. 12 rows + totals + footer.
- [ ] **5. route.ts** — create `src/app/api/reports/earnings-summary/` dir + `route.ts` (step 6). Verbatim auth block. `GET()` takes **no** args. Both fetches use `(userId, token)`. Keep the `eslint-disable` above `renderToBuffer(element as any)`.
- [ ] **6. dashboard-client.tsx** — add `Download` to the lucide import (line ~18), add the `<a download>` + `<Button>` to the **real** PageHeader (line ~202, the one inside the `return`, NOT the skeleton at ~51).
- [ ] **7. build** — `npm run build` passes, zero type errors.
- [ ] **8. lint** — `npm run lint` clean. If an *unrelated* pre-existing issue surfaces, append it to `docs/pre-existing-issues.md` instead of fixing inline.
- [ ] **9. manual verify** — `npm run dev`, run the Verification section below end-to-end.
- [ ] **10. commit** — one logical commit, clear message, no attribution. Do not merge; open a PR only after build+lint+manual all pass.

### If anything goes sideways
Stop and re-plan rather than patching around it. Common failure → cause:
- Type error on the cache function → you passed a client in; switch to `(userId, token)`.
- `fmtAmount is not defined` → use a local helper or `formatAUD`.
- 401 on download → auth block paraphrased; copy it verbatim from the invoice route.
- Button missing on dashboard → you edited the skeleton PageHeader (line ~51) not the real one (~202).

---

## Implementation Steps

### 1. New branch
```bash
git checkout -b feature/fy-earnings-summary-pdf
```

### 2. Add FY utilities to `src/lib/format.ts`

Add two exports at the bottom. Note `todayInSydney()` already exists in this file ([format.ts:59](src/lib/format.ts#L59)) and returns a `"YYYY-MM-DD"` string.

```ts
// Returns the AU financial year end-year (e.g. 2025 for FY25: Jul 2024–Jun 2025)
export function currentFYYear(): number {
  const today = todayInSydney(); // "YYYY-MM-DD" in Australia/Sydney
  const month = parseInt(today.slice(5, 7), 10);
  const year = parseInt(today.slice(0, 4), 10);
  return month >= 7 ? year + 1 : year;
}

// Returns ISO date strings for a given FY year (e.g. 2025 → Jul 2024–Jun 2025)
export function fyDateRange(fyYear: number): { start: string; end: string } {
  return {
    start: `${fyYear - 1}-07-01`,
    end: `${fyYear}-06-30`,
  };
}
```

### 3. Add types to `src/lib/types.ts`

```ts
export type FYMonthlyRow = {
  month: string;    // "2024-07"
  label: string;    // "Jul 2024"
  earnings: number; // base_amount + bonus_amount
  super: number;    // super_amount
  total: number;    // total_amount (stored as base + bonus + super)
};

export type FYSummary = {
  fyLabel: string;       // "FY25"
  rangeLabel: string;    // "1 July 2024 – 30 June 2025"
  rows: FYMonthlyRow[];  // 12 months Jul–Jun, always present (zeros included)
  totalEarnings: number;
  totalSuper: number;
  grandTotal: number;
};
```

### 4. Add query to `src/lib/queries.ts`

Add `fetchFYMonthlySummary(userId, token): Promise<FYSummary>`. **Signature must be `(userId, token)`** to match every other query in this file — the function creates its own RLS client internally. (The `"use cache"` directive cannot take a non-serializable Supabase client as an argument, so do NOT pass a client in.)

```ts
export async function fetchFYMonthlySummary(userId: string, token: string): Promise<FYSummary> {
  "use cache";
  cacheTag(CACHE_TAGS.entries);
  const supabase = createTokenClient(token);

  const fyYear = currentFYYear();
  const { start, end } = fyDateRange(fyYear);

  const { data, error } = await supabase
    .from("entries")
    .select("date, base_amount, bonus_amount, super_amount, total_amount")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);
  if (error) throw new Error(`fetchFYMonthlySummary: ${error.message}`);

  // Sum into a Map keyed by "YYYY-MM"
  const byMonth = new Map<string, { earnings: number; super: number; total: number }>();
  for (const e of data ?? []) {
    const key = e.date.slice(0, 7);
    const acc = byMonth.get(key) ?? { earnings: 0, super: 0, total: 0 };
    acc.earnings += e.base_amount + e.bonus_amount;
    acc.super += e.super_amount;
    acc.total += e.total_amount;
    byMonth.set(key, acc);
  }

  // Build a fixed 12-month grid Jul(fyYear-1) → Jun(fyYear); months with no
  // entries render as zero rows so the PDF always has 12 rows.
  const rows: FYMonthlyRow[] = [];
  let totalEarnings = 0, totalSuper = 0, grandTotal = 0;
  for (let i = 0; i < 12; i++) {
    const m = ((6 + i) % 12) + 1;           // 7,8,...,12,1,...,6
    const y = i < 6 ? fyYear - 1 : fyYear;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const acc = byMonth.get(key) ?? { earnings: 0, super: 0, total: 0 };
    rows.push({
      month: key,
      label: monthLabel(key),
      earnings: acc.earnings,
      super: acc.super,
      total: acc.total,
    });
    totalEarnings += acc.earnings;
    totalSuper += acc.super;
    grandTotal += acc.total;
  }

  return {
    fyLabel: `FY${String(fyYear).slice(-2)}`,
    rangeLabel: `1 July ${fyYear - 1} – 30 June ${fyYear}`,
    rows,
    totalEarnings,
    totalSuper,
    grandTotal,
  };
}
```

Private month-label helper (top of file, near other helpers):
```ts
// "2024-07" → "Jul 2024"
function monthLabel(yyyymm: string): string {
  return new Date(yyyymm + "-01T00:00:00").toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
  });
}
```

Add `currentFYYear`, `fyDateRange` to the existing `@/lib/format` import in queries.ts.

### 5. Create PDF component `src/components/earnings-summary-document.tsx`

Mirror [src/components/invoice-document.tsx](src/components/invoice-document.tsx) conventions:
- `@react-pdf/renderer`: `Document`, `Page`, `Text`, `View`, `StyleSheet`
- **Props:** `{ summary: FYSummary; business: BusinessDetails | null }` — type `business` as nullable and null-guard **every** `business?.…` access (the route may pass a user with no `business_details` row).
- **Currency formatting:** define a local `fmtAmount` helper inside the component (the invoice document does this — `format.ts` does NOT export `fmtAmount`). Either reuse the local pattern from `invoice-document.tsx`, or import `formatAUD` from `@/lib/format`. Do not reference `fmtAmount`/`fmtDateShort` as if they were shared exports — they are not.
- Page: A4, `paddingHorizontal: 32`, `paddingTop: 28`, `paddingBottom: 40`, Helvetica
- Colors: `#000000` text, `#555555` subtext (same as invoice doc)

Sections:
1. **Business header** (top-left): `business?.business_name`, `business?.abn`, `business?.address` — each conditionally rendered.
2. **Title**: large text e.g. `"{summary.fyLabel} Earnings Summary"` (fontSize ~39, letterSpacing -0.5)
3. **Date range subtext**: `summary.rangeLabel` in `#555555`
4. **Table** with columns: Month | Earnings | Super | Total
   - Header row (uppercase, small, `#555555`)
   - 12 data rows from `summary.rows`; numbers right-aligned via the local amount formatter
   - Divider before totals
5. **Totals row** (bold): `summary.totalEarnings`, `summary.totalSuper`, `summary.grandTotal`
6. **Footer**: `"Generated [date]"` small gray text at bottom (use `formatDate`/`formatDateShort` from `@/lib/format`, or `toLocaleDateString("en-AU")`)

### 6. Create API route `src/app/api/reports/earnings-summary/route.ts`

The `src/app/api/reports/` directory does not exist yet — create it. Follow the **GET** handler in [src/app/api/invoices/[id]/pdf/route.ts:43-65](src/app/api/invoices/[id]/pdf/route.ts#L43-L65) verbatim for auth — copy these exact lines (the plan's earlier `session.access_token`/`claims.sub` shorthand was wrong; those variable names do not exist):

```ts
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { fetchFYMonthlySummary, fetchBusinessDetails } from "@/lib/queries";
import { createClient } from "@/lib/supabase-server";
import { createTokenClient } from "@/lib/supabase"; // only if needed; queries make their own client
import { EarningsSummaryDocument } from "@/components/earnings-summary-document";

export async function GET() {
  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const token = sessionData.session.access_token;
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = claimsData.claims.sub;

  const [summary, business] = await Promise.all([
    fetchFYMonthlySummary(userId, token),
    fetchBusinessDetails(userId, token),
  ]);

  const element = React.createElement(EarningsSummaryDocument, {
    summary,
    business: business ?? null,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  const bytes = new Uint8Array(buffer);

  const name = business?.business_name;
  const filename = name
    ? `${name} ${summary.fyLabel} Earnings Summary.pdf`
    : `${summary.fyLabel} Earnings Summary.pdf`;

  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}
```

Notes:
- `fetchFYMonthlySummary` and `fetchBusinessDetails` both take `(userId, token)` and build their own RLS client — do not create one here unless something else needs it.
- The `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment above `renderToBuffer(element as any)` is required or lint fails (matches the invoice route).
- This is a public route handler (no `req`/`params` needed since there's no dynamic segment), so the GET takes no arguments.

### 7. Add download button to Dashboard

In [src/app/(app)/dashboard/dashboard-client.tsx](src/app/(app)/dashboard/dashboard-client.tsx), add the button to the **real** `PageHeader` at **line 202** (NOT the loading-skeleton one at line 51). `PageHeader` accepts `children` and renders them in a right-aligned flex container ([page-header.tsx](src/components/page-header.tsx)).

```tsx
<PageHeader title="Dashboard">
  <a href="/api/reports/earnings-summary" download>
    <Button variant="outline" size="sm">
      <Download className="h-4 w-4 mr-1.5" />
      FY Summary
    </Button>
  </a>
</PageHeader>
```

**`Download` is NOT yet imported.** Add it to the `lucide-react` import at [line 18](src/app/(app)/dashboard/dashboard-client.tsx#L18), which currently reads:
```ts
import { TrendingDown, TrendingUp, BarChart2 } from "lucide-react";
```
→ add `Download`. `Button` is already imported (line 19).

---

## Files Modified / Created

| File | Change |
|------|--------|
| `src/lib/format.ts` | Add `currentFYYear()`, `fyDateRange()` |
| `src/lib/types.ts` | Add `FYMonthlyRow`, `FYSummary` |
| `src/lib/queries.ts` | Add `fetchFYMonthlySummary(userId, token)` + private `monthLabel()` |
| `src/components/earnings-summary-document.tsx` | **New** — React PDF component |
| `src/app/api/reports/earnings-summary/route.ts` | **New** — GET endpoint (dir is new) |
| `src/app/(app)/dashboard/dashboard-client.tsx` | Add `Download` import + button on line-202 PageHeader |

---

## Caching note

`fetchFYMonthlySummary` is tagged `CACHE_TAGS.entries`, so it is already invalidated whenever entries change (existing mutations call `revalidateTag(CACHE_TAGS.entries)`). No new cache tag or `InvalidationTag`/`TAG_TO_VIEWS` wiring is required — the PDF is fetched fresh on each download via the route handler anyway.

---

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — clean (watch the `any` eslint-disable in the route)
3. `npm run dev` → open Dashboard → click "FY Summary" button
4. PDF downloads and opens: 12-month table (Jul→Jun), correct `FY##` label, date range `1 July YYYY – 30 June YYYY`
5. Column totals (Earnings, Super, Total) match the sum of the rows; Total column equals stored `total_amount` sums
6. Months with no entries render as `$0.00` rows (not missing) — new/empty account still produces a valid 12-row PDF
7. Filename includes business name when set in Settings; falls back to `"FY## Earnings Summary.pdf"` when no `business_details` row exists
8. Business header fields each hidden gracefully when absent (no "undefined" text)
