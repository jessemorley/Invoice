"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { Entry, Client, WorkflowRate, BillingType } from "@/lib/types";
import { createEntry, updateEntry, deleteEntry } from "@/app/(app)/entries/actions";
import { invalidate } from "@/lib/invalidate";
import type { EntryFormData } from "@/app/(app)/entries/actions";
import { calcDayRate, calcHourly, calcManual, formatDuration } from "@/lib/entry-calc";
import { formatAUD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Minus, Plus, Search, Trash2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  client_id: string;
  date: string;
  day_type: "full" | "half";
  workflow_type: string;
  brand: string;
  skus: number | null;
  shoot_client: string;
  description: string;
  role: string;
  start_time: string;
  finish_time: string;
  break_minutes: number;
  manual_amount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY = new Date().toLocaleDateString("en-CA");

function defaultForm(entry: Entry | null, client: Client | null): FormState {
  if (entry && client) {
    return {
      client_id: entry.client.id,
      date: entry.date,
      day_type: (entry.day_type as "full" | "half") ?? "full",
      workflow_type: entry.workflow_type ?? "Apparel",
      brand: entry.brand ?? "",
      skus: entry.skus ?? null,
      shoot_client: entry.shoot_client || entry.description || "",
      description: entry.description ?? "",
      role: entry.role ?? "Photographer",
      start_time: entry.start_time?.slice(0, 5) ?? client.default_start_time?.slice(0, 5) ?? "09:00",
      finish_time: entry.finish_time?.slice(0, 5) ?? client.default_finish_time?.slice(0, 5) ?? "17:00",
      break_minutes: entry.break_minutes ?? 0,
      manual_amount: entry.base_amount ?? 0,
    };
  }
  return {
    client_id: "",
    date: TODAY,
    day_type: "full",
    workflow_type: "Apparel",
    brand: "",
    skus: null,
    shoot_client: "",
    description: "",
    role: "Photographer",
    start_time: "09:00",
    finish_time: "17:00",
    break_minutes: 0,
    manual_amount: 0,
  };
}

function applyClientDefaults(client: Client): Partial<FormState> {
  if (client.billing_type === "hourly") {
    return {
      start_time: client.default_start_time?.slice(0, 5) ?? "09:00",
      finish_time: client.default_finish_time?.slice(0, 5) ?? "17:00",
      break_minutes: 0,
      role: "Photographer",
    };
  }
  if (client.billing_type === "day_rate") {
    return { day_type: "full", workflow_type: "Apparel" };
  }
  return { manual_amount: 0 };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClientPicker({
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
  const filtered = active.filter((c) =>
    !query || c.name.toLowerCase().includes(query.toLowerCase())
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
          <p className="px-4 py-8 text-sm text-muted-foreground text-center">No clients found</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function SummaryPanel({
  client,
  calc,
  billingType,
  rawMins,
}: {
  client: Client;
  calc: { base: number; bonus: number; superAmt: number; total: number } | null;
  billingType: BillingType;
  rawMins?: number;
}) {
  if (!calc) return null;

  return (
    <div className="px-4 py-1.5">
      <Card className="py-3 gap-0">
        <CardContent className="px-4 flex flex-col gap-1.5">
          {billingType === "hourly" && rawMins != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{formatDuration(rawMins)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Base</span>
            <span className="font-medium">{formatAUD(calc.base)}</span>
          </div>
          {calc.bonus > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bonus</span>
              <span className="font-medium">{formatAUD(calc.bonus)}</span>
            </div>
          )}
          {client.pays_super && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Super</span>
              <span className="font-medium">{formatAUD(calc.superAmt)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span>{formatAUD(calc.total)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PRODUCT_WORKFLOWS = ["Batch A", "Batch B", "Batch C", "Batch D", "Flatlay", "Model Shot"];

export function EntrySheet({
  open,
  onOpenChange,
  entry,
  clients,
  workflowRates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Entry | null;
  clients: Client[];
  workflowRates: WorkflowRate[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editClient = entry ? clients.find((c) => c.id === entry.client.id) ?? null : null;

  const [selectedClient, setSelectedClient] = useState<Client | null>(
    entry ? editClient : null
  );
  const [form, setForm] = useState<FormState>(() => defaultForm(entry, editClient));

  useEffect(() => {
    if (!open) return;
    const ec = entry ? clients.find((c) => c.id === entry.client.id) ?? null : null;
    setSelectedClient(entry ? ec : null);
    setForm(defaultForm(entry, ec));
    setError(null);
  }, [open, entry]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSelectClient(client: Client) {
    setSelectedClient(client);
    setForm((prev) => ({
      ...prev,
      client_id: client.id,
      date: prev.date || TODAY,
      ...applyClientDefaults(client),
    }));
  }

  const billingType = selectedClient?.billing_type ?? "day_rate";

  const clientWorkflowSet = useMemo(() => {
    if (!selectedClient) return new Set<string>();
    return new Set(
      workflowRates.filter((r) => r.client_id === selectedClient.id).map((r) => r.workflow)
    );
  }, [selectedClient, workflowRates]);

  const productSubOptions = useMemo(
    () => PRODUCT_WORKFLOWS.filter((w) => clientWorkflowSet.has(w)),
    [clientWorkflowSet]
  );

  const isProductWorkflow = PRODUCT_WORKFLOWS.includes(form.workflow_type);
  const topWorkflow: "Apparel" | "Product" | "Own Brand" = isProductWorkflow
    ? "Product"
    : (form.workflow_type as "Apparel" | "Own Brand");

  function handleTopWorkflow(v: string) {
    if (!v) return;
    if (v === "Product") {
      set("workflow_type", productSubOptions[0] ?? "Batch A");
    } else {
      set("workflow_type", v);
    }
  }

  const calcResult = useMemo(() => {
    if (!selectedClient) return null;
    if (billingType === "day_rate") {
      return calcDayRate(selectedClient, form.day_type, form.workflow_type, form.skus, workflowRates);
    }
    if (billingType === "hourly") {
      return calcHourly(selectedClient, form.start_time, form.finish_time, form.break_minutes, form.role);
    }
    return calcManual(form.manual_amount, selectedClient);
  }, [selectedClient, billingType, form, workflowRates]);

  function buildPayload(): EntryFormData {
    const calc = calcResult ?? { base: 0, bonus: 0, superAmt: 0, total: 0, hoursWorked: null };
    return {
      client_id: form.client_id,
      date: form.date,
      billing_type: billingType,
      day_type: billingType === "day_rate" ? form.day_type : null,
      workflow_type: billingType === "day_rate" ? form.workflow_type : null,
      skus: billingType === "day_rate" && needsSkus ? form.skus : null,
      brand: billingType === "day_rate" && needsBrand ? form.brand || null : null,
      shoot_client: billingType === "hourly" && selectedClient?.entry_label ? form.shoot_client || null : null,
      description: billingType !== "day_rate" && !selectedClient?.entry_label ? form.description || null : null,
      role: billingType === "hourly" && selectedClient?.show_role ? form.role || null : null,
      start_time: billingType === "hourly" ? form.start_time || null : null,
      finish_time: billingType === "hourly" ? form.finish_time || null : null,
      break_minutes: billingType === "hourly" ? form.break_minutes : null,
      hours_worked: calc.hoursWorked,
      base_amount: calc.base,
      bonus_amount: calc.bonus,
      super_amount: calc.superAmt,
      total_amount: calc.total,
    };
  }

  function handleSubmit() {
    if (!selectedClient) return;
    setError(null);
    startTransition(async () => {
      try {
        const payload = buildPayload();
        if (entry) {
          await updateEntry(entry.id, payload);
        } else {
          await createEntry(payload);
        }
        invalidate("entries");
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    if (!entry) return;
    if (entry.invoice_id) {
      setError(`This entry is part of invoice ${entry.invoice?.number ?? "an invoice"} and can't be deleted directly. Delete the invoice instead.`);
      return;
    }
    startDeleteTransition(async () => {
      try {
        await deleteEntry(entry.id);
        invalidate("entries");
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  // Field visibility
  const showDayType = billingType === "day_rate";
  const showWorkflow = billingType === "day_rate" && form.day_type === "full" && clientWorkflowSet.size > 0;
  const needsBrand = billingType === "day_rate" && form.workflow_type === "Own Brand";
  const needsSkus = billingType === "day_rate" && (form.workflow_type === "Apparel" || isProductWorkflow);
  const showEntryLabel = billingType === "hourly" && !!selectedClient?.entry_label;
  const showDescription = (billingType === "hourly" && !selectedClient?.entry_label) || billingType === "manual";
  const showRole = billingType === "hourly" && !!selectedClient?.show_role;
  const showTimes = billingType === "hourly";
  const showBreak = billingType === "hourly";
  const showAmount = billingType === "manual";

  const rawMins = billingType === "hourly" && calcResult && "rawMins" in calcResult
    ? (calcResult as { rawMins?: number }).rawMins
    : undefined;

  const title = entry
    ? selectedClient?.name ?? "Edit entry"
    : selectedClient
    ? selectedClient.name
    : "New entry";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 w-full sm:max-w-md">
        <SheetHeader className={cn("px-4 py-4 flex-row items-center gap-2", selectedClient && "border-b")}>
          {!entry && selectedClient && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => setSelectedClient(null)}
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {!selectedClient ? (
            <ClientPicker clients={clients} onSelect={handleSelectClient} />
          ) : (
            <div className="flex flex-col gap-4 px-4 py-4">
              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Date</label>
                <div className="h-9 rounded-lg border border-input bg-transparent px-3 flex items-center">
                  <input
                    type="date"
                    className="w-full bg-transparent outline-none text-sm text-foreground"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </div>
              </div>

              {/* Day type */}
              {showDayType && (
                <Field label="Day type">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={form.day_type}
                    onValueChange={(v) => v && set("day_type", v as "full" | "half")}
                    className="w-full"
                  >
                    <ToggleGroupItem value="full" className="flex-1">Full day</ToggleGroupItem>
                    <ToggleGroupItem value="half" className="flex-1">Half day</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              )}

              {/* Workflow */}
              {showWorkflow && (
                <Field label="Workflow">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={topWorkflow}
                    onValueChange={handleTopWorkflow}
                    className="w-full"
                  >
                    <ToggleGroupItem value="Apparel" className="flex-1">Apparel</ToggleGroupItem>
                    <ToggleGroupItem value="Product" className="flex-1">Product</ToggleGroupItem>
                    <ToggleGroupItem value="Own Brand" className="flex-1">Own Brand</ToggleGroupItem>
                  </ToggleGroup>
                  {topWorkflow === "Product" && productSubOptions.length > 0 && (
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={form.workflow_type}
                      onValueChange={(v) => v && set("workflow_type", v)}
                      className="w-full mt-1"
                    >
                      {productSubOptions.map((opt) => (
                        <ToggleGroupItem key={opt} value={opt} className="flex-1 text-xs">
                          {opt}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                </Field>
              )}

              {/* Brand */}
              {needsBrand && (
                <Field label="Brand">
                  <Input
                    className="text-sm"
                    value={form.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    placeholder="Brand name"
                  />
                </Field>
              )}

              {/* SKUs */}
              {needsSkus && (
                <Field label="SKUs">
                  <Input
                    type="number"
                    min={0}
                    className="text-sm"
                    value={form.skus ?? ""}
                    onChange={(e) =>
                      set("skus", e.target.value === "" ? null : parseInt(e.target.value, 10))
                    }
                    placeholder="0"
                  />
                </Field>
              )}

              {/* Custom entry label (hourly-with-label) */}
              {showEntryLabel && (
                <Field label={selectedClient.entry_label!}>
                  <Input
                    className="text-sm"
                    value={form.shoot_client}
                    onChange={(e) => set("shoot_client", e.target.value)}
                    placeholder={selectedClient.entry_label!}
                  />
                </Field>
              )}

              {/* Description */}
              {showDescription && (
                <Field label="Description">
                  <Textarea
                    className="text-sm"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="What did you work on?"
                    rows={3}
                  />
                </Field>
              )}

              {/* Role */}
              {showRole && (
                <Field label="Role">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={form.role}
                    onValueChange={(v) => v && set("role", v)}
                    className="w-full"
                  >
                    <ToggleGroupItem value="Photographer" className="flex-1">Photographer</ToggleGroupItem>
                    <ToggleGroupItem value="Operator" className="flex-1">Operator</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              )}

              {/* Time fields */}
              {showTimes && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start">
                    <div className="h-9 rounded-lg border border-input bg-transparent px-3 flex items-center">
                      <input
                        type="time"
                        className="w-full bg-transparent outline-none text-sm text-foreground"
                        value={form.start_time}
                        onChange={(e) => set("start_time", e.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="Finish">
                    <div className="h-9 rounded-lg border border-input bg-transparent px-3 flex items-center">
                      <input
                        type="time"
                        className="w-full bg-transparent outline-none text-sm text-foreground"
                        value={form.finish_time}
                        onChange={(e) => set("finish_time", e.target.value)}
                      />
                    </div>
                  </Field>
                </div>
              )}

              {/* Break */}
              {showBreak && (
                <Field label="Break">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => set("break_minutes", Math.max(0, form.break_minutes - 15))}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      step={15}
                      value={form.break_minutes}
                      onChange={(e) => set("break_minutes", parseInt(e.target.value, 10) || 0)}
                      className="text-center text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => set("break_minutes", form.break_minutes + 15)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </Field>
              )}

              {/* Manual amount */}
              {showAmount && (
                <Field label="Amount">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="pl-7 text-sm"
                      value={form.manual_amount === 0 ? "" : form.manual_amount}
                      onChange={(e) =>
                        set("manual_amount", e.target.value === "" ? 0 : parseFloat(e.target.value))
                      }
                      placeholder="0.00"
                    />
                  </div>
                </Field>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>

        {/* Summary */}
        {selectedClient && calcResult && (
          <SummaryPanel
            client={selectedClient}
            calc={calcResult}
            billingType={billingType}
            rawMins={rawMins}
          />
        )}

        {/* Footer */}
        {selectedClient && (
          <div className="px-4 py-3 flex gap-2">
            {entry && (
              <Button
                variant="destructive"
                size="icon-lg"
                className="shrink-0"
                onClick={handleDelete}
                disabled={isDeleting || isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending || isDeleting}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleSubmit}
              disabled={isPending || isDeleting}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
