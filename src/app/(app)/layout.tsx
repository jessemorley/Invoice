import { AppSidebar, BottomTabs } from "@/components/app-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-full">
      <AppSidebar />
      <SidebarInset className="overflow-y-auto pb-16 md:pb-0 bg-background">
        <div className="mx-auto w-full max-w-6xl flex flex-col h-full">
          {children}
        </div>
      </SidebarInset>
      <BottomTabs />
    </SidebarProvider>
  );
}
