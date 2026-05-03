import { Suspense } from "react";
import { AppSidebar } from "@/components/app-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FloatingDock } from "@/components/floating-dock";
import { getAuthUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  return (
    <SidebarProvider className="h-full">
      <Suspense>
        <AppSidebar user={user} />
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
