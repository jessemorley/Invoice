"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Receipt, Users, Wallet, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/entries", icon: FileText, label: "Entries" },
  { href: "/invoices", icon: Receipt, label: "Invoices" },
  { href: "/clients", icon: Users, label: "Clients" },
  { href: "/expenses", icon: Wallet, label: "Expenses" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const itemClass = (isActive: boolean) =>
  cn(
    "relative flex items-center justify-center w-11 h-11 rounded-full transition-colors",
    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
  );

const ItemInner = ({ isActive, icon: Icon }: { isActive: boolean; icon: (typeof tabs)[0]["icon"] }) => (
  <>
    {isActive && <span className="absolute inset-0 rounded-full bg-primary/10" />}
    <Icon className="size-[21px] relative" strokeWidth={isActive ? 2.25 : 1.75} />
  </>
);

function StandaloneDockItem({
  href, icon: Icon, label, isActive, onTap,
}: (typeof tabs)[0] & { isActive: boolean; onTap: (href: string) => void }) {
  return (
    <button
      aria-label={label}
      onClick={() => onTap(href)}
      className={itemClass(isActive)}
    >
      <ItemInner isActive={isActive} icon={Icon} />
    </button>
  );
}

function BrowserDockItem({ href, icon: Icon, label, pathname }: (typeof tabs)[0] & { pathname: string }) {
  const { pending } = useLinkStatus();
  const isActive = pending || pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-label={label}
      onClick={(e) => {
        if (pathname.startsWith(href)) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("dock:focus-search"));
        }
      }}
      className={itemClass(isActive)}
    >
      <ItemInner isActive={isActive} icon={Icon} />
    </Link>
  );
}

export function FloatingDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [isStandalone, setIsStandalone] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setIsStandalone(
      "standalone" in window.navigator &&
        !!(window.navigator as { standalone: boolean }).standalone
    );
  }, []);

  // Clear pendingHref once pathname catches up
  useEffect(() => {
    if (pendingHref && pathname.startsWith(pendingHref)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  const handleTap = useCallback((href: string) => {
    if (pathname.startsWith(href)) {
      window.dispatchEvent(new CustomEvent("dock:focus-search"));
    } else {
      setPendingHref(href);
      router.push(href);
    }
  }, [pathname, router]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden" style={{ bottom: "max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}>
      <nav className="flex items-center gap-0.5 bg-background/95 backdrop-blur-md border border-border/50 rounded-full px-2.5 py-2 shadow-xl shadow-black/10">
        {tabs.map((tab) =>
          isStandalone ? (
            <StandaloneDockItem
              key={tab.href}
              {...tab}
              isActive={pendingHref ? pendingHref === tab.href : pathname.startsWith(tab.href)}
              onTap={handleTap}
            />
          ) : (
            <BrowserDockItem key={tab.href} {...tab} pathname={pathname} />
          )
        )}
      </nav>
    </div>
  );
}
