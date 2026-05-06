"use client";

import { useState } from "react";
import type { Client } from "@/lib/types";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function ClientPicker({
  clients,
  onSelect,
}: {
  clients: Client[];
  onSelect: (client: Client) => void;
}) {
  const [query, setQuery] = useState("");
  const active = clients
    .filter((c) => c.is_active)
    .sort((a, b) => b.invoice_count - a.invoice_count);
  const filtered = active.filter(
    (c) => !query || c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search clients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-y-auto">
        {filtered.map((c) => (
          <button
            key={c.id}
            className="flex items-center gap-3 w-full px-6 py-3.5 hover:bg-accent/50 transition-colors text-left"
            onClick={() => onSelect(c)}
          >
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: c.color ?? "#9ca3af" }}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.invoice_count} {c.invoice_count === 1 ? "invoice" : "invoices"}
              </span>
            </div>
            <span className="ml-auto text-xs text-muted-foreground capitalize shrink-0">
              {c.billing_type.replace("_", " ")}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-sm text-muted-foreground text-center">
            No clients found
          </p>
        )}
      </div>
    </div>
  );
}
