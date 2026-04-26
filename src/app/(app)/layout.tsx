import { AppSidebar } from "@/components/app-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FloatingDock } from "@/components/floating-dock";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-full">
      <AppSidebar />
      <SidebarInset className="bg-background">
        {children}
      </SidebarInset>
      <FloatingDock />
    </SidebarProvider>
  );
}
