# Skeleton Loading Pattern

This app uses a consistent pattern for skeleton loading across all views. The shadcn `Skeleton` component (`src/components/ui/skeleton.tsx`) provides the animated shimmer block.

## How it works

1. The **page** (`page.tsx`) reads search params synchronously, then wraps the async data-fetching component in `<Suspense>`.
2. The **fallback** is the client component rendered with `loading={true}` and no data — the header/controls appear immediately, and the content area shows skeleton placeholders.
3. The **client component** accepts a `loading` prop. When true, it renders skeletons in place of real data and disables interactive controls.
4. The **"Load more" / "Load earlier" button** is replaced by skeleton rows/cards while `loadPending` is true.

## Applying to a new view

### 1. Add skeleton components to the client file

Mirror the shape of your real UI using `<Skeleton>` blocks. Match widths/heights roughly to actual content.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// For a table view:
function SkeletonTableRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-3 w-24" /></TableCell>
          <TableCell><Skeleton className="h-3 w-32" /></TableCell>
          {/* ...one cell per column */}
        </TableRow>
      ))}
    </>
  );
}

// For a card/list view:
function SkeletonCards({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4 p-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden py-0 gap-0">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Separator />
          <div className="px-4 py-3.5">
            <Skeleton className="h-3 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### 2. Add a `loading` prop to the client component

Make all data props optional and add `loading?: boolean`:

```tsx
type Props = {
  items?: Item[];        // was required, now optional
  filters: Filters;
  loading?: boolean;     // new
};

export function MyView({ items = [], filters, loading = false }: Props) {
```

### 3. Disable controls while loading

Add `disabled={loading}` to buttons, inputs, and selects in the header:

```tsx
<Button disabled={loading}>New item</Button>
<Input disabled={loading} />
<Select disabled={loading}>...</Select>
```

### 4. Swap content area for skeletons

In the scrollable content area, branch on `loading`:

```tsx
// Table body:
<TableBody>
  {loading ? (
    <SkeletonTableRows />
  ) : items.length === 0 ? (
    <EmptyState />
  ) : (
    items.map(...)
  )}
</TableBody>

// Card/list:
<div className="flex-1 overflow-y-auto">
  {loading ? <SkeletonCards /> : <RealContent />}
</div>
```

### 5. Replace "Load more" with skeletons while pending

```tsx
{!loading && (
  loadPending ? (
    <SkeletonTableRows count={3} />  // or SkeletonCards
  ) : (
    <div className="text-center py-2">
      <Button variant="ghost" size="sm" onClick={handleLoadMore}>
        Load more
      </Button>
    </div>
  )
)}
```

### 6. Split the page into data + Suspense

```tsx
// page.tsx
import { Suspense } from "react";
import { MyView } from "./my-view";

async function MyViewData({ filters }: { filters: Filters }) {
  const data = await fetchData(filters);
  return <MyView items={data} filters={filters} />;
}

export default async function MyPage({ searchParams }: PageProps) {
  const filters = parseFilters(await searchParams);

  return (
    <Suspense fallback={<MyView filters={filters} loading />}>
      <MyViewData filters={filters} />
    </Suspense>
  );
}
```

> **Why pass `filters` to the fallback?** Filter controls in the header render immediately with the correct state (e.g. selected status, search term), so the UI doesn't flash incorrect values when data arrives.

## Sizing skeletons

| Element | Typical classes |
|---|---|
| Short text (date, number) | `h-3 w-20` |
| Medium text (name) | `h-3 w-28` or `h-3 w-32` |
| Flex-fill text | `h-3 flex-1` |
| Color dot | `size-2 rounded-full` or `size-2.5 rounded-full` |
| Badge | `h-5 w-12 rounded-full` |
| Button | `h-7 w-16 rounded-md` |
| Avatar | `size-8 rounded-full` |

Keep skeleton row heights matching real row heights (`py-3.5` → `h-3` content) so the layout doesn't shift when content loads.

## Existing implementations

- **Entries view** — [src/components/entries-view.tsx](../src/components/entries-view.tsx) / [src/app/(app)/entries/page.tsx](../src/app/(app)/entries/page.tsx)
- **Invoices view** — [src/app/(app)/invoices/invoices-client.tsx](../src/app/(app)/invoices/invoices-client.tsx) / [src/app/(app)/invoices/page.tsx](../src/app/(app)/invoices/page.tsx)
