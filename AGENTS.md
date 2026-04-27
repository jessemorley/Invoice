<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architecture

## Navigation — SPA view-switch

The app uses a single route (`/`) with a `?view=` search param rather than separate Next.js pages. All views are rendered in `src/components/view-switch.tsx` and toggled with CSS (`hidden` / `contents`). Tab switches are instant — no network round-trip.

**Adding a new view:**
1. Create the client component (e.g. `src/app/(app)/newview/newview-client.tsx`)
2. Add a server action loader to `src/app/(app)/actions.ts`
3. Add state, a `fetchView` case, and a render slot to `ViewSwitch`
4. Add the tag mapping to `TAG_TO_VIEWS` in `ViewSwitch`
5. Add the tab to `src/components/floating-dock.tsx` and `src/components/app-nav.tsx`

## Data fetching

Views fetch their data lazily on first reveal via server actions in `src/app/(app)/actions.ts`. Data is held in local `useState` inside `ViewSwitch`.

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
