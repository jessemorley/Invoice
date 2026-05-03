import { Suspense } from "react";
import { AppSidebar } from "@/components/app-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FloatingDock } from "@/components/floating-dock";
import { getAuthUser } from "@/lib/auth";

async function SidebarWithUser() {
  const user = await getAuthUser();
  return <AppSidebar user={user} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-full">
      <Suspense>
        <SidebarWithUser />
      </Suspense>
      <SidebarInset className="bg-background">
        {children}
      </SidebarInset>
      <Suspense>
        <FloatingDock />
      </Suspense>
    </SidebarProvider>
  );
}
