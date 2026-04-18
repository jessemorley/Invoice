import { PageHeader } from "@/components/page-header"

export default function Page() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <main className="flex-1 p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="font-semibold">Total Revenue</h3>
            <p className="text-2xl font-bold">$45,231.89</p>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </div>
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="font-semibold">Subscriptions</h3>
            <p className="text-2xl font-bold">+2350</p>
            <p className="text-xs text-muted-foreground">+180.1% from last month</p>
          </div>
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="font-semibold">Sales</h3>
            <p className="text-2xl font-bold">+12,234</p>
            <p className="text-xs text-muted-foreground">+19% from last month</p>
          </div>
        </div>
      </main>
    </>
  )
}
