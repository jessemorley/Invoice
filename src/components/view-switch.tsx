"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { readCache, writeCache } from "@/lib/view-cache";
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
} from "@/lib/view-loaders";

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
  entries:  ["entries", "dashboard", "invoices", "tax"],
  invoices: ["invoices", "dashboard", "tax", "emails"],
  clients:  ["clients", "entries", "invoices"],
  expenses: ["expenses", "dashboard", "tax"],
  settings: ["settings"],
  emails:   ["emails"],
  payg:     ["tax"],
};

const CACHED_VIEWS = ["dashboard", "entries", "invoices", "clients", "expenses", "settings", "tax", "emails"] as const satisfies readonly ViewId[];

type InitialEntriesData = { entries: Entry[]; clients: Client[]; workflowRates: WorkflowRate[] };

export function ViewSwitch({
  userId,
  userEmail,
  userName,
  initialEntriesData,
}: {
  userId: string;
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

  // Resolves once the saved data has been checked against userId (and wiped
  // if it belonged to someone else). Writes wait on it so a wipe can't
  // clobber them.
  const cacheReady = useRef<Promise<unknown>>(Promise.resolve());

  // Show last-seen data straight away. `prev ??` keeps anything already
  // fetched (or the SSR preload): a saved copy never overwrites newer data.
  // Declared before the reveal effect so cacheReady is set before any fetch.
  useEffect(() => {
    cacheReady.current = readCache(userId, CACHED_VIEWS).then((cached) => {
      function fill<T>(set: Dispatch<SetStateAction<T | null>>, v: ViewId) {
        const value = cached[v as (typeof CACHED_VIEWS)[number]];
        if (value !== undefined) set((prev) => prev ?? (value as T));
      }
      fill(setDashboardData, "dashboard");
      fill(setEntriesData, "entries");
      fill(setInvoicesData, "invoices");
      fill(setClientsData, "clients");
      fill(setExpensesData, "expenses");
      fill(setSettingsData, "settings");
      fill(setTaxData, "tax");
      fill(setEmailsData, "emails");
    });
  }, [userId]);

  const fetchView = useCallback((v: ViewId) => {
    // ponytail: last write wins; two overlapping fetches of one view can land out of order (same as the state)
    const save = <T,>(data: T) => {
      cacheReady.current.then(() => writeCache(v, data));
      return data;
    };
    switch (v) {
      case "dashboard": loadDashboardViewData().then(save).then(setDashboardData); break;
      case "entries":   loadEntriesViewData().then(save).then(setEntriesData); break;
      case "invoices":  loadInvoicesViewData().then(save).then((data) => {
        setInvoicesData(data);
        window.dispatchEvent(new CustomEvent("dock:uninvoiced-count", { detail: data.uninvoicedCount }));
      }); break;
      case "clients":   loadClientsViewData().then(save).then(setClientsData); break;
      case "expenses":  loadExpensesViewData().then(save).then(setExpensesData); break;
      case "settings":  loadSettingsViewData().then(save).then(setSettingsData); break;
      case "tax":       loadTaxViewData().then(save).then(setTaxData); break;
      case "emails":    loadEmailsViewData().then(save).then(setEmailsData); break;
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

  // Re-fetch the active view when the user returns to the tab or the
  // connection comes back
  useEffect(() => {
    function handler() {
      if (document.visibilityState === "visible") fetchView(view);
    }
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("online", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("online", handler);
    };
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
