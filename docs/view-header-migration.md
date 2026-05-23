# ViewHeader Migration Guide

`ViewHeader` replaces `PageHeader` across all views. It adds a mobile search toggle (title ↔ input crossfade), a collapsible filter bar below the header, and consistent desktop layout — all with no per-view boilerplate.

## Completed

| View | Status |
|---|---|
| Entries | ✅ Migrated |
| Invoices | ✅ Migrated |

## Remaining

| View | Search | Filters | Notes |
|---|---|---|---|
| Clients | ✅ has `searchValue` state | ❌ none | Desktop search input exists in content area |
| Expenses | ❌ none | ❌ none | Title-only header |
| Dashboard | ❌ none | ❌ none | Title-only header |
| Settings | ❌ none | ❌ none | Title-only header |

---

## Props reference

```tsx
<ViewHeader
  title="Entries"                          // required — page title + search placeholder
  searchValue={searchValue}                // required — controlled search string
  onSearchChange={setSearchValue}          // required — called on every keystroke + on close (with "")

  // Mobile filter bar toggle (omit if view has no filters)
  filterOpen={filterOpen}                  // controlled open state
  filterActive={hasActiveFilters}          // shows dot on sliders icon when true
  onFilterToggle={() => setFilterOpen(o => !o)}

  // Controlled search open state (only needed if an external event must open search,
  // e.g. dock:focus-search). Omit to let ViewHeader manage searchOpen internally.
  searchOpen={searchOpen}
  onSearchOpenChange={(open) => {
    if (!open) setSearchValue("");
    setSearchOpen(open);
  }}

  // Desktop-only CTA button
  actions={<Button className="hidden md:flex">...</Button>}

  loading={loading}                        // disables search + filter buttons
/>
```

---

## Step-by-step migration

### 1. Replace the import

```diff
- import { PageHeader } from "@/components/page-header";
+ import { ViewHeader } from "@/components/view-header";
```

### 2. Add state (if not already present)

```ts
const [searchValue, setSearchValue] = useState("");
const [filterOpen, setFilterOpen] = useState(false);   // only if the view has filters
```

### 3. Replace `<PageHeader>` with `<ViewHeader>`

**Title-only views** (Dashboard, Settings, Expenses with no search):

```diff
- <PageHeader title="Settings" />
+ <ViewHeader title="Settings" searchValue="" onSearchChange={() => {}} />
```

**Views with search** (Clients):

```diff
- <PageHeader title="Clients">
-   <Button className="hidden md:flex">+ New client</Button>
- </PageHeader>
+ <ViewHeader
+   title="Clients"
+   searchValue={searchValue}
+   onSearchChange={setSearchValue}
+   actions={<Button className="hidden md:flex">+ New client</Button>}
+ />
```

**Views with search + filters** (already done for Entries and Invoices — use as reference):
- Pass `filterOpen`, `filterActive`, `onFilterToggle`
- Render the mobile filter bar as a collapsible grid row between `<ViewHeader />` and the scroll container (see `entries-view.tsx`)
- Render the desktop filter row inside the content area (see `entries-view.tsx`)

### 4. Remove now-redundant code

- Remove the `searchOpen` / `searchInputRef` / `mobileTitle` pattern if it existed
- Remove the `closeSearch` / `openSearch` functions (handled by `ViewHeader`)
- Remove the `dock:focus-search` `useEffect` focus call — `ViewHeader` auto-focuses on open. Keep the effect only if it needs to set external `searchOpen` state.
- Remove `SlidersHorizontal`, `X`, `Search` icon imports if no longer used directly

### 5. Move desktop search into the content area

`ViewHeader` does **not** render a desktop search input. Each view is responsible for its own desktop filter row inside the scroll container:

```tsx
<div className="hidden md:flex items-center gap-3">
  <div className="relative flex-1 min-w-48">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
    <Input
      placeholder="Search clients..."
      className="pl-8"
      value={searchValue}
      onChange={(e) => setSearchValue(e.target.value)}
      disabled={loading}
    />
  </div>
  {/* additional filter dropdowns */}
</div>
```

---

## Mobile filter bar pattern

Copy this block between `<ViewHeader />` and the scroll container for any view with mobile filters:

```tsx
<div className={`md:hidden grid transition-[grid-template-rows] duration-200 ease-out ${filterOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
  <div className="overflow-hidden">
    <div className="border-b px-4 py-2 flex gap-2">
      {/* filter controls e.g. <Select> */}
    </div>
  </div>
</div>
```

---

## dock:focus-search

If the view needs to respond to the `dock:focus-search` event (invoices does, entries does not), use controlled search state:

```ts
const [searchOpen, setSearchOpen] = useState(false);

useEffect(() => {
  const handler = () => {
    if (!searchOpen) setSearchOpen(true);
  };
  window.addEventListener("dock:focus-search", handler);
  return () => window.removeEventListener("dock:focus-search", handler);
}, [searchOpen]);
```

Then pass to `ViewHeader`:

```tsx
<ViewHeader
  searchOpen={searchOpen}
  onSearchOpenChange={(open) => {
    if (!open) setSearchValue("");
    setSearchOpen(open);
  }}
  ...
/>
```
