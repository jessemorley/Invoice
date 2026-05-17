import { Suspense } from "react";
import { AppSidebar } from "@/components/app-nav";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FloatingDock } from "@/components/floating-dock";
import { AppSplash } from "@/components/app-splash";
import { ActiveViewProvider } from "@/components/active-view-context";
import { getAuthUser } from "@/lib/auth";

async function SidebarWithUser() {
  const user = await getAuthUser();
  return <AppSidebar user={user} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-full">
      <Suspense>
        <ActiveViewProvider>
          <Suspense fallback={<Sidebar collapsible="icon" className="hidden md:flex border-r" />}>
            <SidebarWithUser />
          </Suspense>
          <SidebarInset className="bg-background">
            {children}
          </SidebarInset>
          <FloatingDock />
        </ActiveViewProvider>
      </Suspense>
      <AppSplash />
    </SidebarProvider>
  );
}
