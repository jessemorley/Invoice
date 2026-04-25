import { AppSidebar } from "@/components/app-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FloatingDock } from "@/components/floating-dock";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-full">
      <AppSidebar />
      <SidebarInset className="overflow-y-auto pb-28 md:pb-0 bg-background">
        {children}
      </SidebarInset>
      <FloatingDock />
    </SidebarProvider>
  );
}
