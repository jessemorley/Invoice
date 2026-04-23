# Plan: Full-Featured Entry Sheet with Client-Dependent Fields

## Context

The existing `EntrySheet` in the Next.js PWA is minimal — it shows basic fields (client, date, description, billing type, hours, amounts) but has no auto-calculation, no client-dependent conditional fields, and no touch-optimised controls. The legacy vanilla JS app at `/Users/jmorley/dev/invoicing-app/pwa/` has a sophisticated entry form we're replicating. The goal is to replace `entry-sheet.tsx` with a fully-featured, touch-friendly form that shows the right fields per client billing type and auto-calculates amounts.

## What Changes

**7 files total**, in dependency order:

### 1. `src/lib/types.ts`
- Add `default_start_time: string | null` and `default_finish_time: string | null` to `Client` type (already in DB schema, missing from type)
- Add `shoot_client`, `skus`, `brand`, `start_time`, `finish_time`, `break_minutes` to `Entry` type
- Add new `WorkflowRate` type:
```typescript
export type WorkflowRate = {
  id: string; client_id: string; workflow: string;
  is_flat_bonus: boolean; kpi: number; upper_limit_skus: number;
  incentive_rate_per_sku: number; max_bonus: number;
};
```

### 2. `src/lib/entry-calc.ts` (new file)
Pure calculation functions — no React, no side effects. Directly ported from legacy `utils.js`:
- `calcDayRate(client, dayType, workflow, skus, workflowRates) → CalcResult`
- `calcHourly(client, startStr, finishStr, breakMins, role) → CalcResult`
- `calcManual(amount, client) → CalcResult`
- `formatDuration(rawMins) → string` (e.g. "7h 30m")
- `toMins(timeStr: "HH:MM") → number`

`CalcResult = { base, bonus, superAmt, total, hoursWorked: number | null, rawMins?: number }`

Hourly rounding: `Math.round(rawMins / 60 / 0.25) * 0.25` (nearest 15 min)

### 3. `src/lib/queries.ts`
- Update `_fetchFullClients` select string to include `default_start_time, default_finish_time`; map in return
- Update `_fetchEntries` mapping to include `shoot_client`, `skus`, `brand`, `start_time`, `finish_time`, `break_minutes` from DB row
- Add `fetchWorkflowRates()` — fetches `client_workflow_rates` (no user_id column on this table, scoped via client_id). Cache under `CACHE_TAGS.clients` tag.

### 4. `src/app/(app)/entries/actions.ts`
- Expand `EntryFormData` to include all billing-type fields:
  `workflow_type`, `skus`, `brand`, `shoot_client`, `description`, `role`, `start_time`, `finish_time`, `break_minutes`, `hours_worked`, `super_amount`, `total_amount` (rename `hours` → `hours_worked`)
- Update `createEntry` / `updateEntry` DB payloads to persist all new fields
- Add `deleteEntry(id: string)` server action
- Change `fetchClients()` to call `fetchFullClients` instead of `_fetchClients`
- Add `loadWorkflowRates()` re-export

### 5. `src/app/(app)/entries/page.tsx`
```typescript
const [entries, clients, workflowRates] = await Promise.all([
  fetchEntries(PROTOTYPE_USER_ID),
  fetchClients(),
  loadWorkflowRates(),
]);
return <EntriesView entries={entries} clients={clients} workflowRates={workflowRates} />;
```
Suspense fallback adds `workflowRates={[]}`.

### 6. `src/components/entries-view.tsx`
- Import `Client` and `WorkflowRate` from `@/lib/types` (drop local minimal `Client` type)
- Add `workflowRates: WorkflowRate[]` prop
- Thread both down to `<EntrySheet>`

### 7. `src/components/entry-sheet.tsx` (full replacement)
See architecture below.

---

## EntrySheet Architecture

### Props
```typescript
{
  open: boolean; onOpenChange: (open: boolean) => void;
  entry: Entry | null;          // null = new entry
  clients: Client[];            // full Client objects
  workflowRates: WorkflowRate[];
}
```

### Form State (internal)
Single `FormState` object with all fields. Derived values (amounts, duration) computed via `useMemo` from form state + selected client.

### Layout
```
<SheetContent side="right" className="flex flex-col gap-0 p-0 w-full sm:max-w-md">
  Header (client name / "New entry")
  [Scrollable body]
    → ClientPicker (new entry, no client yet)
    → ClientChip + all fields (client selected)
  [SummaryPanel — sticky above footer]
  [Footer: Delete (edit only) + Save]
</SheetContent>
```

### Field Visibility Table

| Field | day_rate | hourly (label) | hourly (no label) | manual |
|---|---|---|---|---|
| Date | ✓ | ✓ | ✓ | ✓ |
| Day Type toggle | ✓ | | | |
| Workflow toggle | ✓ full day only | | | |
| Brand text | ✓ Own Brand | | | |
| SKUs number | ✓ Apparel/Product | | | |
| Custom label field (`entry_label`) | | ✓ | | |
| Description textarea | | | ✓ | ✓ |
| Role toggle (if `show_role`) | | ✓ | ✓ | |
| Start / Finish time | | ✓ | ✓ | |
| Break stepper | | ✓ | ✓ | |
| Amount input | | | | ✓ |

### Touch-Friendly Patterns
- **DayType / Workflow / Role toggles**: `div.grid.grid-cols-N` with explicit `h-12` buttons styled via `cn()` — NOT `ToggleGroup` (too small for touch)
- **Break stepper**: Large `-15` / `+15` buttons (`h-11 w-14`) flanking a big `text-2xl font-black` counter
- **Time inputs**: `<input type="time">` in rounded `bg-muted` blocks (native picker on iOS)
- **Client picker rows**: `min-h-[56px]` per row, full-width tap, search input at top

### Live Calculation
`useMemo` on form state + client → `CalcResult`. No `useEffect`. Recalculates instantly on every change. Shown in `SummaryPanel`:
- Hourly: Duration (`formatDuration(rawMins)`) + Base + Super + Total
- Day rate: Base + Bonus (if >0) + Super + Total  
- Manual: Base + Super + Total
- Super line only shown if `client.pays_super === true`

### Client Defaults on Selection (new entry)
- day_rate: day_type=`"full"`, workflow_type=`"Apparel"`, date=today
- hourly: start_time=`client.default_start_time?.slice(0,5) ?? "09:00"`, finish_time=`client.default_finish_time?.slice(0,5) ?? "17:00"`, break_minutes=0
- manual: manual_amount=0

### Edit Entry Pre-population
Map entry fields into form state. `shoot_client ?? description` for hourly-with-label entries. Client locked (no picker).

---

## Schema Verification (confirmed via Supabase MCP against project `cmbycqzjlwvydemaxrtb`)

Live DB matches `database.types.ts` exactly:
- **`clients`**: `default_start_time` / `default_finish_time` as `time without time zone`, `show_role bool`, `entry_label text`, `rate_hourly_photographer numeric`, `rate_hourly_operator numeric` — all present
- **`client_workflow_rates`**: `kpi int4`, `incentive_rate_per_sku numeric`, `upper_limit_skus int4`, `max_bonus numeric`, `is_flat_bonus bool` — all present. **No `user_id` column** — scoped only via `client_id`
- **`entries`**: `brand text`, `skus int4`, `shoot_client text`, `start_time time`, `finish_time time`, `break_minutes int4 default 0`, `hours_worked numeric`, `super_amount numeric`, `total_amount numeric`, `workflow_type text`, `role text` — all present

No schema migrations required. All columns already exist.

## Critical Files

- [entry-sheet.tsx](../src/components/entry-sheet.tsx) — full replacement
- [entries-view.tsx](../src/components/entries-view.tsx) — prop threading
- [entries/actions.ts](../src/app/(app)/entries/actions.ts) — expanded form data + delete action
- [entries/page.tsx](../src/app/(app)/entries/page.tsx) — parallel fetch
- [queries.ts](../src/lib/queries.ts) — full client + workflow rates queries
- [types.ts](../src/lib/types.ts) — type additions
- [entry-calc.ts](../src/lib/entry-calc.ts) — new calculation module (create)

## Verification

1. Open the entries page → click FAB (mobile) or "New entry" (desktop)
2. Client picker appears → select a day_rate client → Day Type + Workflow fields appear, summary updates live
3. Select "Full Day" + "Apparel" + enter SKUs → bonus and total calculate correctly
4. Select a different client with `billing_type=hourly` and `show_role=true` → role toggle appears, time fields default from client config, break stepper works
5. Select `billing_type=hourly` client with `entry_label` set → custom label field appears, no description field
6. Select `billing_type=manual` → amount input appears, description appears
7. Save new entry → appears in list with correct amounts
8. Click existing entry → edit sheet opens pre-populated, amounts match
9. Delete entry → entry removed from list
10. Test on mobile viewport — all tap targets ≥44px, time pickers use native iOS wheel
