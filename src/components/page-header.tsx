interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b px-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
