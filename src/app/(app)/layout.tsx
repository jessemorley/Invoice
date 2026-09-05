import { Suspense } from "react";
import { AppSidebar } from "@/components/app-nav";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FloatingDock } from "@/components/floating-dock";
import { AppSplash } from "@/components/app-splash";
import { PushManager } from "@/components/push-manager";
import { ActiveViewProvider } from "@/components/active-view-context";
import { CurrentUserProvider } from "@/components/current-user-context";
import { getAuthUser } from "@/lib/auth";

async function SidebarWithUser() {
  const user = await getAuthUser();
  return <AppSidebar user={user} />;
}

// Streams the user to client views (for the mobile header avatar) without
// blocking the shell — children render immediately, context fills in after.
async function UserContext({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  return <CurrentUserProvider user={user}>{children}</CurrentUserProvider>;
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
            <UserContext>{children}</UserContext>
          </SidebarInset>
          <FloatingDock />
        </ActiveViewProvider>
      </Suspense>
      <AppSplash />
      <PushManager />
    </SidebarProvider>
  );
}
