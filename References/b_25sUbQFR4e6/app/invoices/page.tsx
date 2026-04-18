import { InvoicesTable } from "@/components/invoices-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function InvoicesPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Invoices">
        <Button size="sm" className="hidden md:flex">
          <Plus className="size-4 mr-2" />
          New invoice
        </Button>
      </PageHeader>
      <main className="flex-1 p-4">
        <InvoicesTable />
      </main>
    </div>
  )
}
