# Multi-workflow entries + pro-rata bonus maths

Branch: `claude/multi-value-workflows-bonus-gbis0j`

## Context

A day-rate entry currently holds exactly one `workflow_type` and one `skus` count. That
breaks down for The Iconic's **Product** workflow, where a single day is routinely split
across batches — eg. 31 Batch A and 38 Batch B. Today that has to be logged as one batch
(losing the split) or as two entries (double-charging the day rate).

Each batch carries its own KPI, incentive rate and upper limit, so the bonus can't just be
summed: 31 against a KPI of 40 and 38 against a KPI of 50 each look like an under-performing
day, yet together they beat a normal day's output. The fix is to treat KPI as a *share of a
day* and pay the bonus on the combined excess.

Outcome: one entry per day, an arbitrary number of Product batches on it, and a bonus that
degrades to exactly today's number when there's only one workflow.

### Decisions already made

| Question | Decision |
|---|---|
| Bonus model | Pro-rata day share (below) |
| Bonus cap | Weighted blend — equals the shared max when all maxes match, which is the expected case |
| Invoice format | One `Product` line + per-batch SKU sub-rows + the existing single combined bonus row |
| Scope | Product sub-workflows only (Batch A–D, Flatlay, Model Shot). Apparel and Own Brand stay single-value |

## The maths

For the selected workflows (SKUs > 0, rate row found):

```
shareᵢ  = skusᵢ / kpiᵢ            // fraction of a day's target that batch represents
P       = Σ shareᵢ                // total day progress
```

- `P ≤ 1` → no bonus (didn't beat the day's combined target).
- `P > 1` → each batch's KPI allowance is pro-rated to its share of the day, so
  `allowanceᵢ = kpiᵢ × shareᵢ/P = skusᵢ/P`, leaving

```
bonusSkusᵢ = skusᵢ × (1 − 1/P)
raw        = Σ bonusSkusᵢ × incentive_rate_per_skuᵢ
cap        = Σ (shareᵢ/P) × max_bonusᵢ
U          = Σ skusᵢ / upper_limit_skusᵢ
bonus      = U ≥ 1 ? cap : min(raw, cap)    // rounded to cents
```

Worked example (KPI 40 / 50): `P = 31/40 + 38/50 = 1.535`, factor `= 0.3485` →
10.8 bonus SKUs on Batch A, 13.2 on Batch B, each at its own rate, capped by the blend.

**Back-compatible by construction.** One workflow: `P = s/kpi`, so
`bonusSkus = s(1 − kpi/s) = s − kpi`, `cap = max_bonus`, `U = s/upper_limit` — identical to
`calcDayRate` today, including the `s ≥ upper_limit → max_bonus` and `s ≤ kpi → 0` branches.

Edge rules: `kpi ≤ 0` on a non-flat rate makes `share = ∞` (every SKU bonusable, `factor = 1`)
with cap weights falling back to SKU proportion; `upper_limit_skus ≤ 0` likewise contributes ∞
to `U`. Rows with 0 SKUs are dropped before any division, which also removes today's quirk
where a 0-SKU entry against a 0 upper limit pays full max bonus. Flat-bonus workflows stay
single-value (UI-enforced) and keep today's flat `max_bonus`; they are excluded from the
pro-rata if they ever appear alongside another workflow.

## Data model

Add a nullable `workflow_items jsonb` column to `entries`:

```json
[{ "workflow": "Batch A", "skus": 31 }, { "workflow": "Batch B", "skus": 38 }]
```

`workflow_type` and `skus` stay populated as the denormalised summary — `workflow_type` is
the single batch name, or `"Product"` when there's more than one; `skus` is the total. That
means every existing read path (entries list, invoice sheet, suggested-invoice sheet, PDF qty
and bonus rows, invoice subtotals) keeps working untouched and already renders the agreed
invoice format — a single `Product` line with the combined SKU bonus. Only the new per-batch
sub-rows and the entry sheet need to read `workflow_items`. Legacy rows keep `null` and follow
the single-value path; no backfill.

## Tasks

### Schema
- [ ] `supabase/migrations/20260730000000_entry_workflow_items.sql` — `alter table entries add
      column workflow_items jsonb;` (nullable, no default; existing RLS policies cover it)
- [ ] `src/lib/database.types.ts` — add `workflow_items: Json | null` to the `entries`
      Row/Insert/Update blocks (hand-edit now, regenerate with `supabase gen types` later)

### Calculation — `src/lib/entry-calc.ts`
- [ ] Export `type WorkflowItem = { workflow: string; skus: number | null }`
- [ ] Change `calcDayRate(client, dayType, workflow, skus, rates)` →
      `calcDayRate(client, dayType, items: WorkflowItem[], rates)`, implementing the formula
      above in a private `calcWorkflowBonus` helper. Base/super/total handling unchanged.
      Only caller is `src/components/entry-sheet.tsx:282`

### Types + queries
- [ ] `src/lib/types.ts` — add `workflow_items: WorkflowItem[] | null` to `Entry` and
      `InvoiceEntry`
- [ ] `src/lib/queries.ts` — add `workflow_items` to the three entry selects and their mappers
      (~lines 122, 389/405, 838/863), casting the JSON to `WorkflowItem[] | null`

### Entry sheet — `src/components/entry-sheet.tsx`
- [ ] `FormState` gains `workflow_items: WorkflowItem[]`, used only while the top-level
      workflow is `Product`. Apparel keeps the existing single `skus` field; Own Brand and
      manual untouched
- [ ] `defaultForm` hydrates from `entry.workflow_items`, falling back to
      `[{ workflow: entry.workflow_type, skus: entry.skus }]` for legacy Product rows. Derive
      `topWorkflow` from that list rather than `PRODUCT_WORKFLOWS.includes(workflow_type)`, so
      a saved `"Product"` re-opens correctly
- [ ] Replace the Product sub-`SegmentedControl` + shared SKUs field with a repeating row:
      `Select` (from `src/components/ui/select.tsx`, options = `productSubOptions` minus
      batches already chosen, flat-bonus batches excluded once a second row exists) + number
      `Input` for SKUs + a remove button shown only when there's more than one row, then an
      **Add batch** button disabled when every available batch is used. Selecting Product
      seeds one row
- [ ] `calcResult` passes the item list for Product,
      `[{ workflow: "Apparel", skus: form.skus }]` for Apparel,
      `[{ workflow: "Own Brand", skus: null }]` for Own Brand
- [ ] `buildPayload` writes `workflow_items` (Product only, else `null`), `workflow_type` =
      single batch name or `"Product"`, and `skus` = the summed total
- [ ] `SummaryPanel` gains a total-SKUs line when more than one batch is present;
      Base/Bonus/Total rows stay as they are

### Persistence — `src/app/(app)/entries/actions.ts`
- [ ] `EntryFormData` gains `workflow_items`; include it in the `insert` and `update` payloads

### Invoice PDF — `src/components/invoice-document.tsx`
- [ ] Add a `{ type: "workflow_item"; entry; item }` row variant, emitted in `buildRows` after
      the entry row when `workflow_items.length > 1`, rendered through the existing
      `EntrySubRow` as `  Batch A — 31 SKUs`. The main line (`Product`) and the existing
      `  + SKU bonus (69 SKUs)` row already work off `workflow_type` / `skus`

Invoice totals need no change — `src/app/(app)/invoices/actions.ts` only ever sums stored
`base_amount + bonus_amount`.

## Verification

- [ ] Formula parity check **before** touching the UI: script the old and new bonus functions
      over a sweep of single-workflow inputs (below KPI, between KPI and upper limit, above
      upper limit, flat bonus, `kpi = 0`) and assert identical output
- [ ] `npm run build` and `npm run lint`
- [ ] `npm run dev`, then against an Iconic-style client with Batch A/B rates configured:
  - [ ] single Batch A entry → bonus and invoice line unchanged from before the change
  - [ ] 31 Batch A + 38 Batch B → summary bonus matches the hand-computed pro-rata figure
  - [ ] push both batches past their upper limits → bonus lands exactly on the cap
  - [ ] half-day → no bonus
  - [ ] remove a batch back down to one → entry saves as that batch, not `Product`
- [ ] Re-open each saved entry to confirm the rows round-trip, then generate the PDF via
      `GET /api/invoices/[id]/pdf` and check the `Product` line, the per-batch sub-rows and the
      single combined bonus row
- [ ] Confirm a pre-existing entry created before the migration still opens and edits correctly

## Review

_(fill in after implementation)_
