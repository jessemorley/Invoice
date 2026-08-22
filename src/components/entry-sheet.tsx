"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { Entry, Client, WorkflowRate, BillingType } from "@/lib/types";
import { createEntry, updateEntry, deleteEntry } from "@/app/(app)/entries/actions";
import { invalidate } from "@/lib/invalidate";
import type { EntryFormData } from "@/app/(app)/entries/actions";
import { calcDayRate, calcBatchBonus, calcHourly, calcManual, formatDuration } from "@/lib/entry-calc";
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
  batch_lines: { workflow: string; skus: number }[];
  brand: string;
  skus: number | null;
  label: string;
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
      // Entries saved before batch_lines existed carry their count in `skus` with a real
      // workflow name in workflow_type — rebuild a single line from those so they reopen
      // with the SKUs against the right workflow rather than a fabricated "Batch A".
      batch_lines: entry.batch_lines?.length
        ? entry.batch_lines
        : [{ workflow: entry.workflow_type && entry.workflow_type !== "Product" ? entry.workflow_type : "Batch A", skus: entry.skus ?? 0 }],
      brand: entry.brand ?? "",
      skus: entry.skus ?? null,
      label: entry.label || entry.description || "",
      description: entry.description ?? "",
      role: entry.role ?? client?.roles[0]?.name ?? "",
      start_time: entry.start_time?.slice(0, 5) ?? client.default_start_time?.slice(0, 5) ?? "09:00",
      finish_time: entry.finish_time?.slice(0, 5) ?? client.default_finish_time?.slice(0, 5) ?? "17:00",
      break_minutes: entry.break_minutes ?? 0,
      // manual entries store the line total in base_amount; recover the per-unit amount
      manual_amount:
        entry.billing_type === "manual" && entry.skus
          ? Math.round(((entry.base_amount ?? 0) / entry.skus) * 100) / 100
          : entry.base_amount ?? 0,
    };
  }
  return {
    client_id: "",
    date: TODAY,
    day_type: "full",
    workflow_type: "Apparel",
    batch_lines: [{ workflow: "Batch A", skus: 0 }],
    brand: "",
    skus: null,
    label: "",
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
    return { day_type: "full", workflow_type: "Apparel", batch_lines: [{ workflow: "Batch A", skus: 0 }] };
  }
  return { manual_amount: 0, skus: null };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label,
  endLabel,
  children,
}: {
  label: string;
  endLabel?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-baseline">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="justify-self-center">{endLabel}</span>
        <span />
      </div>
      {children}
    </div>
  );
}

// Progress toward the day's SKU bonus.
//
// Below KPI the bonus is flat zero, so a pure-dollar axis would leave most of a
// working day sitting at an empty bar and then jump. The axis is therefore split:
// up to KPI_MARK the fill tracks progress toward KPI, and beyond it the fill
// tracks bonus earned. The mark sits exactly on that seam — 100% of KPI, 0% of
// bonus — which is the point the day starts paying extra.
//
// One formula covers single and mixed lines alike, so adding a second batch never
// changes what the bar means. See `skuProgress` for the threshold itself.
// ponytail: two divs rather than a Progress dependency — the mark needs absolute
// positioning the primitive doesn't expose anyway.
const KPI_MARK = 86.2;

function SkuProgress({
  bonus,
  maxBonus,
  toKpi,
}: {
  bonus: number;
  maxBonus: number;
  toKpi: number;
}) {
  if (!maxBonus) return null;
  const bonusPct = Math.min(bonus / maxBonus, 1);
  const earning = bonus > 0;
  const atMax = bonus >= maxBonus;
  const fill = earning
    ? KPI_MARK + bonusPct * (100 - KPI_MARK)
    : Math.min(toKpi, 1) * KPI_MARK;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {earning ? "Bonus" : "To KPI"}
        </span>
        <span className="font-medium tabular-nums">
          {earning
            ? `${formatAUD(bonus)} / ${formatAUD(maxBonus)}`
            : `${Math.round(Math.min(toKpi, 1) * 100)}%`}
        </span>
      </div>
      <div className="relative h-1 w-full rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            atMax ? "bg-emerald-500" : earning ? "bg-primary" : "bg-muted-foreground/40"
          )}
          style={{ width: `${fill}%` }}
        />
        {/* KPI seam. Cut in the card colour, not a fixed line colour — the fill is
            near-black in light mode and near-white in dark, so only the card behind
            the bar contrasts with it in both themes. */}
        <div
          className="absolute inset-y-[-2px] w-0.5 rounded-full bg-card"
          style={{ left: `${KPI_MARK}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function SummaryPanel({
  client,
  calc,
  billingType,
  rawMins,
  progress,
}: {
  client: Client;
  calc: { base: number; bonus: number; superAmt: number; total: number } | null;
  billingType: BillingType;
  rawMins?: number;
  progress?: React.ReactNode;
}) {
  if (!calc) return null;

  // Split Base out from Total only when something can add to it — a bonus, or the
  // progress bar promising one. Otherwise Base and Total are the same number twice.
  const showBreakdown = calc.bonus > 0 || !!progress;

  return (
    <div className="px-4 py-1.5">
      <Card className="py-3 gap-0">
        <CardContent className="px-4 flex flex-col gap-1.5">
          {progress}
          {progress && <Separator />}
          {billingType === "hourly" && rawMins != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{formatDuration(rawMins)}</span>
            </div>
          )}
          {/* Base is always earned, so it shows whether or not the day cleared KPI.
              Bonus only joins it once there is one. */}
          {showBreakdown && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base</span>
              <span className="font-medium">{formatAUD(calc.base)}</span>
            </div>
          )}
          {/* No Bonus row when the bar is up — it already reads "$x / $max" above. */}
          {calc.bonus > 0 && !progress && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bonus</span>
              <span className="font-medium">{formatAUD(calc.bonus)}</span>
            </div>
          )}
          {((billingType === "hourly" && rawMins != null) || showBreakdown) && <Separator />}
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

const PRODUCT_WORKFLOWS = ["Batch A", "Batch B", "Batch C", "Batch D", "Flatlay"];
// Apparel days split across Apparel and Model Shot work; both reuse the batch_lines
// mechanism so the day's bonus caps once instead of per-entry.
const APPAREL_WORKFLOWS = ["Apparel", "Model Shot"];

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
  // date currently centered in the mobile date picker's row, for the month label — may lag form.date while scrolling
  const [visibleDate, setVisibleDate] = useState(form.date);

  useEffect(() => {
    if (!open) return;
    const ec = entry ? clients.find((c) => c.id === entry.client.id) ?? null : null;
    startTransition(() => {
      setSelectedClient(entry ? ec : null);
      setClientQuery("");
      const next = defaultForm(entry, ec);
      setForm(next);
      setVisibleDate(next.date);
      setError(null);
    });
    // `clients` intentionally excluded: a background refetch (e.g. tab focus) must not
    // clobber in-progress edits while the sheet is already open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, startTransition]);

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

  const apparelSubOptions = useMemo(
    () => APPAREL_WORKFLOWS.filter((w) => clientWorkflowSet.has(w)),
    [clientWorkflowSet]
  );

  const isProductWorkflow = form.workflow_type === "Product" || PRODUCT_WORKFLOWS.includes(form.workflow_type);
  // Anything that isn't Product or Own Brand sits under Apparel — including entries saved
  // as "Model Shot" back when it was a Product batch, which now belongs to Apparel.
  const topWorkflow: "Apparel" | "Product" | "Own Brand" = isProductWorkflow
    ? "Product"
    : form.workflow_type === "Own Brand"
    ? "Own Brand"
    : "Apparel";

  function handleTopWorkflow(v: string) {
    if (!v) return;
    // Product and Apparel share one batch_lines array, so switching between them seeds
    // the new mode's default line. Own Brand has no SKU fields and leaves them alone.
    // ponytail: a detour through the other mode discards its lines; separate arrays per
    // mode if that turns out to matter in practice.
    setForm((prev) => {
      if (v === "Own Brand") return { ...prev, workflow_type: v, skus: null };
      const belongs = v === "Product" ? PRODUCT_WORKFLOWS : APPAREL_WORKFLOWS;
      return {
        ...prev,
        workflow_type: v,
        skus: null,
        // rows come from subOptions, so only this mode's entered amounts need keeping
        batch_lines: prev.batch_lines.filter((l) => belongs.includes(l.workflow)),
      };
    });
  }

  const isProductMode = topWorkflow === "Product";
  const isApparelMode = topWorkflow === "Apparel";
  // workflows selectable on the lines for whichever mode is showing
  const subOptions = isProductMode ? productSubOptions : apparelSubOptions;
  // Own Brand has no SKU lines at all
  const usesBatchLines = (isProductMode || isApparelMode) && subOptions.length > 0;

  function skusFor(workflow: string) {
    return form.batch_lines.find((l) => l.workflow === workflow)?.skus ?? 0;
  }

  function setWorkflowSkus(workflow: string, skus: number) {
    setForm((prev) => {
      const existing = prev.batch_lines.some((l) => l.workflow === workflow);
      return {
        ...prev,
        batch_lines: existing
          ? prev.batch_lines.map((l) => (l.workflow === workflow ? { ...l, skus } : l))
          : [...prev.batch_lines, { workflow, skus }],
      };
    });
  }

  // only lines carrying SKUs are saved or costed — a blank row is not a batch
  const filledLines = useMemo(
    () => form.batch_lines.filter((l) => subOptions.includes(l.workflow) && l.skus > 0),
    [form.batch_lines, subOptions]
  );
  const isMultiBatch = usesBatchLines && filledLines.length > 1;

  const calcResult = useMemo(() => {
    if (!selectedClient) return null;
    if (billingType === "day_rate") {
      if (isMultiBatch) {
        return calcBatchBonus(selectedClient, filledLines, workflowRates, form.day_type);
      }
      // single line keeps the per-workflow KPI/incentive-rate formula
      const workflow = usesBatchLines ? filledLines[0]?.workflow ?? subOptions[0] : form.workflow_type;
      const skus = usesBatchLines ? filledLines[0]?.skus ?? null : form.skus;
      return calcDayRate(selectedClient, form.day_type, workflow, skus, workflowRates);
    }
    if (billingType === "hourly") {
      return calcHourly(selectedClient, form.start_time, form.finish_time, form.break_minutes, form.role);
    }
    return calcManual(form.manual_amount, form.skus, selectedClient);
  }, [selectedClient, billingType, form, workflowRates, usesBatchLines, isMultiBatch, filledLines, subOptions]);

  // Bar figures. The fill is driven by the bonus the summary already shows — never
  // a parallel SKU calculation, which would drift from the real formula the moment
  // two lines weight SKUs differently.
  const skuProgress = useMemo(() => {
    if (!selectedClient || billingType !== "day_rate" || !usesBatchLines) return null;
    if (form.day_type !== "full" || !calcResult || !filledLines.length) return null;
    const rated = filledLines
      .map((l) => ({
        line: l,
        rate: workflowRates.find(
          (r) => r.client_id === selectedClient.id && r.workflow === l.workflow
        ),
      }))
      .filter((x): x is { line: typeof x.line; rate: WorkflowRate } => !!x.rate)
      .filter((x) => x.rate.upper_limit_skus > 0);
    if (!rated.length) return null;
    const maxBonus = Math.max(...rated.map((x) => x.rate.max_bonus));
    if (!maxBonus) return null;

    // Progress toward the day's single shared KPI, summed the same way the bonus
    // measures it: each SKU is a fraction of its own workflow's KPI, so the shares
    // add up. Averaging them instead would read 84 Apparel + 1 Model Shot as half a
    // day when Apparel alone has already met the KPI.
    const toKpi = rated.reduce(
      (sum, x) => sum + (x.rate.kpi > 0 ? x.line.skus / x.rate.kpi : 0),
      0
    );

    return { bonus: calcResult.bonus, maxBonus, toKpi };
  }, [selectedClient, billingType, usesBatchLines, form.day_type, filledLines, workflowRates, calcResult]);

  function buildPayload(): EntryFormData {
    const calc = calcResult ?? { base: 0, bonus: 0, superAmt: 0, total: 0, hoursWorked: null };
    const batchTotalSkus = filledLines.reduce((sum, l) => sum + l.skus, 0);
    return {
      client_id: form.client_id,
      date: form.date,
      billing_type: billingType,
      day_type: billingType === "day_rate" ? form.day_type : null,
      // Product collapses its batch names into "Product"; Apparel saves the mode name
      // rather than form state, so a legacy "Model Shot" entry re-saves as "Apparel"
      // instead of printing a different invoice description than an identical fresh day.
      // Either way the per-workflow split lives in batch_lines.
      workflow_type: billingType === "day_rate" ? (isProductMode ? "Product" : isApparelMode ? "Apparel" : form.workflow_type) : null,
      batch_lines: billingType === "day_rate" && usesBatchLines ? filledLines : null,
      skus: usesBatchLines ? batchTotalSkus : (billingType === "day_rate" && needsSkus) || billingType === "manual" ? form.skus : null,
      brand: billingType === "day_rate" && needsBrand ? form.brand || null : null,
      label: showEntryLabel || billingType === "manual" ? form.label || null : null,
      description: showDescription ? form.description || null : null,
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
    if (billingType === "manual" && !form.label.trim()) {
      setError("Please enter an item");
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
  const needsSkus = billingType === "day_rate" && topWorkflow !== "Own Brand";
  const showEntryLabel = billingType === "hourly" && !!selectedClient?.entry_label;
  // manual entries reuse label as the "Item" label, matching hourly's label-as-label pattern
  const showItem = billingType === "manual";
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
              <AlertDialogAction variant="destructive" onClick={handleDelete}>Delete</AlertDialogAction>
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
              <Field
                label="Date"
                endLabel={
                  isMobile && (
                    <span className="text-sm text-muted-foreground">
                      {(() => {
                        const [y, m, d] = visibleDate.split("-").map(Number);
                        return new Date(y, m - 1, d).toLocaleDateString("en-AU", { month: "long" });
                      })()}
                    </span>
                  )
                }
              >
                {isMobile ? (
                  <DateCardPicker
                    value={form.date}
                    onChange={(v) => {
                      set("date", v);
                      setVisibleDate(v);
                    }}
                    onVisibleDateChange={setVisibleDate}
                  />
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

              {/* One row per workflow — name left, SKU field right. A row left blank
                  contributes nothing, so there is no add/remove step. */}
              {usesBatchLines && (
                <Field label="Batches">
                  <div className="rounded-lg border divide-y">
                    {subOptions.map((workflow) => (
                      <div
                        key={workflow}
                        className="flex items-center gap-3 pl-3 pr-1.5 py-1"
                      >
                        <span className="flex-1 text-sm">{workflow}</span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="text-sm w-20 h-8 border-0 bg-transparent text-right tabular-nums shadow-none focus-visible:ring-1 dark:bg-transparent"
                          value={skusFor(workflow) || ""}
                          onChange={(e) =>
                            setWorkflowSkus(
                              workflow,
                              e.target.value === "" ? 0 : parseInt(e.target.value, 10)
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              {/* Fallback SKU field — a day_rate workflow with no configured rate rows */}
              {needsSkus && !usesBatchLines && (
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

              {/* Custom entry label (hourly-with-label) / Item (manual) */}
              {(showEntryLabel || showItem) && (
                <Field label={showItem ? "Item" : selectedClient.entry_label!}>
                  <Input
                    className="text-sm"
                    value={form.label}
                    onChange={(e) => set("label", e.target.value)}
                    placeholder={showItem ? "Item" : selectedClient.entry_label!}
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
                    placeholder={showItem ? "Optional description" : "What did you work on?"}
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

              {/* Quantity (manual) */}
              {showItem && (
                <Field label="Quantity">
                  <Input
                    type="number"
                    min={1}
                    className="text-sm"
                    value={form.skus ?? ""}
                    onChange={(e) =>
                      set("skus", e.target.value === "" ? null : parseInt(e.target.value, 10))
                    }
                    placeholder="1"
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

          {/* Summary — the SKU bar rides inside it, above the money it explains */}
          {selectedClient && calcResult && (
            <SummaryPanel
              client={selectedClient}
              calc={calcResult}
              billingType={billingType}
              rawMins={rawMins}
              progress={
                skuProgress && (
                  <SkuProgress
                    bonus={skuProgress.bonus}
                    maxBonus={skuProgress.maxBonus}
                    toKpi={skuProgress.toKpi}
                  />
                )
              }
            />
          )}

        </div>

        {footerRow}
      </AdaptiveSheetContent>
    </AdaptiveSheet>
  );
}
