import { ENTRIES, type MockEntry } from "@/lib/mock-data";
import { formatAUD, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";

type ClientWeekGroup = {
  key: string;
  clientName: string;
  clientColor: string;
  isoWeek: string;
  entries: MockEntry[];
  subtotal: number;
  invoiced: boolean;
  invoiceNumber?: string;
};

function groupEntries(entries: MockEntry[]): ClientWeekGroup[] {
  const map = new Map<string, MockEntry[]>();
  for (const entry of entries) {
    const key = `${entry.client.id}-${entry.iso_week}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }

  const groups: ClientWeekGroup[] = [];
  for (const [key, groupEntries] of map) {
    const first = groupEntries[0];
    const invoiced = groupEntries.every((e) => !!e.invoice_id);
    groups.push({
      key,
      clientName: first.client.name,
      clientColor: first.client.color,
      isoWeek: first.iso_week,
      entries: groupEntries.sort((a, b) => b.date.localeCompare(a.date)),
      subtotal: groupEntries.reduce((sum, e) => sum + e.base_amount + e.bonus_amount, 0),
      invoiced,
      invoiceNumber: invoiced ? "INV-042" : undefined,
    });
  }

  return groups.sort((a, b) => b.entries[0].date.localeCompare(a.entries[0].date));
}

function EntryRow({ entry }: { entry: MockEntry }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono tabular-nums w-20 shrink-0">
            {formatDate(entry.date)}
          </span>
          <span className="text-sm text-foreground truncate">
            {entry.description}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {entry.billing_type === "day_rate" && (
          <span className="text-xs text-muted-foreground">
            {entry.day_type === "full" ? "Full day" : "Half day"}
          </span>
        )}
        {entry.billing_type === "hourly" && entry.hours && (
          <span className="text-xs text-muted-foreground font-mono">
            {entry.hours}h
          </span>
        )}
        <span className="text-sm font-mono tabular-nums text-foreground w-24 text-right">
          {formatAUD(entry.base_amount + entry.bonus_amount)}
        </span>
      </div>
    </div>
  );
}

function GroupHeader({ group }: { group: ClientWeekGroup }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-t-lg first:rounded-t-lg">
      <div className="flex items-center gap-2.5">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: group.clientColor }}
        />
        <span className="text-sm font-medium text-foreground">
          {group.clientName}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {group.isoWeek}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono tabular-nums text-muted-foreground">
          {formatAUD(group.subtotal)}
        </span>
        {group.invoiced ? (
          <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 text-xs font-mono">
            {group.invoiceNumber}
          </Badge>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            Invoice
          </Button>
        )}
      </div>
    </div>
  );
}

export default function EntriesPage() {
  const groups = groupEntries(ENTRIES);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Entries</h1>
        <Button size="sm" className="hidden md:flex gap-1.5">
          <Plus className="h-4 w-4" />
          New entry
        </Button>
      </div>

      {/* Entry groups */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
          {/* Load earlier */}
          <div className="text-center">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Load earlier
            </Button>
          </div>

          {groups.map((group) => (
            <Card key={group.key} className="overflow-hidden py-0">
              <GroupHeader group={group} />
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
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-18 right-4 z-40">
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
