import { Suspense } from "react";
import { ViewSwitch } from "@/components/view-switch";
import { getAuthUser } from "@/lib/auth";

async function ViewSwitchWithUser() {
  const { email, name } = await getAuthUser();
  return <ViewSwitch userEmail={email} userName={name} />;
}

export default function AppPage() {
  return (
    <Suspense>
      <ViewSwitchWithUser />
    </Suspense>
  );
}
