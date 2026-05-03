import { Suspense } from "react";
import { ViewSwitch } from "@/components/view-switch";
import { getAuthUser } from "@/lib/auth";

export default async function AppPage() {
  const { email, name } = await getAuthUser();
  return (
    <Suspense>
      <ViewSwitch userEmail={email} userName={name} />
    </Suspense>
  );
}
