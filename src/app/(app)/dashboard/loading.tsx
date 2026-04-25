import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex h-[calc(100dvh-7rem)] items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
