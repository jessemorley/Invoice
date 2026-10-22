<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architecture

## Navigation — SPA view-switch

The app uses a single route (`/`) with a `?view=` search param rather than separate Next.js pages. All views are rendered in `src/components/view-switch.tsx` and toggled with CSS (`hidden` / `contents`). Tab switches are instant — no network round-trip.

**Adding a new view:**
1. Add the view to `VIEWS` in `src/components/active-view-context.tsx` (`ViewId`, the dock and the sidebar all come from it)
2. Create the client component (e.g. `src/app/(app)/newview/newview-client.tsx`)
3. Add a browser loader to `src/lib/view-loaders.ts` (query bodies go in `src/lib/reads.ts`)
4. Add state, a `fetchView` case, and a render slot to `ViewSwitch`
5. Add the tag mapping to `TAG_TO_VIEWS` in `ViewSwitch`

## Data fetching

Views fetch their data lazily on first reveal via browser loaders in `src/lib/view-loaders.ts`, which query Supabase directly with the user's session (RLS applies). Data is held in local `useState` inside `ViewSwitch` and saved to IndexedDB (`src/lib/view-cache.ts`, keyed to the user ID): on launch the saved copy fills empty views immediately, never overwriting fresher data, and each view still re-fetches on first reveal. The login page clears the saved data.

## Offline app shell

`public/sw.js` serves navigations to `/` and `/_next/static/*` from cache (caches named `pages-<build>` / `static-<build>`, build = commit SHA via `NEXT_PUBLIC_BUILD_ID`) and refreshes the page in the background. Never put view data in the HTML of `/`: a cached copy would be stale. If a loader finds the session gone for good it throws `SignedOutError` and `ViewSwitch` sends the user to `/login`, which clears both the IndexedDB data and the cached pages. After a deploy, `UpdateReloader` (`src/components/update-reloader.tsx`) compares the running build with `GET /api/version` on launch, resume and reconnect, and reloads into the new build with `?fresh=1` (network-first in the worker) when no sheet or dialog is open, otherwise the next time the app is backgrounded. The worker keeps the previous build's caches as well as the current ones, so the first launch after an update still works offline. `src/lib/sw.test.ts` and `src/lib/sw-skew.test.ts` pin down the worker's behaviour.

Tab switches update the URL with `window.history.replaceState`, not `router.replace`, so they never fetch the route from the server.

## Data refresh after mutations

**Server actions cannot call `window.dispatchEvent`** — they run on the server.

Instead, client components call `invalidate()` from `src/lib/invalidate.ts` *after* awaiting a mutation action. `ViewSwitch` listens for the resulting `data:invalidate` event and re-fetches every affected view that has already been loaded.

**Pattern — in any client component:**
```ts
import { invalidate } from "@/lib/invalidate";

await createEntry(data);
invalidate("entries");            // triggers re-fetch of entries + dashboard + invoices
```

**When adding a new mutation action:**
1. After `await yourAction(...)` in the client component, call `invalidate(tag)` with the relevant tag(s)
2. If the action affects a new data domain, add the tag to `InvalidationTag` in `src/lib/invalidate.ts` and update `TAG_TO_VIEWS` in `ViewSwitch`

**Tag → affected views mapping** (defined in `ViewSwitch`):
| Tag | Views re-fetched |
|---|---|
| `entries` | entries, dashboard, invoices |
| `invoices` | invoices, dashboard |
| `clients` | clients, entries, invoices |
| `expenses` | expenses, dashboard |
| `settings` | settings |

`ViewSwitch` also re-fetches the active view on `visibilitychange` (tab focus) to catch external changes.
