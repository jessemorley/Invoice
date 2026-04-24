import { Suspense } from "react";
import { fetchExpenses } from "@/lib/queries";
import { PROTOTYPE_USER_ID } from "@/lib/supabase";
import { ExpensesClient } from "./expenses-client";

async function ExpensesData() {
  const expenses = await fetchExpenses(PROTOTYPE_USER_ID);
  return <ExpensesClient expenses={expenses} />;
}

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesData />
    </Suspense>
  );
}
