import { ViewSwitch } from "@/components/view-switch";
import { getAuthUser } from "@/lib/auth";
import { loadEntriesViewData } from "@/app/(app)/actions";

async function ViewSwitchWithUser({ wantsEntries }: { wantsEntries: boolean }) {
  const [{ email, name }, initialEntriesData] = await Promise.all([
    getAuthUser(),
    wantsEntries ? loadEntriesViewData() : Promise.resolve(undefined),
  ]);
  return <ViewSwitch userEmail={email} userName={name} initialEntriesData={initialEntriesData} />;
}

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  const wantsEntries = view === undefined || view === "entries";
  return <ViewSwitchWithUser wantsEntries={wantsEntries} />;
}
