import { Suspense } from "react";
import { connection } from "next/server";
import {
  fetchEntries,
  fetchInvoices,
  fetchExpenses,
  fetchFullClients,
  fetchWorkflowRates,
  fetchUninvoicedCount,
  fetchDashboardData,
  fetchBusinessDetails,
  fetchInvoiceSequence,
} from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { SpaShell } from "@/components/spa-shell";

async function SpaData() {
  await connection();
  const [
    entries,
    invoices,
    expenses,
    clients,
    workflowRates,
    uninvoicedCount,
    businessDetails,
    invoiceSequence,
  ] = await Promise.all([
    fetchEntries(PROTOTYPE_USER_ID),
    fetchInvoices(PROTOTYPE_USER_ID, { from: "all" }),
    fetchExpenses(PROTOTYPE_USER_ID),
    fetchFullClients(PROTOTYPE_USER_ID),
    fetchWorkflowRates(),
    fetchUninvoicedCount(PROTOTYPE_USER_ID),
    fetchBusinessDetails(PROTOTYPE_USER_ID),
    fetchInvoiceSequence(PROTOTYPE_USER_ID),
  ]);

  const dashboardData = await fetchDashboardData(PROTOTYPE_USER_ID, entries, invoices);

  return (
    <SpaShell
      entries={entries}
      invoices={invoices}
      expenses={expenses}
      clients={clients}
      workflowRates={workflowRates}
      uninvoicedCount={uninvoicedCount}
      dashboardData={dashboardData}
      businessDetails={businessDetails}
      invoiceSequence={invoiceSequence}
    />
  );
}

export default function SpaPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SpaData />
    </Suspense>
  );
}
