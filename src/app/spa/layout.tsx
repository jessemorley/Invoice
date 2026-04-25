import { SidebarProvider } from "@/components/ui/sidebar";

export default function SpaLayout({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>;
}
