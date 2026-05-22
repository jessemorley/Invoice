"use client";

import type { Client } from "@/lib/types";

export function ClientPicker({
  clients,
  query,
  onSelectAction,
}: {
  clients: Client[];
  query: string;
  onSelectAction: (client: Client) => void;
}) {
  const active = clients
    .filter((c) => c.is_active)
    .sort((a, b) => b.invoice_count - a.invoice_count);
  const filtered = active.filter(
    (c) => !query || c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col">
      <div className="overflow-y-auto">
        {filtered.map((c, i) => (
          <button
            key={c.id}
            className="flex items-center gap-3 w-full px-6 py-3.5 hover:bg-accent/50 transition-colors text-left animate-in fade-in-0 slide-in-from-bottom-3 duration-200 [animation-fill-mode:both]"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            onClick={() => onSelectAction(c)}
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
