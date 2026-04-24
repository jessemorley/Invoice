import { Suspense } from "react";
import { connection } from "next/server";
import { fetchEntries, fetchInvoices, fetchExpenses, fetchDashboardData } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { DashboardClient } from "./dashboard-client";

async function DashboardData() {
  await connection();
  const [entries, invoices, expenses] = await Promise.all([
    fetchEntries(PROTOTYPE_USER_ID),
    fetchInvoices(PROTOTYPE_USER_ID, { from: "all" }),
    fetchExpenses(PROTOTYPE_USER_ID),
  ]);
  const data = await fetchDashboardData(PROTOTYPE_USER_ID, entries, invoices);
  return <DashboardClient data={data} expenses={expenses} />;
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardData />
    </Suspense>
  );
}
