import { ViewSwitch } from "@/components/view-switch";
import { getAuthUser } from "@/lib/auth";
import { loadEntriesViewData } from "@/app/(app)/actions";

async function ViewSwitchWithUser() {
  const [{ email, name }, initialEntriesData] = await Promise.all([
    getAuthUser(),
    loadEntriesViewData(),
  ]);
  return <ViewSwitch userEmail={email} userName={name} initialEntriesData={initialEntriesData} />;
}

export default function AppPage() {
  return <ViewSwitchWithUser />;
}
