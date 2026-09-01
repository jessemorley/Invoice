"use client";

import { useRef, useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppMark } from "@/components/app-mark";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ViewHeaderProps {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions?: React.ReactNode;
  filterOpen?: boolean;
  filterActive?: boolean;
  onFilterToggle?: () => void;
  filterPopover?: React.ReactNode;
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  loading?: boolean;
  /** Large-title mode: the body renders its own heading, so this one fades in
   *  only once that heading has scrolled under the header. */
  titleHidden?: boolean;
  /** Hidden until the body's large title scrolls under the header. */
  borderHidden?: boolean;
  /** Mobile: the account name and avatar, rendered rightmost. */
  account?: React.ReactNode;
}

export function ViewHeader({ title, searchValue, onSearchChange, actions, filterOpen, filterActive, onFilterToggle, filterPopover, searchOpen: searchOpenProp, onSearchOpenChange, loading, titleHidden, borderHidden, account }: ViewHeaderProps) {
  // Large-title mode is opt-in: the caller renders its own big heading in the
  // body and tells this header when that heading has scrolled past.
  const collapsingTitle = titleHidden !== undefined;
  const [searchOpenInternal, setSearchOpenInternal] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const searchOpen = searchOpenProp !== undefined ? searchOpenProp : searchOpenInternal;
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function openSearch() {
    if (onSearchOpenChange) onSearchOpenChange(true);
    else setSearchOpenInternal(true);
  }

  function closeSearch() {
    if (onSearchOpenChange) {
      onSearchOpenChange(false);
    } else {
      setSearchOpenInternal(false);
      onSearchChange("");
    }
  }

  const searchButton = (
    <Button
      size="icon"
      variant="ghost"
      className="size-8 md:hidden"
      aria-label={searchOpen ? "Close search" : "Search"}
      onClick={() => (searchOpen ? closeSearch() : openSearch())}
      disabled={loading}
    >
      {searchOpen ? <X className="size-[18px]" /> : <Search className="size-[18px]" />}
    </Button>
  );

  return (
    <header
      className={cn(
        "flex h-14 items-center border-b transition-colors",
        // Large-title mode: the header is flush with the page until the title
        // docks, then it lifts to a surface with its divider back.
        borderHidden
          ? "border-transparent bg-transparent md:border-border"
          : collapsingTitle && "max-md:bg-card"
      )}
    >
      <div className="relative flex items-center justify-between gap-2 w-full max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SidebarTrigger className="hidden md:flex" />
          {/* Mobile: the app mark and search lead the header. */}
          <AppMark className="md:hidden size-5 text-foreground/80" />
          {searchButton}
          <div className="relative flex-1 min-w-0">
            <h1
              className={cn(
                "text-lg font-semibold transition-opacity duration-150 md:opacity-100",
                // In large-title mode the body owns the mobile title, so this one
                // only ever shows on desktop; the collapsed mobile title is the
                // centred span below.
                collapsingTitle && "max-md:opacity-0 max-md:pointer-events-none",
                searchOpen || titleHidden ? "opacity-0 pointer-events-none" : "opacity-100"
              )}
              aria-hidden={searchOpen || undefined}
            >
              {title}
            </h1>
            <input
              ref={searchInputRef}
              className={`absolute inset-0 text-[15px] font-semibold bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted-foreground/60 placeholder:font-semibold transition-opacity duration-150 md:hidden ${searchOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
            />
          </div>
        </div>
        {/* Collapsed mobile title: centred across the full header, a size down from
            the body's large title. Sits behind the buttons, so it can't take taps. */}
        {collapsingTitle && (
          <span
            className={cn(
              "md:hidden absolute inset-x-0 text-center text-[15px] font-semibold pointer-events-none transition-opacity duration-150",
              searchOpen || titleHidden ? "opacity-0" : "opacity-100"
            )}
            aria-hidden
          >
            {title}
          </span>
        )}
        <div className="flex items-center gap-2">
          {account}
          {filterPopover ? (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="relative size-8 md:hidden"
                  aria-label="Filter"
                  disabled={loading}
                >
                  <SlidersHorizontal className="size-4" />
                  {filterActive && (
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              {/* onClick closes the popover when any option inside is clicked. Callers must not call
                  e.stopPropagation() in their option handlers or the popover will stay open. */}
              <PopoverContent align="end" className="w-44 p-1" onClick={() => setPopoverOpen(false)}>
                {filterPopover}
              </PopoverContent>
            </Popover>
          ) : onFilterToggle ? (
            <Button
              size="icon"
              variant={filterOpen ? "secondary" : "ghost"}
              className="relative size-8 md:hidden"
              aria-label="Filter"
              onClick={onFilterToggle}
              disabled={loading}
            >
              <SlidersHorizontal className="size-4" />
              {filterActive && !filterOpen && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
              )}
            </Button>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  );
}
