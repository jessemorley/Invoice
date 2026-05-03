"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { InvalidationTag } from "@/lib/invalidate";
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

type DashboardState = { data: DashboardData } | null;
type EntriesState = { entries: Entry[]; clients: Client[]; workflowRates: WorkflowRate[] } | null;
type InvoicesState = { invoices: Invoice[]; uninvoicedCount: number; clients: { id: string; name: string }[] } | null;
type ClientsState = Client[] | null;
type ExpensesState = Expense[] | null;
type SettingsState = { businessDetails: BusinessDetails | null; invoiceSequence: InvoiceSequence | null } | null;

// Which views need to re-fetch when a given tag is invalidated
const TAG_TO_VIEWS: Record<InvalidationTag, ViewId[]> = {
  entries:  ["entries", "dashboard", "invoices"],
  invoices: ["invoices", "dashboard"],
  clients:  ["clients", "entries", "invoices"],
  expenses: ["expenses", "dashboard"],
  settings: ["settings"],
  emails:   ["dashboard"],
};

export function ViewSwitch() {
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") ?? "entries") as ViewId;

  const [dashboardData, setDashboardData] = useState<DashboardState>(null);
  const [entriesData, setEntriesData] = useState<EntriesState>(null);
  const [invoicesData, setInvoicesData] = useState<InvoicesState>(null);
  const [clientsData, setClientsData] = useState<ClientsState>(null);
  const [expensesData, setExpensesData] = useState<ExpensesState>(null);
  const [settingsData, setSettingsData] = useState<SettingsState>(null);

  // Track which views have been revealed (fetched at least once)
  const revealed = useRef<Set<ViewId>>(new Set());

  const fetchView = useCallback((v: ViewId) => {
    switch (v) {
      case "dashboard": loadDashboardViewData().then(setDashboardData); break;
      case "entries":   loadEntriesViewData().then(setEntriesData); break;
      case "invoices":  loadInvoicesViewData().then(setInvoicesData); break;
      case "clients":   loadClientsViewData().then(setClientsData); break;
      case "expenses":  loadExpensesViewData().then(setExpensesData); break;
      case "settings":  loadSettingsViewData().then(setSettingsData); break;
    }
  }, []);

  // Fetch on first reveal of each view
  useEffect(() => {
    if (revealed.current.has(view)) return;
    revealed.current.add(view);
    fetchView(view);
  }, [view, fetchView]);

  // Re-fetch affected views when a mutation fires invalidate()
  useEffect(() => {
    function handler(e: Event) {
      const tag = (e as CustomEvent<InvalidationTag>).detail;
      const views = TAG_TO_VIEWS[tag] ?? [];
      for (const v of views) {
        // Only re-fetch views that have already been loaded
        if (revealed.current.has(v)) fetchView(v);
      }
    }
    window.addEventListener("data:invalidate", handler);
    return () => window.removeEventListener("data:invalidate", handler);
  }, [fetchView]);

  // Re-fetch the active view when the user returns to the tab
  useEffect(() => {
    function handler() {
      if (document.visibilityState === "visible") fetchView(view);
    }
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [view, fetchView]);

  return (
    <>
      <div className={view === "dashboard" ? "contents" : "hidden"}>
        <DashboardClient data={dashboardData?.data} />
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
