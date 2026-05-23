# Table Header Style

## Goal

Make table view headers (invoices, clients, expenses, entries) visually match the search bar and filter controls — same height, same border, same background — while stripping the card wrapper from the table body and leaving only horizontal row separators.

## Header row

The `<thead>` row is styled as a standalone rounded pill, separate from the table body. Implemented via `border-separate border-spacing-0` on the `<Table>` (required for `border-radius` to apply to `<th>` cells).

Each `<th>` cell carries:

```
h-9                          # 36px — matches Input/Select height
px-6                         # horizontal padding
bg-transparent               # light mode: no fill (matches Input)
dark:bg-input/30             # dark mode: matches Input's subtle tint
border-y border-input        # top + bottom border using --input color
text-xs                      # smaller than body text
text-muted-foreground        # default grey (same as non-sortable columns)
hover:text-foreground        # per-column hover brightens label only
```

First cell adds: `border-l rounded-l-xl`
Last cell adds: `border-r rounded-r-xl`

The `<TableRow>` inside `<TableHeader>` gets `hover:bg-transparent` to suppress the default row hover background.

## Table body

The outer `rounded-lg border bg-card` wrapper is removed. The `<TableBody>` uses:

```
[&_td]:border-b              # border-b on every cell (border-separate needs cell-level borders)
[&_tr:last-child_td]:border-0  # suppress last row's border
```

Body rows sit directly on `bg-background` with no card surface.

## Applying to other views

When rolling out to clients, expenses, and entries:

1. Add `border-separate border-spacing-0` to `<Table>`
2. Remove the `rounded-lg border bg-card overflow-hidden` wrapper div
3. Style thead cells as above (copy the class pattern from invoices)
4. Add `[&_td]:border-b [&_tr:last-child_td]:border-0` to `<TableBody>`
5. Reduce thead cell padding from `py-4` to `h-9` (the base `TableHead` sets `h-10` — override with `h-9`)
