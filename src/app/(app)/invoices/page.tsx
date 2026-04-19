import { Suspense } from "react";
import { fetchInvoices, fetchUninvoicedCount, fetchClients, type InvoiceFilters } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { InvoicesClient } from "./invoices-client";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function InvoicesData({ filters }: { filters: InvoiceFilters }) {
  const [invoices, uninvoicedCount, clients] = await Promise.all([
    fetchInvoices(PROTOTYPE_USER_ID, filters),
    fetchUninvoicedCount(PROTOTYPE_USER_ID),
    fetchClients(PROTOTYPE_USER_ID),
  ]);

  return (
    <InvoicesClient
      invoices={invoices}
      uninvoicedCount={uninvoicedCount}
      clients={clients}
      filters={filters}
    />
  );
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const filters: InvoiceFilters = {
    search: typeof sp.search === "string" ? sp.search : undefined,
    status: typeof sp.status === "string" ? (sp.status as InvoiceFilters["status"]) : undefined,
    clientId: typeof sp.client === "string" ? sp.client : undefined,
    from: typeof sp.from === "string" ? sp.from : undefined,
    to: typeof sp.to === "string" ? sp.to : undefined,
    sortKey: typeof sp.sort === "string" ? (sp.sort as InvoiceFilters["sortKey"]) : "issued_date",
    sortDir: sp.dir === "asc" ? "asc" : "desc",
  };

  return (
    <Suspense fallback={<InvoicesClient filters={filters} loading />}>
      <InvoicesData filters={filters} />
    </Suspense>
  );
}
