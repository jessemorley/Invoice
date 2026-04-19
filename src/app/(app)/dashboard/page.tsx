export const dynamic = "force-dynamic";

import { fetchEntries, fetchInvoices, fetchExpenses, fetchDashboardData } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const [entries, invoices, expenses] = await Promise.all([
    fetchEntries(PROTOTYPE_USER_ID),
    fetchInvoices(PROTOTYPE_USER_ID, { from: "all" }),
    fetchExpenses(PROTOTYPE_USER_ID),
  ]);
  const data = await fetchDashboardData(PROTOTYPE_USER_ID, entries, invoices);
  return <DashboardClient data={data} expenses={expenses} />;
}
