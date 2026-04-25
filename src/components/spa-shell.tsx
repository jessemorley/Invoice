"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FloatingDock, type DockView } from "@/components/floating-dock";
import type { Entry, Invoice, Expense, Client, WorkflowRate, DashboardData } from "@/lib/types";
import type { BusinessDetails, InvoiceSequence } from "@/lib/queries";

// Lazy-load each view — their JS only downloads on first visit
const EntriesView = dynamic(() => import("@/components/entries-view").then((m) => ({ default: m.EntriesView })));
const InvoicesClient = dynamic(() => import("@/app/(app)/invoices/invoices-client").then((m) => ({ default: m.InvoicesClient })));
const ClientsView = dynamic(() => import("@/app/(app)/clients/clients-view").then((m) => ({ default: m.ClientsView })));
const ExpensesClient = dynamic(() => import("@/app/(app)/expenses/expenses-client").then((m) => ({ default: m.ExpensesClient })));
const DashboardClient = dynamic(() => import("@/app/(app)/dashboard/dashboard-client").then((m) => ({ default: m.DashboardClient })));
const SettingsClient = dynamic(() => import("@/app/(app)/settings/settings-client").then((m) => ({ default: m.SettingsClient })));

type Props = {
  entries: Entry[];
  invoices: Invoice[];
  expenses: Expense[];
  clients: Client[];
  workflowRates: WorkflowRate[];
  uninvoicedCount: number;
  dashboardData: DashboardData;
  businessDetails: BusinessDetails | null;
  invoiceSequence: InvoiceSequence | null;
};

export function SpaShell({
  entries,
  invoices,
  expenses,
  clients,
  workflowRates,
  uninvoicedCount,
  dashboardData,
  businessDetails,
  invoiceSequence,
}: Props) {
  const [activeView, setActiveView] = useState<DockView>("entries");
  // Track which views have ever been visited so they stay mounted once rendered
  const [visited, setVisited] = useState<Set<DockView>>(new Set(["entries"]));

  const clientRefs = clients.map((c) => ({ id: c.id, name: c.name }));

  function handleViewChange(view: DockView) {
    setVisited((prev) => new Set([...prev, view]));
    setActiveView(view);
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      {visited.has("dashboard") && (
        <div className={activeView === "dashboard" ? "block" : "hidden"}>
          <DashboardClient data={dashboardData} expenses={expenses} />
        </div>
      )}
      {visited.has("entries") && (
        <div className={activeView === "entries" ? "block" : "hidden"}>
          <EntriesView entries={entries} clients={clients} workflowRates={workflowRates} />
        </div>
      )}
      {visited.has("invoices") && (
        <div className={activeView === "invoices" ? "block" : "hidden"}>
          <InvoicesClient
            invoices={invoices}
            uninvoicedCount={uninvoicedCount}
            clients={clientRefs}
            filters={{ sortKey: "issued_date", sortDir: "desc" }}
          />
        </div>
      )}
      {visited.has("clients") && (
        <div className={activeView === "clients" ? "block" : "hidden"}>
          <ClientsView clients={clients} />
        </div>
      )}
      {visited.has("expenses") && (
        <div className={activeView === "expenses" ? "block" : "hidden"}>
          <ExpensesClient expenses={expenses} />
        </div>
      )}
      {visited.has("settings") && (
        <div className={activeView === "settings" ? "block" : "hidden"}>
          <SettingsClient
            businessDetails={businessDetails}
            invoiceSequence={invoiceSequence}
          />
        </div>
      )}
      <FloatingDock activeView={activeView} onViewChange={handleViewChange} />
    </div>
  );
}
