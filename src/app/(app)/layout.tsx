import { FloatingDock } from "@/components/floating-dock";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="pb-28">{children}</div>
      <FloatingDock />
    </div>
  );
}
