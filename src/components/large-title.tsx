"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// The large title sits just below the header, so its first pixel slides under
// almost immediately — that's when the header takes its surface and divider.
const HEADER_CHROME_SCROLL = 8;
// Further down the title is fully hidden; that's when the header title appears.
const LARGE_TITLE_SCROLL = 32;

/**
 * Drives the iOS-style collapsing header: a large title in the scroll body that
 * hands off to the fixed header's own title as it scrolls under.
 *
 * Spread `headerProps` onto ViewHeader/PageHeader and call `onScroll` from the
 * scroll container (chain it if the container already has a handler).
 */
export function useCollapsingTitle() {
  const [titleCollapsed, setTitleCollapsed] = useState(false);
  const [headerRaised, setHeaderRaised] = useState(false);

  function onScroll(el: HTMLElement) {
    setHeaderRaised(el.scrollTop > HEADER_CHROME_SCROLL);
    setTitleCollapsed(el.scrollTop > LARGE_TITLE_SCROLL);
  }

  return {
    onScroll,
    headerProps: { titleHidden: !titleCollapsed, borderHidden: !headerRaised },
  };
}

/** Mobile-only big heading that scrolls away beneath the fixed header. */
export function LargeTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("md:hidden px-4 pt-2 pb-1 text-3xl font-semibold tracking-tight", className)}>
      {children}
    </h2>
  );
}

/** Shared tab styling across settings, invoices and entries. */
export const TAB_TRIGGER =
  "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 dark:data-[state=active]:bg-accent dark:data-[state=active]:border-transparent";
