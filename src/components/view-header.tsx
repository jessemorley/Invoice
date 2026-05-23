"use client";

import { useRef, useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface ViewHeaderProps {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  actions?: React.ReactNode;
  filterOpen?: boolean;
  onFilterToggle?: () => void;
  loading?: boolean;
}

export function ViewHeader({ title, searchValue, onSearchChange, actions, filterOpen, onFilterToggle, loading }: ViewHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function openSearch() {
    setSearchOpen(true);
  }

  function closeSearch() {
    setSearchOpen(false);
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
          {onFilterToggle && (
            <Button
              size="icon"
              variant={filterOpen ? "secondary" : "ghost"}
              className="size-8 md:hidden"
              aria-label="Filter"
              onClick={onFilterToggle}
              disabled={loading}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
