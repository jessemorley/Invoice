"use client";

import { usePathname } from "next/navigation";

export function PageSlot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="contents">{children}</div>;
}
