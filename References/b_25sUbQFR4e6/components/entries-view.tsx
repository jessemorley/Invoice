"use client"

import { useState } from "react"
import { ENTRIES, type MockEntry } from "@/lib/mock-data"
import { formatAUD, formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Plus } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"

type ViewMode = "invoice" | "week" | "none"

type ClientWeekGroup = {
  key: string
  clientName: string
  clientColor: string
  isoWeek: string
  entries: MockEntry[]
  subtotal: number
  invoiced: boolean
  invoiceNumber?: string
}

type WeekGroup = {
  key: string
  isoWeek: string
  entries: MockEntry[]
  subtotal: number
}

function groupByClientWeek(entries: MockEntry[]): ClientWeekGroup[] {
  const map = new Map<string, MockEntry[]>()
  for (const entry of entries) {
    const key = `${entry.client.id}-${entry.iso_week}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }

  const groups: ClientWeekGroup[] = []
  for (const [key, groupEntries] of map) {
    const first = groupEntries[0]
    const invoiced = groupEntries.every((e) => !!e.invoice_id)
    groups.push({
      key,
      clientName: first.client.name,
      clientColor: first.client.color,
      isoWeek: first.iso_week,
      entries: groupEntries.sort((a, b) => b.date.localeCompare(a.date)),
      subtotal: groupEntries.reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0),
      invoiced,
      invoiceNumber: invoiced ? "INV-042" : undefined,
    })
  }

  return groups.sort((a, b) => b.entries[0].date.localeCompare(a.entries[0].date))
}

function groupByWeek(entries: MockEntry[]): WeekGroup[] {
  const map = new Map<string, MockEntry[]>()
  for (const entry of entries) {
    const key = entry.iso_week
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }

  const groups: WeekGroup[] = []
  for (const [key, groupEntries] of map) {
    groups.push({
      key,
      isoWeek: key,
      entries: groupEntries.sort((a, b) => b.date.localeCompare(a.date)),
      subtotal: groupEntries.reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0),
    })
  }

  return groups.sort((a, b) => b.isoWeek.localeCompare(a.isoWeek))
}

function EntryRow({ entry, showClient = false }: { entry: MockEntry; showClient?: boolean }) {
  return (
    <div className="flex items-center px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
      {showClient && (
        <div className="flex items-center gap-2 w-32 shrink-0">
          <div
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.client.color }}
          />
          <span className="text-sm font-medium truncate">
            {entry.client.name}
          </span>
        </div>
      )}
      <span className="text-sm text-muted-foreground tabular-nums w-24 shrink-0">
        {formatDate(entry.date)}
      </span>
      <span className="text-sm truncate flex-1 min-w-0">
        {entry.description}
      </span>
      <span className="text-sm text-muted-foreground w-20 text-right shrink-0">
        {entry.billing_type === "day_rate" && (entry.day_type === "full" ? "Full day" : "Half day")}
        {entry.billing_type === "hourly" && entry.hours && `${entry.hours}h`}
      </span>
      <span className="text-sm tabular-nums w-24 text-right shrink-0">
        {formatAUD(entry.base_amount + entry.bonus_amount)}
      </span>
    </div>
  )
}

function ClientWeekGroupHeader({ group }: { group: ClientWeekGroup }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
      <div className="flex items-center gap-2">
        <div
          className="size-2 rounded-full"
          style={{ backgroundColor: group.clientColor }}
        />
        <span className="text-sm font-medium">
          {group.clientName}
        </span>
        <span className="text-xs text-muted-foreground">
          {group.isoWeek}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatAUD(group.subtotal)}
        </span>
        {group.invoiced ? (
          <Button variant="secondary" size="sm" className="h-7">
            {group.invoiceNumber}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7">
            <Plus className="size-4" />
            Invoice
          </Button>
        )}
      </div>
    </div>
  )
}

function WeekGroupHeader({ group }: { group: WeekGroup }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
      <span className="text-sm font-medium">
        {group.isoWeek}
      </span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatAUD(group.subtotal)}
      </span>
    </div>
  )
}

function InvoiceView() {
  const groups = groupByClientWeek(ENTRIES)
  
  return (
    <div className="p-4 flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden p-0 gap-0">
          <ClientWeekGroupHeader group={group} />
          <Separator />
          <CardContent className="p-0">
            {group.entries.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <Separator />}
                <EntryRow entry={entry} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="text-center py-2">
        <Button variant="ghost" size="sm">
          Load earlier
        </Button>
      </div>
    </div>
  )
}

function WeekView() {
  const groups = groupByWeek(ENTRIES)
  
  return (
    <div className="p-4 flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden p-0 gap-0">
          <WeekGroupHeader group={group} />
          <Separator />
          <CardContent className="p-0">
            {group.entries.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <Separator />}
                <EntryRow entry={entry} showClient />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="text-center py-2">
        <Button variant="ghost" size="sm">
          Load earlier
        </Button>
      </div>
    </div>
  )
}

function ListView() {
  const entries = [...ENTRIES].sort((a, b) => b.date.localeCompare(a.date))
  
  return (
    <div className="p-4">
      <Card className="overflow-hidden p-0 gap-0">
        <CardContent className="p-0">
          {entries.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <Separator />}
              <EntryRow entry={entry} showClient />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="text-center py-4">
        <Button variant="ghost" size="sm">
          Load earlier
        </Button>
      </div>
    </div>
  )
}

export function EntriesView() {
  const [viewMode, setViewMode] = useState<ViewMode>("invoice")

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">Entries</h1>
        <div className="flex-1" />
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="invoice">Invoice</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="none">None</ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" className="hidden md:flex">
          <Plus className="size-4 mr-2" />
          New entry
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {viewMode === "invoice" && <InvoiceView />}
        {viewMode === "week" && <WeekView />}
        {viewMode === "none" && <ListView />}
      </div>

      <div className="md:hidden fixed bottom-6 right-4">
        <Button size="icon" className="size-14 rounded-full shadow-lg">
          <Plus />
        </Button>
      </div>
    </div>
  )
}
