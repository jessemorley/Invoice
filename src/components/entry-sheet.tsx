"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Entry, BillingType, DayType, ClientRef } from "@/lib/types";
import { createEntry, updateEntry } from "@/app/(app)/entries/actions";
import type { EntryFormData } from "@/app/(app)/entries/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

type Client = { id: string; name: string; billing_type: string; color: string | null };

function defaultForm(entry: Entry | null, clients: Client[]): EntryFormData {
  if (entry) {
    return {
      client_id: entry.client.id,
      date: entry.date,
      description: entry.description ?? "",
      billing_type: entry.billing_type,
      day_type: entry.day_type ?? null,
      hours: entry.hours ?? null,
      base_amount: entry.base_amount,
      bonus_amount: entry.bonus_amount,
    };
  }
  const today = new Date().toLocaleDateString("en-CA");
  const defaultClient = clients[0];
  return {
    client_id: defaultClient?.id ?? "",
    date: today,
    description: "",
    billing_type: (defaultClient?.billing_type as BillingType) ?? "day_rate",
    day_type: "full",
    hours: null,
    base_amount: 0,
    bonus_amount: 0,
  };
}

export function EntrySheet({
  open,
  onOpenChange,
  entry,
  clients,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Entry | null;
  clients: Client[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<EntryFormData>(() => defaultForm(entry, clients));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(defaultForm(entry, clients));
    setError(null);
  }, [entry, open]);

  function set<K extends keyof EntryFormData>(key: K, value: EntryFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleBillingTypeChange(val: BillingType) {
    setForm((prev) => ({
      ...prev,
      billing_type: val,
      day_type: val === "day_rate" ? (prev.day_type ?? "full") : null,
      hours: val === "hourly" ? (prev.hours ?? null) : null,
    }));
  }

  function handleClientChange(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    setForm((prev) => ({
      ...prev,
      client_id: clientId,
      billing_type: (client?.billing_type as BillingType) ?? prev.billing_type,
    }));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        if (entry) {
          await updateEntry(entry.id, form);
        } else {
          await createEntry(form);
        }
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle>{entry ? "Edit entry" : "New entry"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Client */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Client</label>
            <Select value={form.client_id} onValueChange={handleClientChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full shrink-0 inline-block"
                        style={{ backgroundColor: c.color ?? "#9ca3af" }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Date</label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What did you work on?"
              rows={3}
            />
          </div>

          {/* Billing type */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Billing type</label>
            <Select
              value={form.billing_type}
              onValueChange={(v) => handleBillingTypeChange(v as BillingType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day_rate">Day rate</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day type — only for day_rate */}
          {form.billing_type === "day_rate" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Day type</label>
              <Select
                value={form.day_type ?? "full"}
                onValueChange={(v) => set("day_type", v as DayType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full day</SelectItem>
                  <SelectItem value="half">Half day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Hours — only for hourly */}
          {form.billing_type === "hourly" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Hours</label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.hours ?? ""}
                onChange={(e) =>
                  set("hours", e.target.value === "" ? null : parseFloat(e.target.value))
                }
                placeholder="0"
              />
            </div>
          )}

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Base amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="pl-6"
                  value={form.base_amount === 0 ? "" : form.base_amount}
                  onChange={(e) =>
                    set("base_amount", e.target.value === "" ? 0 : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Bonus</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="pl-6"
                  value={form.bonus_amount === 0 ? "" : form.bonus_amount}
                  onChange={(e) =>
                    set("bonus_amount", e.target.value === "" ? 0 : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter className="px-6 py-4 border-t flex-row gap-2">
          <SheetClose asChild>
            <Button variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
