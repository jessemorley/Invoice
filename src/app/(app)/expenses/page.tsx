export const dynamic = "force-dynamic";

import { fetchExpenses } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { ExpensesClient } from "./expenses-client";

export default async function ExpensesPage() {
  const expenses = await fetchExpenses(PROTOTYPE_USER_ID);
  return <ExpensesClient expenses={expenses} />;
}
