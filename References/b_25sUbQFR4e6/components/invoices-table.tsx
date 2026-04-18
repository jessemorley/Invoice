"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"

const invoices = [
  {
    id: "INV-001",
    customer: "Acme Corp",
    email: "billing@acme.com",
    amount: 1250.00,
    status: "paid",
    date: "2024-03-15",
  },
  {
    id: "INV-002",
    customer: "Globex Inc",
    email: "accounts@globex.com",
    amount: 3420.00,
    status: "pending",
    date: "2024-03-14",
  },
  {
    id: "INV-003",
    customer: "Initech LLC",
    email: "finance@initech.com",
    amount: 890.50,
    status: "paid",
    date: "2024-03-12",
  },
  {
    id: "INV-004",
    customer: "Umbrella Co",
    email: "billing@umbrella.com",
    amount: 4500.00,
    status: "overdue",
    date: "2024-02-28",
  },
  {
    id: "INV-005",
    customer: "Stark Industries",
    email: "ap@stark.com",
    amount: 7800.00,
    status: "paid",
    date: "2024-03-10",
  },
  {
    id: "INV-006",
    customer: "Wayne Enterprises",
    email: "invoices@wayne.com",
    amount: 2100.00,
    status: "pending",
    date: "2024-03-13",
  },
]

function getStatusVariant(status: string) {
  switch (status) {
    case "paid":
      return "default"
    case "pending":
      return "secondary"
    case "overdue":
      return "destructive"
    default:
      return "outline"
  }
}

export function InvoicesTable() {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            className="pl-8"
          />
        </div>
        <Select defaultValue="all-time">
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-time">All time</SelectItem>
            <SelectItem value="this-week">This week</SelectItem>
            <SelectItem value="this-month">This month</SelectItem>
            <SelectItem value="last-month">Last month</SelectItem>
            <SelectItem value="this-year">This year</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all-clients">
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-clients">All clients</SelectItem>
            <SelectItem value="acme">Acme Corp</SelectItem>
            <SelectItem value="globex">Globex Inc</SelectItem>
            <SelectItem value="initech">Initech LLC</SelectItem>
            <SelectItem value="umbrella">Umbrella Co</SelectItem>
            <SelectItem value="stark">Stark Industries</SelectItem>
            <SelectItem value="wayne">Wayne Enterprises</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all-status">
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">All status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-4 px-6">Invoice</TableHead>
              <TableHead className="py-4 px-6">Customer</TableHead>
              <TableHead className="hidden md:table-cell py-4 px-6">Email</TableHead>
              <TableHead className="py-4 px-6">Status</TableHead>
              <TableHead className="text-right py-4 px-6">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium py-4 px-6">{invoice.id}</TableCell>
                <TableCell className="py-4 px-6">{invoice.customer}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground py-4 px-6">
                  {invoice.email}
                </TableCell>
                <TableCell className="py-4 px-6">
                  <Badge variant={getStatusVariant(invoice.status)}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium py-4 px-6">
                  ${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
      </Table>
    </div>
  )
}
