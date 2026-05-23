"use client";

import { useRef, useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface ViewHeaderProps {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  loading?: boolean;
}

export function ViewHeader({ title, searchValue, onSearchChange, actions, children, loading }: ViewHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function openSearch() {
    setFilterOpen(false);
    setSearchOpen(true);
  }

  function closeSearch() {
    setSearchOpen(false);
    onSearchChange("");
  }

  return (
    <>
    <header className="flex h-14 items-center border-b">
      <div className="flex items-center justify-between gap-2 w-full max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SidebarTrigger className="hidden md:flex" />
          {searchOpen ? (
            <input
              ref={searchInputRef}
              className="text-lg font-semibold bg-transparent border-none outline-none w-full text-foreground placeholder:font-normal placeholder:text-muted-foreground/60"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
            />
          ) : (
            <h1 className="text-lg font-semibold">{title}</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {children && !searchOpen && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8 md:hidden"
              aria-label="Filter"
              onClick={() => setFilterOpen((o) => !o)}
              disabled={loading}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          )}
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
          {actions}
        </div>
      </div>
    </header>
    {children && (
      <div className="md:hidden grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: filterOpen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden" hidden={!filterOpen} data-testid="mobile-filter-bar">
          <div className="border-b px-4 py-2 flex gap-2">
            {children}
          </div>
        </div>
      </div>
    )}
    {/* Desktop filter row */}
    <div className="hidden md:block border-b">
      <div className="px-4 md:px-6 py-3 mx-auto w-full max-w-6xl flex items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            className="pl-8"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={loading}
          />
        </div>
        {children}
      </div>
    </div>
    </>
  );
}
