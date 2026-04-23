"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Entry, Client, WorkflowRate, BillingType, DayType } from "@/lib/types";
import { createEntry, updateEntry, deleteEntry } from "@/app/(app)/entries/actions";
import type { EntryFormData } from "@/app/(app)/entries/actions";
import { calcDayRate, calcHourly, calcManual, formatDuration } from "@/lib/entry-calc";
import { formatAUD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Minus, Plus, Search, ChevronLeft, Trash2 } from "lucide-react";

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
      shoot_client: entry.shoot_client ?? "",
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
  const filtered = query
    ? clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : clients;

  return (
    <div className="flex flex-col gap-0">
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
            className="flex items-center gap-3 w-full px-4 min-h-[56px] hover:bg-accent/50 transition-colors text-left"
            onClick={() => onSelect(c)}
          >
            <span
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: c.color ?? "#9ca3af" }}
            />
            <span className="text-sm font-medium">{c.name}</span>
            <span className="ml-auto text-xs text-muted-foreground capitalize">
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

function ToggleButtons<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cn(
            "h-12 rounded-lg text-sm font-medium transition-colors border",
            value === opt.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-transparent hover:bg-accent"
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function BreakStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="h-11 w-14 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors"
        onClick={() => onChange(Math.max(0, value - 15))}
      >
        <Minus className="size-4" />
      </button>
      <span className="text-2xl font-black tabular-nums min-w-[4rem] text-center">
        {value}m
      </span>
      <button
        type="button"
        className="h-11 w-14 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors"
        onClick={() => onChange(value + 15)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
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
    <div className="border-t bg-muted/40 px-4 py-3 flex flex-col gap-1">
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
      <div className="flex justify-between text-base font-bold pt-1 border-t mt-1">
        <span>Total</span>
        <span>{formatAUD(calc.total)}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const router = useRouter();
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

  const PRODUCT_WORKFLOWS = ["Batch A", "Batch B", "Batch C", "Batch D", "Flatlay", "Model Shot"];

  // All workflow values this client has rates for
  const clientWorkflowSet = useMemo(() => {
    if (!selectedClient) return new Set<string>();
    return new Set(
      workflowRates.filter((r) => r.client_id === selectedClient.id).map((r) => r.workflow)
    );
  }, [selectedClient, workflowRates]);

  // Sub-options shown under "Product"
  const productSubOptions = useMemo(
    () => PRODUCT_WORKFLOWS.filter((w) => clientWorkflowSet.has(w)),
    [clientWorkflowSet]
  );

  const isProductWorkflow = PRODUCT_WORKFLOWS.includes(form.workflow_type);
  const topWorkflow: "Apparel" | "Product" | "Own Brand" = isProductWorkflow
    ? "Product"
    : (form.workflow_type as "Apparel" | "Own Brand");

  function handleTopWorkflow(v: "Apparel" | "Product" | "Own Brand") {
    if (v === "Product") {
      set("workflow_type", productSubOptions[0] ?? "Batch A");
    } else {
      set("workflow_type", v);
    }
  }

  // Live calculation
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
      role: (billingType === "hourly" && selectedClient?.show_role) ? form.role || null : null,
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
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    if (!entry) return;
    startDeleteTransition(async () => {
      try {
        await deleteEntry(entry.id);
        router.refresh();
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
        <SheetHeader className="px-4 py-4 border-b flex-row items-center gap-3">
          {!entry && selectedClient && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSelectedClient(null)}
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {!selectedClient ? (
            <ClientPicker clients={clients} onSelect={handleSelectClient} />
          ) : (
            <div className="flex flex-col gap-5 px-4 py-5">
              {/* Date */}
              <Field label="Date">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  className="h-12 text-base"
                />
              </Field>

              {/* Day type */}
              {showDayType && (
                <Field label="Day type">
                  <ToggleButtons
                    options={[
                      { label: "Full day", value: "full" },
                      { label: "Half day", value: "half" },
                    ]}
                    value={form.day_type}
                    onChange={(v) => set("day_type", v)}
                  />
                </Field>
              )}

              {/* Workflow */}
              {showWorkflow && (
                <Field label="Workflow">
                  <ToggleButtons
                    options={[
                      { label: "Apparel", value: "Apparel" },
                      { label: "Product", value: "Product" },
                      { label: "Own Brand", value: "Own Brand" },
                    ]}
                    value={topWorkflow}
                    onChange={handleTopWorkflow}
                  />
                  {topWorkflow === "Product" && productSubOptions.length > 0 && (
                    <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: `repeat(${productSubOptions.length}, 1fr)` }}>
                      {productSubOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={cn(
                            "h-10 rounded-lg text-xs font-medium transition-colors border",
                            form.workflow_type === opt
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-transparent hover:bg-accent"
                          )}
                          onClick={() => set("workflow_type", opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              )}

              {/* Brand */}
              {needsBrand && (
                <Field label="Brand">
                  <Input
                    value={form.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    placeholder="Brand name"
                    className="h-12 text-base"
                  />
                </Field>
              )}

              {/* SKUs */}
              {needsSkus && (
                <Field label="SKUs">
                  <Input
                    type="number"
                    min={0}
                    value={form.skus ?? ""}
                    onChange={(e) =>
                      set("skus", e.target.value === "" ? null : parseInt(e.target.value, 10))
                    }
                    placeholder="0"
                    className="h-12 text-base"
                  />
                </Field>
              )}

              {/* Custom entry label (hourly-with-label) */}
              {showEntryLabel && (
                <Field label={selectedClient.entry_label!}>
                  <Input
                    value={form.shoot_client}
                    onChange={(e) => set("shoot_client", e.target.value)}
                    placeholder={selectedClient.entry_label!}
                    className="h-12 text-base"
                  />
                </Field>
              )}

              {/* Description */}
              {showDescription && (
                <Field label="Description">
                  <Textarea
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
                  <ToggleButtons
                    options={[
                      { label: "Photographer", value: "Photographer" },
                      { label: "Operator", value: "Operator" },
                    ]}
                    value={form.role as "Photographer" | "Operator"}
                    onChange={(v) => set("role", v)}
                  />
                </Field>
              )}

              {/* Time fields */}
              {showTimes && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Start">
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => set("start_time", e.target.value)}
                      className="h-12 w-full rounded-lg bg-muted px-3 text-base font-medium outline-none focus:ring-2 focus:ring-ring"
                    />
                  </Field>
                  <Field label="Finish">
                    <input
                      type="time"
                      value={form.finish_time}
                      onChange={(e) => set("finish_time", e.target.value)}
                      className="h-12 w-full rounded-lg bg-muted px-3 text-base font-medium outline-none focus:ring-2 focus:ring-ring"
                    />
                  </Field>
                </div>
              )}

              {/* Break stepper */}
              {showBreak && (
                <Field label="Break">
                  <BreakStepper
                    value={form.break_minutes}
                    onChange={(v) => set("break_minutes", v)}
                  />
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
                      className="pl-7 h-12 text-base"
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
          <div className="border-t px-4 py-4 flex gap-2">
            {entry && (
              <Button
                variant="destructive"
                size="icon"
                className="shrink-0"
                onClick={handleDelete}
                disabled={isDeleting || isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            <Button
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
