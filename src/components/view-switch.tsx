"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DashboardData, Entry, Expense, Client, WorkflowRate, Invoice } from "@/lib/types";
import type { BusinessDetails, InvoiceSequence } from "@/lib/queries";
import { DashboardClient } from "@/app/(app)/dashboard/dashboard-client";
import { EntriesView } from "@/components/entries-view";
import { InvoicesClient } from "@/app/(app)/invoices/invoices-client";
import { ClientsView } from "@/app/(app)/clients/clients-view";
import { ExpensesClient } from "@/app/(app)/expenses/expenses-client";
import { SettingsClient } from "@/app/(app)/settings/settings-client";
import {
  loadDashboardViewData,
  loadEntriesViewData,
  loadInvoicesViewData,
  loadClientsViewData,
  loadExpensesViewData,
  loadSettingsViewData,
} from "@/app/(app)/actions";

export type ViewId = "dashboard" | "entries" | "invoices" | "clients" | "expenses" | "settings";

type DashboardState = { data: DashboardData; expenses: Expense[] } | null;
type EntriesState = { entries: Entry[]; clients: Client[]; workflowRates: WorkflowRate[] } | null;
type InvoicesState = { invoices: Invoice[]; uninvoicedCount: number; clients: { id: string; name: string }[] } | null;
type ClientsState = Client[] | null;
type ExpensesState = Expense[] | null;
type SettingsState = { businessDetails: BusinessDetails | null; invoiceSequence: InvoiceSequence | null } | null;

export function ViewSwitch() {
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") ?? "entries") as ViewId;

  const [dashboardData, setDashboardData] = useState<DashboardState>(null);
  const [entriesData, setEntriesData] = useState<EntriesState>(null);
  const [invoicesData, setInvoicesData] = useState<InvoicesState>(null);
  const [clientsData, setClientsData] = useState<ClientsState>(null);
  const [expensesData, setExpensesData] = useState<ExpensesState>(null);
  const [settingsData, setSettingsData] = useState<SettingsState>(null);

  // Track which views have been revealed so we only fetch once per session
  const revealed = useRef<Set<ViewId>>(new Set());

  useEffect(() => {
    if (revealed.current.has(view)) return;
    revealed.current.add(view);

    switch (view) {
      case "dashboard":
        loadDashboardViewData().then(setDashboardData);
        break;
      case "entries":
        loadEntriesViewData().then(setEntriesData);
        break;
      case "invoices":
        loadInvoicesViewData().then(setInvoicesData);
        break;
      case "clients":
        loadClientsViewData().then(setClientsData);
        break;
      case "expenses":
        loadExpensesViewData().then(setExpensesData);
        break;
      case "settings":
        loadSettingsViewData().then(setSettingsData);
        break;
    }
  }, [view]);

  return (
    <>
      <div className={view === "dashboard" ? "contents" : "hidden"}>
        <DashboardClient data={dashboardData?.data} expenses={dashboardData?.expenses} />
      </div>
      <div className={view === "entries" ? "contents" : "hidden"}>
        <EntriesView
          entries={entriesData?.entries}
          clients={entriesData?.clients ?? []}
          workflowRates={entriesData?.workflowRates ?? []}
          loading={!entriesData}
        />
      </div>
      <div className={view === "invoices" ? "contents" : "hidden"}>
        <InvoicesClient
          invoices={invoicesData?.invoices}
          uninvoicedCount={invoicesData?.uninvoicedCount}
          clients={invoicesData?.clients}
          loading={!invoicesData}
        />
      </div>
      <div className={view === "clients" ? "contents" : "hidden"}>
        {clientsData ? (
          <ClientsView clients={clientsData} />
        ) : (
          <ClientsView clients={[]} loading />
        )}
      </div>
      <div className={view === "expenses" ? "contents" : "hidden"}>
        {expensesData ? (
          <ExpensesClient expenses={expensesData} />
        ) : (
          <ExpensesClient expenses={[]} loading />
        )}
      </div>
      <div className={view === "settings" ? "contents" : "hidden"}>
        {settingsData ? (
          <SettingsClient
            businessDetails={settingsData.businessDetails}
            invoiceSequence={settingsData.invoiceSequence}
          />
        ) : (
          <SettingsClient loading />
        )}
      </div>
    </>
  );
}
