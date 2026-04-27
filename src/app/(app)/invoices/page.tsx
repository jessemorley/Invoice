import { Suspense } from "react";
import { fetchInvoices, fetchUninvoicedCount, fetchClients } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { InvoicesClient } from "./invoices-client";

async function InvoicesData() {
  const [invoices, uninvoicedCount, clients] = await Promise.all([
    fetchInvoices(PROTOTYPE_USER_ID),
    fetchUninvoicedCount(PROTOTYPE_USER_ID),
    fetchClients(PROTOTYPE_USER_ID),
  ]);

  return (
    <InvoicesClient
      invoices={invoices}
      uninvoicedCount={uninvoicedCount}
      clients={clients}
    />
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<InvoicesClient loading />}>
      <InvoicesData />
    </Suspense>
  );
}
