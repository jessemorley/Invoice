"use client";

import { useTransition } from "react";
import { updateClientColor } from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const CLIENT_COLOR_FALLBACK = "#9ca3af";

const PALETTE = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#22c55e", // green-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#10b981", // emerald-500
  "#64748b", // slate-500
];

type Client = { id: string; name: string; billing_type: string; color: string | null };

function ColorSwatch({
  clientId,
  current,
}: {
  clientId: string;
  current: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function pick(color: string) {
    startTransition(() => updateClientColor(clientId, color));
  }

  return (
    <div className={`flex gap-1.5 flex-wrap${isPending ? " opacity-60 pointer-events-none" : ""}`}>
      {PALETTE.map((color) => (
        <button
          key={color}
          onClick={() => pick(color)}
          className="size-6 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            backgroundColor: color,
            borderColor: (current ?? CLIENT_COLOR_FALLBACK) === color ? "white" : "transparent",
            boxShadow: (current ?? CLIENT_COLOR_FALLBACK) === color ? `0 0 0 2px ${color}` : undefined,
          }}
          aria-label={color}
        />
      ))}
    </div>
  );
}

export function ClientsView({ clients }: { clients: Client[] }) {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Clients" />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-6 mx-auto w-full max-w-6xl">
          <Card className="overflow-hidden py-0 gap-0">
            <CardContent className="p-0">
              {clients.map((client, i) => (
                <div key={client.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-4 px-4 py-4">
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: client.color ?? CLIENT_COLOR_FALLBACK }}
                    />
                    <span className="text-sm font-medium w-48 shrink-0">{client.name}</span>
                    <ColorSwatch clientId={client.id} current={client.color} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
