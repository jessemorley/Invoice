"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InvalidationTag } from "@/lib/invalidate";
import { useActiveView, type ViewId } from "@/components/active-view-context";
import type { DashboardData, DashboardEmail, Entry, Expense, Client, WorkflowRate, Invoice } from "@/lib/types";
import type { BusinessDetails, InvoiceSequence, UserPreferences, TaxFyTotals, SuggestedInvoice } from "@/lib/queries";
import dynamic from "next/dynamic";
import { EntriesView } from "@/components/entries-view";

const DashboardClient = dynamic(() =>
  import("@/app/(app)/dashboard/dashboard-client").then((m) => m.DashboardClient),
  { ssr: false }
);
const InvoicesClient = dynamic(() =>
  import("@/app/(app)/invoices/invoices-client").then((m) => m.InvoicesClient),
  { ssr: false }
);
const ClientsView = dynamic(() =>
  import("@/app/(app)/clients/clients-view").then((m) => m.ClientsView),
  { ssr: false }
);
const ExpensesClient = dynamic(() =>
  import("@/app/(app)/expenses/expenses-client").then((m) => m.ExpensesClient),
  { ssr: false }
);
const SettingsClient = dynamic(() =>
  import("@/app/(app)/settings/settings-client").then((m) => m.SettingsClient),
  { ssr: false }
);
const TaxClient = dynamic(() =>
  import("@/app/(app)/tax/tax-client").then((m) => m.TaxClient),
  { ssr: false }
);
const EmailsClient = dynamic(() =>
  import("@/app/(app)/emails/emails-client").then((m) => m.EmailsClient),
  { ssr: false }
);
import {
  loadDashboardViewData,
  loadEntriesViewData,
  loadInvoicesViewData,
  loadClientsViewData,
  loadExpensesViewData,
  loadSettingsViewData,
  loadTaxViewData,
  loadEmailsViewData,
} from "@/app/(app)/actions";

type DashboardState = { data: DashboardData } | null;
type EntriesState = { entries: Entry[]; clients: Client[]; workflowRates: WorkflowRate[] } | null;
type InvoicesState = { invoices: Invoice[]; uninvoicedCount: number; hasUninvoiced: boolean; clients: Client[]; suggested: SuggestedInvoice[] } | null;
type ClientsState = Client[] | null;
type ExpensesState = Expense[] | null;
type SettingsState = { businessDetails: BusinessDetails | null; invoiceSequence: InvoiceSequence | null; userPreferences: UserPreferences | null } | null;
type TaxState = TaxFyTotals[] | null;
type EmailsState = DashboardEmail[] | null;

// Which views need to re-fetch when a given tag is invalidated
const TAG_TO_VIEWS: Record<InvalidationTag, ViewId[]> = {
  entries:  ["entries", "dashboard", "invoices"],
  invoices: ["invoices", "dashboard", "tax", "emails"],
  clients:  ["clients", "entries", "invoices"],
  expenses: ["expenses", "dashboard", "tax"],
  settings: ["settings"],
  emails:   ["emails"],
  payg:     ["tax"],
};

type InitialEntriesData = { entries: Entry[]; clients: Client[]; workflowRates: WorkflowRate[] };

export function ViewSwitch({
  userEmail,
  userName,
  initialEntriesData,
}: {
  userEmail: string;
  userName: string;
  initialEntriesData?: InitialEntriesData;
}) {
  const { view, settingsTab } = useActiveView();

  const [dashboardData, setDashboardData] = useState<DashboardState>(null);
  const [entriesData, setEntriesData] = useState<EntriesState>(initialEntriesData ?? null);
  const [invoicesData, setInvoicesData] = useState<InvoicesState>(null);
  const [clientsData, setClientsData] = useState<ClientsState>(null);
  const [expensesData, setExpensesData] = useState<ExpensesState>(null);
  const [settingsData, setSettingsData] = useState<SettingsState>(null);
  const [taxData, setTaxData] = useState<TaxState>(null);
  const [emailsData, setEmailsData] = useState<EmailsState>(null);

  // Pre-mark entries as revealed if server-loaded data was provided
  const revealed = useRef<Set<ViewId>>(
    initialEntriesData ? new Set<ViewId>(["entries"]) : new Set<ViewId>()
  );

  const fetchView = useCallback((v: ViewId) => {
    switch (v) {
      case "dashboard": loadDashboardViewData().then(setDashboardData); break;
      case "entries":   loadEntriesViewData().then(setEntriesData); break;
      case "invoices":  loadInvoicesViewData().then((data) => {
        setInvoicesData(data);
        window.dispatchEvent(new CustomEvent("dock:uninvoiced-count", { detail: data.uninvoicedCount }));
      }); break;
      case "clients":   loadClientsViewData().then(setClientsData); break;
      case "expenses":  loadExpensesViewData().then(setExpensesData); break;
      case "settings":  loadSettingsViewData().then(setSettingsData); break;
      case "tax":       loadTaxViewData().then(setTaxData); break;
      case "emails":    loadEmailsViewData().then(setEmailsData); break;
    }
  }, []);

  // Signal to the splash that the app shell has hydrated. Deferred via
  // rAF so the splash's listener (attached by a parent effect that runs
  // after this child effect) is in place before the event fires.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("app:ready"));
    });
    return () => cancelAnimationFrame(id);
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
          hasUninvoiced={invoicesData?.hasUninvoiced}
          clients={invoicesData?.clients}
          suggested={invoicesData?.suggested}
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
            userPreferences={settingsData.userPreferences}
            userEmail={userEmail}
            userName={userName}
            initialTab={settingsTab}
          />
        ) : (
          <SettingsClient loading userEmail={userEmail} userName={userName} initialTab={settingsTab} />
        )}
      </div>
      <div className={view === "tax" ? "contents" : "hidden"}>
        <TaxClient fyTotals={taxData ?? undefined} />
      </div>
      <div className={view === "emails" ? "contents" : "hidden"}>
        <EmailsClient emails={emailsData ?? undefined} />
      </div>
    </>
  );
}
