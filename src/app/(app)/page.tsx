import { Suspense } from "react";
import { ViewSwitch } from "@/components/view-switch";

export default function AppPage() {
  return (
    <Suspense>
      <ViewSwitch />
    </Suspense>
  );
}
