"use client";

import { useRef, useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
}

export function ViewHeader({ title, searchValue, onSearchChange, actions, filterOpen, filterActive, onFilterToggle, filterPopover, searchOpen: searchOpenProp, onSearchOpenChange, loading }: ViewHeaderProps) {
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
    if (onSearchOpenChange) onSearchOpenChange(false);
    else setSearchOpenInternal(false);
    onSearchChange("");
  }

  return (
    <header className="flex h-14 items-center border-b">
      <div className="flex items-center justify-between gap-2 w-full max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SidebarTrigger className="hidden md:flex" />
          <div className="relative flex-1 min-w-0">
            <h1
              className={`text-lg font-semibold transition-opacity duration-150 md:opacity-100 ${searchOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
              aria-hidden={searchOpen || undefined}
            >
              {title}
            </h1>
            <input
              ref={searchInputRef}
              className={`absolute inset-0 text-lg font-semibold bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted-foreground/60 transition-opacity duration-150 md:hidden ${searchOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-8 md:hidden"
            aria-label={searchOpen ? "Close search" : "Search"}
            onClick={() => searchOpen ? closeSearch() : openSearch()}
            disabled={loading}
          >
            {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
          </Button>
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
