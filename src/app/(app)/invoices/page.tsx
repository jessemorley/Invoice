import { INVOICES, ENTRIES } from "@/lib/mock-data";
import { formatAUD, formatDateShort } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

function uninvoicedGroupCount(): number {
  const uninvoiced = ENTRIES.filter((e) => !e.invoice_id);
  const groups = new Set(uninvoiced.map((e) => `${e.client.id}-${e.iso_week}`));
  return groups.size;
}

function InvoiceCard({ invoice }: { invoice: (typeof INVOICES)[number] }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer">
      <div
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: invoice.client.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium text-foreground">
            {invoice.number}
          </span>
          <span className="text-sm text-muted-foreground truncate">
            {invoice.client.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono">
            {invoice.date_range}
          </span>
          <span className="text-xs text-muted-foreground">
            {invoice.entry_count} entries
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-mono tabular-nums text-foreground">
          {formatAUD(invoice.total)}
        </span>
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium ${STATUS_STYLES[invoice.status]}`}>
          {invoice.status}
        </Badge>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const uninvoicedCount = uninvoicedGroupCount();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">Invoices</h1>
          {uninvoicedCount > 0 && (
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-medium cursor-pointer hover:bg-amber-500/25">
              {uninvoicedCount} groups ready to invoice
            </Badge>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-28">Dates</TableHead>
                    <TableHead className="w-28">Issued</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {INVOICES.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer">
                      <TableCell className="font-mono font-medium text-sm">
                        {inv.number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: inv.client.color }}
                          />
                          <span className="text-sm">{inv.client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {inv.date_range}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {formatDateShort(inv.issued_date)}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-right tabular-nums">
                        {formatAUD(inv.total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium ${STATUS_STYLES[inv.status]}`}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {INVOICES.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileText className="h-10 w-10 mb-2" />
            <p className="text-sm">No invoices yet</p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {INVOICES.map((inv) => (
              <Card key={inv.id} className="py-0">
                <CardContent className="p-0">
                  <InvoiceCard invoice={inv} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
