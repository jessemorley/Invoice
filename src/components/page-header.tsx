import { SidebarTrigger } from "@/components/ui/sidebar";

interface PageHeaderProps {
  title: string;
  mobileTitle?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ title, mobileTitle, children }: PageHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SidebarTrigger className="hidden md:flex" />
        {mobileTitle ? (
          <>
            <div className="md:hidden flex-1 min-w-0">{mobileTitle}</div>
            <h1 className="hidden md:block text-lg font-semibold">{title}</h1>
          </>
        ) : (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
