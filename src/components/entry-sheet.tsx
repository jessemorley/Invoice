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
import {
  AdaptiveSheet,
  AdaptiveSheetClose,
  AdaptiveSheetContent,
  AdaptiveSheetTitle,
} from "@/components/ui/adaptive-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Minus, Plus, Trash2, X } from "lucide-react";
import { ClientPicker, ClientSearchInput } from "@/components/client-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { DateCardPicker } from "@/components/ui/date-card-picker";
import { SegmentedControl } from "@/components/ui/segmented-control";

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
      role: entry.role ?? client?.roles[0]?.name ?? "",
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
    role: "",
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
      role: client.roles[0]?.name ?? "",
    };
  }
  if (client.billing_type === "day_rate") {
    return { day_type: "full", workflow_type: "Apparel" };
  }
  return { manual_amount: 0 };
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
          {calc.bonus > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base</span>
                <span className="font-medium">{formatAUD(calc.base)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bonus</span>
                <span className="font-medium">{formatAUD(calc.bonus)}</span>
              </div>
            </>
          )}
          {((billingType === "hourly" && rawMins != null) || calc.bonus > 0) && <Separator />}
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span>{formatAUD(calc.base + calc.bonus)}</span>
          </div>
          {client.pays_super && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Super</span>
              <span className="font-medium">{formatAUD(calc.superAmt)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PRODUCT_WORKFLOWS = ["Batch A", "Batch B", "Batch C", "Batch D", "Flatlay", "Model Shot"];

export function EntrySheet({
  open,
  onOpenChangeAction,
  entry,
  clients,
  workflowRates,
}: {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  entry: Entry | null;
  clients: Client[];
  workflowRates: WorkflowRate[];
}) {
  const isMobile = useIsMobile();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const editClient = entry ? clients.find((c) => c.id === entry.client.id) ?? null : null;

  const [selectedClient, setSelectedClient] = useState<Client | null>(
    entry ? editClient : null
  );
  const [clientQuery, setClientQuery] = useState("");
  const [form, setForm] = useState<FormState>(() => defaultForm(entry, editClient));

  useEffect(() => {
    if (!open) return;
    const ec = entry ? clients.find((c) => c.id === entry.client.id) ?? null : null;
    startTransition(() => {
      setSelectedClient(entry ? ec : null);
      setClientQuery("");
      setForm(defaultForm(entry, ec));
      setError(null);
    });
  }, [open, entry, clients, startTransition]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSelectClient(client: Client) {
    setSelectedClient(client);
    setClientQuery("");
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
      role: showRole ? form.role || null : null,
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
    if (showRole && !form.role) {
      setError("Please select a role");
      return;
    }
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
        onOpenChangeAction(false);
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
        onOpenChangeAction(false);
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
  const showRole = billingType === "hourly" && (selectedClient?.roles?.length ?? 0) > 0;
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
    : "Add entry";

  // On mobile the drawer has no fixed header: a small centered title scrolls
  // with the content, and dismissal is swipe-down/overlay instead of an X.
  const headerRow = (
    <div className={cn("flex flex-row items-center gap-1.5 px-4", isMobile ? "py-1" : "h-14 border-b")}>
      {!entry && selectedClient && (
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setSelectedClient(null)}>
          <ChevronLeft className="size-4" />
        </Button>
      )}
      {!selectedClient ? (
        <ClientSearchInput
          placeholder="New entry"
          value={clientQuery}
          onChange={setClientQuery}
        />
      ) : (
        <AdaptiveSheetTitle className={cn("flex-1", isMobile ? "text-sm text-center" : "text-lg")}>
          {title}
        </AdaptiveSheetTitle>
      )}
      {isMobile ? (
        !entry && selectedClient && <div className="size-8 shrink-0" aria-hidden />
      ) : (
        <AdaptiveSheetClose asChild>
          <Button variant="ghost" size="icon" className="shrink-0 size-8">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </AdaptiveSheetClose>
      )}
    </div>
  );

  const footerRow = selectedClient && (
    <div className="px-4 py-3 flex gap-2">
      {entry && (
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <Button
            variant="destructive"
            size="icon-lg"
            className="h-9 shrink-0 rounded-2xl"
            onClick={() => (entry.invoice_id ? handleDelete() : setConfirmDeleteOpen(true))}
            disabled={isDeleting || isPending}
          >
            <Trash2 className="size-4" />
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the entry. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <Button
        size="lg"
        variant="outline"
        className="h-9 flex-1 rounded-2xl"
        onClick={() => onOpenChangeAction(false)}
        disabled={isPending || isDeleting}
      >
        Cancel
      </Button>
      <Button
        size="lg"
        className="h-9 flex-1 rounded-2xl"
        onClick={handleSubmit}
        disabled={isPending || isDeleting}
      >
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );

  return (
    <AdaptiveSheet open={open} onOpenChange={onOpenChangeAction}>
      <AdaptiveSheetContent side="right" className="flex flex-col gap-0 p-0 w-full md:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        {!isMobile && headerRow}

        <div className="flex-1 overflow-y-auto">
          {isMobile && headerRow}
          {!selectedClient ? (
            <ClientPicker clients={clients} query={clientQuery} onSelectAction={handleSelectClient} />
          ) : (
            <div className="flex flex-col gap-4 px-4 py-4">
              {/* Date */}
              <Field label="Date">
                {isMobile ? (
                  <DateCardPicker value={form.date} onChange={(v) => set("date", v)} />
                ) : (
                  <DateTimeInput type="date" value={form.date} onChange={(v) => set("date", v)} />
                )}
              </Field>

              {/* Day type */}
              {showDayType && (
                <Field label="Day type">
                  <SegmentedControl
                    value={form.day_type}
                    onValueChange={(v) => set("day_type", v)}
                    options={[
                      { value: "full", label: "Full day" },
                      { value: "half", label: "Half day" },
                    ]}
                  />
                </Field>
              )}

              {/* Workflow */}
              {showWorkflow && (
                <Field label="Workflow">
                  <SegmentedControl
                    value={topWorkflow}
                    onValueChange={handleTopWorkflow}
                    options={[
                      { value: "Apparel", label: "Apparel" },
                      { value: "Product", label: "Product" },
                      { value: "Own Brand", label: "Own Brand" },
                    ]}
                  />
                  {topWorkflow === "Product" && productSubOptions.length > 0 && (
                    <SegmentedControl
                      value={form.workflow_type}
                      onValueChange={(v) => set("workflow_type", v)}
                      options={productSubOptions.map((opt) => ({ value: opt, label: opt }))}
                      className="mt-1"
                      itemClassName="text-xs"
                    />
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
                    className="text-sm min-h-9 py-1.5"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="What did you work on?"
                    rows={1}
                  />
                </Field>
              )}

              {/* Role */}
              {showRole && (
                <Field label="Role">
                  <SegmentedControl
                    value={form.role}
                    onValueChange={(v) => set("role", v)}
                    options={selectedClient!.roles.map((r) => ({ value: r.name, label: r.name }))}
                  />
                </Field>
              )}

              {/* Time fields */}
              {showTimes && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start">
                    <DateTimeInput type="time" value={form.start_time} onChange={(v) => set("start_time", v)} />
                  </Field>
                  <Field label="Finish">
                    <DateTimeInput type="time" value={form.finish_time} onChange={(v) => set("finish_time", v)} />
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
                      className="rounded-lg"
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
                      className="rounded-lg"
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

          {/* Summary */}
          {selectedClient && calcResult && (
            <SummaryPanel
              client={selectedClient}
              calc={calcResult}
              billingType={billingType}
              rawMins={rawMins}
            />
          )}

        </div>

        {footerRow}
      </AdaptiveSheetContent>
    </AdaptiveSheet>
  );
}
