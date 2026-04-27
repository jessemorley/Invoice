import { AppSidebar } from "@/components/app-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FloatingDock } from "@/components/floating-dock";
import { PageSlot } from "@/components/page-slot";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-full">
      <AppSidebar />
      <SidebarInset className="bg-background">
        <PageSlot>{children}</PageSlot>
      </SidebarInset>
      <FloatingDock />
    </SidebarProvider>
  );
}
