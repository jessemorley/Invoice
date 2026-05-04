# Performance Optimisation Plan

**Baseline (May 2025)**

| Metric | Current | Target | Status |
|---|---|---|---|
| Time to First Byte | 0.28s | <0.8s | ✅ |
| First Contentful Paint | 3.44s | <1.8s | ❌ |
| Largest Contentful Paint | 4.36s | <2.5s | ❌ |
| Interaction to Next Paint | 72ms | <200ms | ✅ |
| Cumulative Layout Shift | 0.21 | <0.1 | ⚠️ |
| Real Experience Score | 63 | 90+ | ❌ |

TTFB and INP are excellent — the server is fast and interactions are snappy. The problem is entirely in the client-side loading sequence: a large JS bundle followed by a data-fetch waterfall before anything meaningful renders.

---

## Root Cause Analysis

### The loading sequence today

```
0.00s  HTML delivered (TTFB 0.28s) — page has no visible content
       ViewSwitch renders null for all views (data not loaded yet)
       
       ↓ Browser downloads + parses the JS bundle (SLOW)
       
~1.5s  React hydrates
       useEffect fires → server action called for entries data
       
       ↓ Server action round-trip to Supabase
       
~3.4s  FCP — navigation chrome becomes interactive
~4.4s  LCP — entries table finally painted with real data
```

The gap between TTFB (0.28s) and FCP (3.44s) is JS download and parse time. The gap between FCP and LCP (another 1s) is the server action round-trip for data.

### Root cause 1: Monolithic client bundle (causes slow FCP)

`view-switch.tsx` is a `"use client"` component that **statically imports all 6 view components at once**. This means the initial JS bundle includes code for the dashboard, invoices, clients, expenses, and settings — even though the user lands on the entries view and may never visit the others in this session.

Known heavy inclusions bundled on every load:
- **recharts** (via `DashboardClient`) — AreaChart used in the 6-month earnings chart
- **6 sheet components** (via `InvoicesClient`) — InvoiceSheet, GenerateSheet, NewInvoiceSheet, EmailComposeSheet, SentEmailSheet, EntrySheet
- All Radix UI primitives for all views (Select, Command, Tabs, etc.)
- All server action code for all views

`@react-pdf/renderer` is confirmed **not** in the client bundle (correctly isolated in the server-side PDF API route).

### Root cause 2: Client-side data waterfall (causes slow LCP)

The entries view renders with `loading={!entriesData}` on first mount because `entriesData` starts as `null`. The data is fetched client-side via a server action after hydration. This means the LCP element (the entries table with real content) does not exist in the HTML — it appears ~1s after FCP, accounting for the 4.36s LCP.

The queries themselves use `"use cache"` (good), so the server action is fast once invoked. The problem is that the invocation doesn't happen until the client-side `useEffect` fires.

### Root cause 3: Duplicate auth calls (minor server overhead)

`AppLayout` and `AppPage` each call `getAuthUser()` / `getAuth()` independently. While Supabase's `getSession` is likely fast, this is unnecessary work on every request.

### Root cause 4: CLS (0.21 — content layout shift)

Likely causes:
- Navigation elements (sidebar, floating dock) appearing and shifting page content
- Table/list skeletons that don't accurately reserve the space of their real content
- Font loading shift if Inter/JetBrains Mono aren't preloaded

---

## Optimisation Plan

### P1 — Dynamic imports in ViewSwitch ⭐ (biggest FCP win)

**File:** `src/components/view-switch.tsx`

Replace all static view imports with `next/dynamic`. Each view gets its own JS chunk that loads on first reveal, not on initial page load.

```ts
// Before
import { DashboardClient } from "@/app/(app)/dashboard/dashboard-client";
import { InvoicesClient } from "@/app/(app)/invoices/invoices-client";
// ... etc

// After
import dynamic from "next/dynamic";

const DashboardClient = dynamic(
  () => import("@/app/(app)/dashboard/dashboard-client").then(m => m.DashboardClient),
  { ssr: false }
);
const InvoicesClient = dynamic(
  () => import("@/app/(app)/invoices/invoices-client").then(m => m.InvoicesClient),
  { ssr: false }
);
// ... same for ClientsView, ExpensesClient, SettingsClient
```

`EntriesView` is the default view and can remain statically imported (or also be dynamic — see P2). All other views load their JS chunk only when first navigated to.

**Expected impact:** Initial JS bundle shrinks dramatically (recharts, 6 invoice sheets, etc. all deferred). FCP should drop from 3.44s toward ~1.5s.

**Notes:**
- `ssr: false` is appropriate here since ViewSwitch is already `"use client"` and renders nothing server-side
- Each dynamic view can have a `loading` prop for a skeleton, but ViewSwitch already handles loading state via the `null` data pattern, so the skeleton is displayed regardless
- The `loadXxxViewData` server action imports in view-switch.tsx should also be reviewed — consider lazy-importing them alongside the view chunks

---

### P2 — Server-side render the initial view (biggest LCP win)

**Files:** `src/app/(app)/page.tsx`, `src/components/view-switch.tsx`

Currently, the entries view renders a loading skeleton on the server and fetches real data client-side. Instead, fetch entries data on the server and pass it as initial data so the LCP element (the entries table) is in the HTML from the start.

```ts
// src/app/(app)/page.tsx
import { loadEntriesViewData } from "@/app/(app)/actions";

async function ViewSwitchWithUser() {
  const { email, name } = await getAuthUser();
  // Fetch default view data server-side — already cached via "use cache"
  const initialEntriesData = await loadEntriesViewData();
  return (
    <ViewSwitch
      userEmail={email}
      userName={name}
      initialEntriesData={initialEntriesData}
    />
  );
}
```

```ts
// src/components/view-switch.tsx
export function ViewSwitch({ userEmail, userName, initialEntriesData }) {
  const [entriesData, setEntriesData] = useState<EntriesState>(
    initialEntriesData ?? null
  );
  // On first reveal of "entries", skip the fetch if data already loaded
  // ...
}
```

Since `loadEntriesViewData` calls `fetchEntries` which is tagged `"use cache"`, the server-side call is served from the cache — no extra Supabase round-trip in the common case.

**Expected impact:** The entries table renders in the initial HTML. LCP drops from 4.36s to near TTFB + render time (~0.5–1.0s). This is the single biggest LCP improvement possible.

**Notes:**
- The `revealed` ref in ViewSwitch already prevents a redundant client-side fetch if data is pre-loaded — just initialise `entriesData` with the server-supplied value instead of `null`
- The `"use cache"` on `fetchEntries` means the cache tag `entries` invalidation (`revalidateTag`) still works correctly for subsequent client refreshes

---

### P3 — Deduplicate auth calls

**Files:** `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`

Both `AppLayout` and `AppPage` independently call `getAuthUser()`. Since both are server components within the same request, Next.js deduplicates `fetch` calls automatically, but `supabase.auth.getUser()` may not benefit from this. 

Pass the user object from the layout to the page as a prop, or restructure to call `getAuthUser()` once at the layout level and provide it via a server context / prop drilling to child server components.

**Expected impact:** Minor — saves one Supabase auth call per request. More relevant for correctness/efficiency than a measurable user-facing improvement.

---

### P4 — Fix CLS (0.21 → <0.1)

Target the three likely sources:

**4a. Skeleton sizing — `src/components/entries-view.tsx` and all view components**

Skeleton containers must reserve the exact height that real content will occupy. Where skeletons use generic heights, audit against real rendered content heights. The TODO already notes: "Search bars and header items should not be skeletons, they should load as full assets immediately."

Apply this immediately: any header UI (search bars, buttons, toggles) should be rendered statically without skeleton treatment — they don't depend on data.

**4b. Navigation layout reservation**

The `SidebarProvider` and `FloatingDock` wrapped in `<Suspense>` may cause layout shifts as they appear. Ensure the SidebarInset has a stable width from the start, and the floating dock doesn't shift page content when it appears.

**4c. Font preloading**

`next/font/google` handles font optimisation automatically, but verify `display: optional` or `display: swap` is not causing a FOUT (flash of unstyled text) that contributes to CLS. The current setup with `Inter` and `JetBrains_Mono` via `next/font` should be fine, but confirm in DevTools.

---

### P5 — Lazy-load server action imports in ViewSwitch

**File:** `src/components/view-switch.tsx`

Currently all 6 `loadXxxViewData` server actions are imported at the top of ViewSwitch. While server actions themselves are small functions, they may pull in transitive imports. Once views are dynamically imported (P1), consider collocating the action import with the dynamic view import so the action function only loads when the view chunk loads.

This is a minor refinement after P1.

---

### P6 — Enable Partial Prerendering (future consideration)

Next.js 16 introduces Partial Prerendering (PPR), which can prerender the static shell (navigation, headers) at build time and stream dynamic content (user data) into it. This would make FCP nearly instant (the static shell is served from the CDN edge) while data fills in via streaming.

This is a larger architectural change and should be considered after P1–P4 are verified to confirm it's still needed.

---

---

## Critique and Risks

These are the specific problems found after reviewing the plan against the actual code, the Next.js 16 docs, and Vercel's runtime behaviour. Each one would either break the implementation or prevent it from delivering the expected improvement.

---

### 1. P2 will silently double-fetch — the biggest implementation trap

This is a bug that would completely negate the benefit of server-side data loading and is easy to miss.

`ViewSwitch` initialises `revealed` as an empty `Set`:
```ts
const revealed = useRef<Set<ViewId>>(new Set());
```

When the component mounts on the client, the `useEffect` fires immediately. Since `revealed.current.has("entries")` is `false`, it calls `fetchView("entries")`, which triggers `loadEntriesViewData()` — a server action round-trip — even when `initialEntriesData` was already provided as a prop and the entries are already rendered in the DOM.

The pre-loaded data is there, but the client immediately overwrites it with a duplicate fetch. LCP is unaffected (data was in the HTML), but you're making a redundant Supabase call on every page load.

**Fix:** When `initialEntriesData` is provided, initialise the `revealed` ref with `"entries"` already in it:
```ts
const revealed = useRef<Set<ViewId>>(
  new Set(initialEntriesData ? (["entries"] as ViewId[]) : [])
);
```

---

### 2. `"use cache"` does not persist across requests on Vercel — a core plan assumption is wrong

The plan states P2 is "free in the common case" because `fetchEntries` uses `"use cache"`. The Next.js docs say otherwise:

> **Serverless: Cache entries typically don't persist across requests (each request can be a different instance). Build-time caching works normally.**

On Vercel's serverless runtime, the `"use cache"` in-memory LRU store lives in the Lambda instance. A warm instance reuses it; a cold instance or a different Lambda instance starts fresh. For a personal app with low traffic, warm reuse is likely, but it is not guaranteed and degrades under load.

There's a second issue: all queries are keyed on the user's JWT token (via `createTokenClient(token)`). Since the token is part of the cache key, every user has isolated cache entries, and every time the token rotates (Supabase default: 1 hour), the cache is cold regardless of instance warmth.

**What this means for P2:** Server-side data fetching will almost always incur a real Supabase query. The plan's "no extra Supabase round-trip in the common case" claim should be removed. P2 is still worth doing — a server-to-Supabase connection in the same region (you've pinned functions to `syd1`) is faster than a client-to-Supabase connection across the internet — but the expected speed comes from network proximity, not caching.

**Longer-term fix:** `'use cache: remote'` with a persistent handler (Vercel KV) would give reliable cross-request caching. That's a bigger change, noted for later.

---

### 3. P1 (`ssr: false`) and P2 (SSR initial data) directly conflict for the default view

The plan is ambiguous here but the conflict is real.

The docs confirm: `ssr: false` disables server-side prerendering for that component. If `EntriesView` is dynamically imported with `ssr: false`, it produces no HTML on the server — it only renders on the client after its JS chunk downloads. If there's no server-rendered HTML for `EntriesView`, the `initialEntriesData` prop passed from the server has nothing to hydrate into. The LCP element never appears in the initial HTML stream.

P2 only delivers its LCP benefit if `EntriesView` is server-rendered.

**The correct split:**
- `EntriesView` → **static import** (server-rendered, benefiting from P2's initial data)
- All other views (Dashboard, Invoices, Clients, Expenses, Settings) → `dynamic(..., { ssr: false })`

The initial JS bundle then contains ViewSwitch + EntriesView code, which is still dramatically smaller than the current monolith (no recharts, no 6 invoice sheets, no settings forms). This is still a large FCP win.

---

### 4. Removing the Suspense fallback makes the perceived experience worse, not better

Currently the page loads like this:
1. HTML arrives → sidebar/dock shell visible
2. ViewSwitch Suspense resolves (just auth) → ViewSwitch renders with loading skeleton in entries slot
3. Client-side server action completes → entries table replaces skeleton

With P2, without a Suspense fallback:
1. HTML arrives → sidebar/dock shell visible
2. *Nothing in the content area* — Suspense has no fallback, so the slot is empty while auth + entries fetch runs server-side
3. Suspense resolves → entries table streams in

The LCP number improves (entries are now in the HTML, not waiting for client fetch), but the user stares at an empty content area for longer before seeing anything. The streaming docs are explicit:

> **Keep LCP elements outside or above Suspense boundaries so they render as part of the static shell.**

For an auth-gated app this isn't fully achievable, but the skeleton should appear immediately. The right fix is a `loading.tsx` file in `src/app/(app)/` (alongside `layout.tsx`). Next.js automatically uses it as the Suspense fallback for the whole route segment, and critically, it renders as part of the **static shell** — delivered with the very first HTML chunk, before any data fetching starts. The user sees the navigation chrome + a skeleton layout instantly, and the real entries content streams in when the server-side fetch completes.

The existing `loading.tsx` files (in `entries/`, `dashboard/`, etc.) are never reached under the current SPA architecture — they're for standalone page routes. The one that matters is at the `(app)/` level.

---

### 5. `getAuthUser()` makes a network call — two of them per request

The plan characterises P3 (deduplicate auth) as "minor." It isn't.

`getAuthUser()` calls `supabase.auth.getUser()`. Unlike `getSession()` (which reads the cookie), `getUser()` makes an HTTP round-trip to Supabase's auth server to verify the JWT. It's called independently by both `AppLayout` (for the sidebar user display) and `AppPage`'s `ViewSwitchWithUser` (for the email/name props to ViewSwitch).

These run in parallel (separate Suspense boundaries), so they don't block each other — but each is still a network call. For P2, `ViewSwitchWithUser` then also calls `loadEntriesViewData()` which calls `getAuth()` → `getSession()` (cookie read, fast). So the full P2 request makes:
- 2× `getUser()` (network) — one in layout, one in page
- 1× `getSession()` (cookie) — inside `loadEntriesViewData`
- 1× Supabase data query

Consolidating to a single `getUser()` call per request has real impact on server render time, which directly affects how quickly the Suspense resolves and content streams.

The idiomatic fix is to start `getUser()` as an unawaited promise in the layout and pass it down via a context provider, consuming it with `use()` inside the components that need it. The streaming docs show this pattern explicitly ("Sharing a promise across the tree").

---

### 6. `recharts` and `lucide-react` are already tree-shaken

Good news that changes the P1 story slightly. The `optimizePackageImports` docs confirm that both `recharts` and `lucide-react` are in the **default optimisation list** — Next.js already tree-shakes them automatically. Only the specific components you import (AreaChart, XAxis, etc.) are included, not the entire library.

This means recharts' bundle contribution is smaller than assumed. Dynamic import of `DashboardClient` is still worthwhile to defer even the tree-shaken recharts code from the initial bundle, but the headline bundle savings will be somewhat lower than initially suggested. The bigger wins are deferring the 6 invoice sheets, the settings form, and the client view.

---

### 7. Dynamic import `loading` prop interacts badly with ViewSwitch's hidden-div pattern

ViewSwitch uses CSS (`hidden` / `contents`) to show/hide views — the wrapper divs for non-active views are always in the DOM, just invisible. If you set a `loading` prop on a dynamic import, it renders in the component's position while the JS chunk downloads.

For non-active views, this means the loading component would render inside a `hidden` div — invisible and harmless. But if the `loading` prop renders something visible in the currently-active slot before the chunk loads, you'd get a double loading state (ViewSwitch skeleton + dynamic loading fallback).

**Fix:** Don't set a `loading` prop on any of the dynamic view imports. ViewSwitch's existing null-state → skeleton pattern handles loading states for all views correctly.

---

## Implementation Order

| # | Change | Files | Impact | Effort |
|---|---|---|---|---|
| 1 | Add `(app)/loading.tsx` skeleton | New file | User sees skeleton instantly; unblocks P2 | Low |
| 2 | Dynamic imports for Dashboard, Invoices, Clients, Expenses, Settings (NOT EntriesView) | `view-switch.tsx` | FCP: 3.44s → ~1.5s | Low |
| 3 | Server-side initial entries data + fix `revealed` ref init | `page.tsx`, `view-switch.tsx` | LCP: 4.36s → ~1.0–1.5s | Low-Medium |
| 4 | Deduplicate auth — promise-through-context pattern | `layout.tsx`, `page.tsx`, new context | Reduces server render time | Medium |
| 5 | Fix skeleton sizing and header rendering | All view components | CLS: 0.21 → <0.1 | Medium |
| 6 | `'use cache: remote'` for persistent cross-request caching | `queries.ts`, `next.config.ts` | Reliable cache hits on serverless | Medium |
| 7 | Partial Prerendering | Multiple files | FCP → ~0.3s (edge-served) | High |

**Do 1 + 2 first** (they are independent and low-risk). Add `loading.tsx` before enabling P2 server-side fetch or the content area will appear blank while the Suspense waits.

**Do 3 only after 1 and 2 are deployed and confirmed.** P2 has the double-fetch trap; implement and verify the `revealed` ref fix before assuming LCP improved.

**Measure after each step** before proceeding to the next. The LCP improvement from P2 comes from network proximity (server → Supabase same region), not caching — so the gain is real but bounded.

---

## What NOT to change

- **@react-pdf/renderer** — already correctly isolated in the server-side API route, not in the client bundle. No action needed.
- **`cacheComponents: true`** — already set in next.config.ts. Leave it.
- **`"use cache"` on queries** — correctly applied throughout queries.ts. The caching infrastructure is sound.
- **TTFB / INP** — both are already excellent. No changes needed to server infrastructure or interaction handlers.
- **Supabase queries** — no N+1 patterns found. Queries are efficient.
