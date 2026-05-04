# Implementation Plan — Performance Optimisations

Branch: `perf/initial-load`

This plan accompanies `performance-plan.md`. It is split into four sequential stages, each ending with a PAUSE point where the LLM runs its test suite, results are reviewed, and a commit is made before proceeding.

## Prerequisites

- On branch `perf/initial-load`
- Dev server running: `npm run dev`
- App accessible at `http://localhost:3000` (or the port shown at startup)
- Logged in to the app (auth cookie present)

## How LLM testing works

At each PAUSE point, the LLM will:
1. Call `nextjs_index` to discover the running server and its port
2. Call `nextjs_call(port, "get_errors")` to verify zero compilation errors
3. Call `browser_eval` with Playwright scripts to verify behaviour and measure metrics
4. Report results before proceeding

If any test fails, rollback that stage before moving to the next.

---

## Stage 1 — Loading skeleton (foundation)

**One new file. No existing code modified.**

This is the prerequisite for Stage 3. Without it, Stage 3's server-side fetch leaves the content area blank during the Suspense wait.

### Change

Create `src/app/(app)/loading.tsx`:

```tsx
import { EntriesView } from "@/components/entries-view";

export default function AppLoading() {
  return <EntriesView entries={[]} clients={[]} workflowRates={[]} loading />;
}
```

This reuses the existing `EntriesView` skeleton (same pattern as `entries/loading.tsx`) and renders as part of the static shell — delivered in the first HTML chunk, before any data fetching.

### Rollback

Delete the file.

---

### ⏸ PAUSE 1 — Test before committing

**Start the dev server, then signal ready. The LLM will run:**

```
1. nextjs_index → get port
2. nextjs_call(port, "get_errors") → expect: zero errors
3. browser_eval:
   - Navigate to http://localhost:3000
   - Assert entries header ("Entries") is visible within 500ms — confirms skeleton is in static shell
   - Assert full entry content appears after skeleton — confirms no regression
   - Assert no console errors
```

Playwright script:
```js
// Confirm skeleton renders immediately
await page.goto('http://localhost:3000');
const header = page.locator('h1:has-text("Entries")').first();
await expect(header).toBeVisible({ timeout: 500 });

// Confirm real content eventually loads
await page.waitForSelector('.card, [class*="card"]', { timeout: 10000 });

// Confirm no console errors
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.waitForTimeout(1000);
console.log('Console errors:', errors.length === 0 ? 'none ✓' : errors);
```

**Pass criteria:** Header visible < 500ms, no errors, content loads.

**On pass:** Commit with message `"Add (app)/loading.tsx skeleton for initial route"`

---

## Stage 2 — Dynamic imports (bundle splitting)

**One file modified. Removes the 5 non-default views from the initial JS bundle.**

This is independent of Stage 3 and can be committed separately. EntriesView stays as a static import — it must be server-rendered for Stage 3 to work.

### Change

**`src/components/view-switch.tsx`**

Add `dynamic` import at the top (after `"use client"`):
```ts
import dynamic from "next/dynamic";
```

Replace the 5 static view imports with dynamic equivalents. Keep `EntriesView` static:

```ts
// KEEP — static import required for SSR in Stage 3
import { EntriesView } from "@/components/entries-view";

// REPLACE the other 5 static imports with these:
const DashboardClient = dynamic(
  () => import("@/app/(app)/dashboard/dashboard-client").then(m => m.DashboardClient),
  { ssr: false }
);
const InvoicesClient = dynamic(
  () => import("@/app/(app)/invoices/invoices-client").then(m => m.InvoicesClient),
  { ssr: false }
);
const ClientsView = dynamic(
  () => import("@/app/(app)/clients/clients-view").then(m => m.ClientsView),
  { ssr: false }
);
const ExpensesClient = dynamic(
  () => import("@/app/(app)/expenses/expenses-client").then(m => m.ExpensesClient),
  { ssr: false }
);
const SettingsClient = dynamic(
  () => import("@/app/(app)/settings/settings-client").then(m => m.SettingsClient),
  { ssr: false }
);
```

Do **not** set a `loading` prop on any dynamic import — ViewSwitch's null-state skeleton handles loading state for all views.

### Rollback

Revert `view-switch.tsx` to static imports, remove the `dynamic` import line.

---

### ⏸ PAUSE 2 — Test before committing

**Start the dev server, then signal ready. The LLM will run:**

```
1. nextjs_index → get port
2. nextjs_call(port, "get_errors") → expect: zero errors
3. browser_eval:
   - Entries view loads correctly (no regression)
   - All 5 non-default views load when navigated to
   - Time to first visible heading is measured (FCP proxy)
   - No console errors on any view
```

Playwright scripts:
```js
// Test: entries view unchanged
await page.goto('http://localhost:3000');
await page.waitForSelector('h1:has-text("Entries")', { timeout: 5000 });
console.log('Entries view: ✓');

// Test: all non-default views render
for (const view of ['dashboard', 'invoices', 'clients', 'expenses', 'settings']) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:3000/?view=${view}`);
  await page.waitForLoadState('networkidle');
  const errorCount = errors.filter(e => !e.includes('Warning')).length;
  console.log(`${view}: ${errorCount === 0 ? '✓' : '✗ ' + errors.join(', ')}`);
}

// Test: FCP proxy — time to first h1
await page.goto('http://localhost:3000');
const t = Date.now();
await page.waitForSelector('h1', { timeout: 10000 });
console.log(`Time to first h1: ${Date.now() - t}ms (was ~3000ms before)`);
```

**Pass criteria:** All 6 views render without errors. Time to first h1 is faster than Stage 1 baseline.

**On pass:** Commit with message `"Dynamically import non-default views to split initial JS bundle"`

---

## Stage 3 — Server-side initial entries data

**Two files modified. The primary LCP fix.**

Fetches entries data server-side so the entries table is in the initial HTML stream. Also fixes the `revealed` ref bug that would otherwise trigger an immediate duplicate client-side fetch.

**Requires Stage 1 (`loading.tsx`) to be in place first.**

### Changes

**`src/app/(app)/page.tsx`** — fetch auth and entries in parallel, pass data as prop:

```tsx
import { Suspense } from "react";
import { ViewSwitch } from "@/components/view-switch";
import { getAuthUser } from "@/lib/auth";
import { loadEntriesViewData } from "@/app/(app)/actions";

async function ViewSwitchWithUser() {
  const [{ email, name }, initialEntriesData] = await Promise.all([
    getAuthUser(),
    loadEntriesViewData(),
  ]);
  return (
    <ViewSwitch
      userEmail={email}
      userName={name}
      initialEntriesData={initialEntriesData}
    />
  );
}

export default function AppPage() {
  return (
    <Suspense>
      <ViewSwitchWithUser />
    </Suspense>
  );
}
```

**`src/components/view-switch.tsx`** — two targeted changes:

1. Update the component signature and initialise `entriesData` state from the prop:

```ts
// Add to prop types:
initialEntriesData?: EntriesState;

// Update useState initialisation:
const [entriesData, setEntriesData] = useState<EntriesState>(
  initialEntriesData ?? null
);
```

2. Fix the `revealed` ref so it doesn't re-fetch on mount when data is pre-loaded:

```ts
// BEFORE:
const revealed = useRef<Set<ViewId>>(new Set());

// AFTER:
const revealed = useRef<Set<ViewId>>(
  new Set(initialEntriesData ? (["entries"] as ViewId[]) : [])
);
```

### Rollback

Revert `page.tsx` to the single-`getAuthUser()` version. Remove `initialEntriesData` prop from `view-switch.tsx`, revert `useState` and `revealed` ref to original.

---

### ⏸ PAUSE 3 — Test before committing

This is the most important test gate. Two critical things must be verified: entries are in the HTML (SSR working), and no duplicate fetch fires on mount.

**Start the dev server, then signal ready. The LLM will run:**

```
1. nextjs_index → get port
2. nextjs_call(port, "get_errors") → expect: zero errors
3. browser_eval:
   a. SSR check — disable JS, load page, verify entries header exists in raw HTML
   b. No-double-fetch check — count server action POSTs on initial load (expect 0 for entries)
   c. LCP proxy — time from navigation to real entry content visible
   d. Invalidation check — verify adding/editing an entry still refreshes the list
   e. Re-navigation check — entries do not re-fetch when navigating away and back
```

Playwright scripts:
```js
// Test a: SSR — entries header exists in raw HTML (no JS)
await page.setJavaScriptEnabled(false);
await page.goto('http://localhost:3000');
const headerInHTML = await page.locator('h1:has-text("Entries")').count();
console.log('Entries header in raw HTML (no JS):', headerInHTML > 0 ? '✓' : '✗ FAIL — SSR not working');
await page.setJavaScriptEnabled(true);

// Test b: Count server action POSTs on initial load
let postCount = 0;
page.on('request', req => {
  if (req.method() === 'POST') postCount++;
});
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
console.log(`Server action POSTs on initial load: ${postCount} (expect 0 for entries pre-load)`);

// Test c: Time to real content
const start = Date.now();
await page.goto('http://localhost:3000');
// Wait for a card element (real content, not skeleton)
// Skeletons use aria-hidden or a known class — adjust selector if needed
await page.waitForFunction(() => {
  const cards = document.querySelectorAll('[class*="card"]');
  // Real cards have text content; skeletons don't
  return Array.from(cards).some(c => c.textContent && c.textContent.trim().length > 10);
}, { timeout: 10000 });
console.log(`Time to real entry content: ${Date.now() - start}ms`);

// Test d: Navigation away and back doesn't re-fetch entries
let postCountNav = 0;
page.on('request', req => { if (req.method() === 'POST') postCountNav++; });
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
postCountNav = 0; // reset after initial load
// Navigate to another view
await page.goto('http://localhost:3000/?view=invoices');
await page.waitForLoadState('networkidle');
// Navigate back to entries
await page.goto('http://localhost:3000/?view=entries');
await page.waitForLoadState('networkidle');
console.log(`POSTs after entries re-navigation: ${postCountNav} (expect 0 — revealed ref should block re-fetch)`);
```

**Pass criteria:**
- Entries header in raw HTML: ✓
- Server action POSTs on initial load: 0 (or only for non-entries views if pre-navigated)
- Time to real content: faster than Stage 2 baseline
- No re-fetch when navigating back to entries

**On pass:** Commit with message `"Fetch initial entries data server-side; fix revealed ref double-fetch"`

---

## Stage 4 — CLS fixes (skeleton sizing)

**Multiple small changes across view components. Independent of Stages 2 and 3.**

Target CLS 0.21 → < 0.1. The main sources are skeletons that don't match real content dimensions, and header controls rendered as skeletons when they could be full-size immediately.

### Approach

Work through each view component. For each:
1. Remove `disabled` or skeleton treatment from header controls (title, search, toggle, buttons) — these don't depend on data
2. Ensure list/card skeletons fill enough of the viewport that replacing them doesn't shift content below the fold

Apply to each view in order, testing after each:
1. Entries view (`src/components/entries-view.tsx`)
2. Invoices view (`src/app/(app)/invoices/invoices-client.tsx`)
3. Dashboard view (`src/app/(app)/dashboard/dashboard-client.tsx`)
4. Clients, Expenses, Settings views

### Rollback per view

Revert the individual component file.

---

### ⏸ PAUSE 4 — Test before committing

Run after all view components have been updated.

**Start the dev server, then signal ready. The LLM will run:**

```
1. nextjs_index → get port
2. nextjs_call(port, "get_errors") → expect: zero errors
3. browser_eval — measure CLS on each view:
```

Playwright script (run for each view):
```js
for (const view of ['entries', 'invoices', 'dashboard', 'clients', 'expenses', 'settings']) {
  await page.goto(`http://localhost:3000/?view=${view}`);

  const cls = await page.evaluate(() => new Promise(resolve => {
    let total = 0;
    const obs = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) total += entry.value;
      }
    });
    obs.observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => { obs.disconnect(); resolve(total); }, 3000);
  }));

  console.log(`CLS ${view}: ${cls.toFixed(4)} — ${cls < 0.1 ? '✓' : '✗ needs work'}`);
}
```

**Pass criteria:** CLS < 0.1 on all views.

**On pass:** Commit with message `"Fix skeleton sizing and header rendering to reduce CLS"`

---

## Full regression suite

Run after all four stages are committed. This is the final validation before raising a PR.

**Start the dev server, then signal ready. The LLM will run the complete suite:**

```js
// 1. Zero compilation errors
// (via nextjs_call)

// 2. All views render without errors
for (const view of ['entries', 'dashboard', 'invoices', 'clients', 'expenses', 'settings']) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:3000/?view=${view}`);
  await page.waitForLoadState('networkidle');
  console.log(`${view}: ${errors.length === 0 ? '✓' : '✗ ' + errors.join('; ')}`);
}

// 3. FCP and LCP proxies
await page.goto('http://localhost:3000');
const vitals = await page.evaluate(() => new Promise(resolve => {
  const result = {};
  const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
  if (fcpEntry) result.fcp = fcpEntry.startTime;

  const obs = new PerformanceObserver(list => {
    const entries = list.getEntries();
    result.lcp = entries[entries.length - 1]?.startTime;
  });
  obs.observe({ type: 'largest-contentful-paint', buffered: true });
  setTimeout(() => { obs.disconnect(); resolve(result); }, 5000);
}));
console.log(`FCP: ${vitals.fcp?.toFixed(0)}ms (target: < 1800ms in prod)`);
console.log(`LCP: ${vitals.lcp?.toFixed(0)}ms (target: < 2500ms in prod)`);

// 4. SSR confirmed
await page.setJavaScriptEnabled(false);
await page.goto('http://localhost:3000');
const ssrOk = await page.locator('h1:has-text("Entries")').count() > 0;
console.log('SSR entries:', ssrOk ? '✓' : '✗');
await page.setJavaScriptEnabled(true);

// 5. Mutation + invalidation
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.click('button:has-text("New entry"), button[aria-label*="New entry"]');
const dialogVisible = await page.locator('[role="dialog"]').isVisible({ timeout: 3000 }).catch(() => false);
console.log('New entry sheet:', dialogVisible ? '✓' : '✗');
await page.keyboard.press('Escape');

// 6. View switch speed (skeleton must appear instantly)
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
const switchStart = Date.now();
await page.goto('http://localhost:3000/?view=invoices');
await page.waitForSelector('h1', { timeout: 5000 });
console.log(`View switch to invoices: ${Date.now() - switchStart}ms (target: < 300ms to skeleton)`);

// 7. CLS — entries view (primary view)
await page.goto('http://localhost:3000');
const cls = await page.evaluate(() => new Promise(resolve => {
  let total = 0;
  const obs = new PerformanceObserver(list => {
    for (const e of list.getEntries()) { if (!e.hadRecentInput) total += e.value; }
  });
  obs.observe({ type: 'layout-shift', buffered: true });
  setTimeout(() => { obs.disconnect(); resolve(total); }, 3000);
}));
console.log(`CLS (entries): ${cls.toFixed(4)} — ${cls < 0.1 ? '✓' : '✗'}`);
```

### Final pass criteria

| Check | Target | Notes |
|---|---|---|
| Compilation errors | 0 | Hard fail |
| All 6 views render | No errors | Hard fail |
| Entries SSR | ✓ | Hard fail |
| FCP proxy (dev) | Faster than pre-work baseline | Relative only |
| LCP proxy (dev) | Faster than pre-work baseline | Relative only |
| CLS (entries) | < 0.1 | Hard fail |
| New entry sheet opens | ✓ | Mutation regression check |
| View switch to skeleton | < 300ms | Soft fail — investigate |

> Dev-mode numbers are relative indicators. The real FCP/LCP targets (< 1800ms / < 2500ms) can only be confirmed in Vercel Speed Insights after deploying.

**On full pass:** Raise a PR from `perf/initial-load` to `main`.
