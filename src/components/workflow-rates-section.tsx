"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createWorkflowRate,
  updateWorkflowRate,
  deleteWorkflowRate,
  type WorkflowRate,
  type WorkflowRatePayload,
} from "@/app/(app)/clients/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type RateFormState = {
  workflow: string;
  kpi: string;
  upper_limit_skus: string;
  incentive_rate_per_sku: string;
  max_bonus: string;
  is_flat_bonus: boolean;
};

type EditableRate =
  | { kind: "saved"; data: WorkflowRate; form: RateFormState; dirty: boolean }
  | { kind: "new"; tempId: string; form: RateFormState };

// ── Helpers ───────────────────────────────────────────────────────────────────

function rateToForm(rate: WorkflowRate): RateFormState {
  return {
    workflow: rate.workflow,
    kpi: String(rate.kpi),
    upper_limit_skus: String(rate.upper_limit_skus),
    incentive_rate_per_sku: String(rate.incentive_rate_per_sku),
    max_bonus: String(rate.max_bonus),
    is_flat_bonus: rate.is_flat_bonus,
  };
}

function blankRateForm(): RateFormState {
  return {
    workflow: "",
    kpi: "",
    upper_limit_skus: "",
    incentive_rate_per_sku: "",
    max_bonus: "",
    is_flat_bonus: false,
  };
}

function formToPayload(form: RateFormState): WorkflowRatePayload {
  return {
    workflow: form.workflow.trim(),
    kpi: form.is_flat_bonus ? 0 : parseFloat(form.kpi) || 0,
    upper_limit_skus: form.is_flat_bonus ? 0 : parseFloat(form.upper_limit_skus) || 0,
    incentive_rate_per_sku: form.is_flat_bonus ? 0 : parseFloat(form.incentive_rate_per_sku) || 0,
    max_bonus: parseFloat(form.max_bonus) || 0,
    is_flat_bonus: form.is_flat_bonus,
  };
}

function rateTabId(rate: EditableRate): string {
  return rate.kind === "saved" ? rate.data.id : rate.tempId;
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ── Rate tab content ──────────────────────────────────────────────────────────

function RateTabContent({
  rate,
  clientId,
  onSaved,
  onDeleted,
  onCancelled,
  onClose,
}: {
  rate: EditableRate;
  clientId: string;
  onSaved: (updated: WorkflowRate, tempId?: string) => void;
  onDeleted: (id: string) => void;
  onCancelled: (tempId: string) => void;
  onClose: () => void;
}) {
  const isNew = rate.kind === "new";
  const savedData = rate.kind === "saved" ? rate.data : null;
  const [form, setForm] = useState<RateFormState>(rate.form);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync form when the saved record is updated externally (e.g. after save roundtrip)
  useEffect(() => {
    if (savedData) setForm(rateToForm(savedData));
  }, [savedData]);

  function setField<K extends keyof RateFormState>(key: K, value: RateFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleCancel() {
    if (isNew) {
      onCancelled(rate.tempId);
    } else {
      onClose();
    }
  }

  function handleSave() {
    if (!form.workflow.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const payload = formToPayload(form);
        if (isNew) {
          const created = await createWorkflowRate(clientId, payload);
          onSaved(created, rate.tempId);
        } else {
          await updateWorkflowRate(savedData!.id, clientId, payload);
          onSaved({ ...savedData!, ...payload });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    if (!savedData) return;
    const id = savedData.id;
    startTransition(async () => {
      try {
        await deleteWorkflowRate(id, clientId);
        onDeleted(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const canSave = form.workflow.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Workflow Name">
        <Input
          value={form.workflow}
          onChange={(e) => setField("workflow", e.target.value)}
          placeholder="e.g. Apparel"
          disabled={isPending}
        />
      </Field>

      <div className="flex items-center justify-between text-sm">
        <span>Flat Bonus</span>
        <Switch
          checked={form.is_flat_bonus}
          onCheckedChange={(v) => setField("is_flat_bonus", v)}
          disabled={isPending}
        />
      </div>

      {!form.is_flat_bonus && (
        <>
          <Field label="KPI (SKUs)">
            <Input
              type="number"
              value={form.kpi}
              onChange={(e) => setField("kpi", e.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field label="Upper Limit (SKUs)">
            <Input
              type="number"
              value={form.upper_limit_skus}
              onChange={(e) => setField("upper_limit_skus", e.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field label="Incentive per SKU ($)">
            <Input
              type="number"
              value={form.incentive_rate_per_sku}
              onChange={(e) => setField("incentive_rate_per_sku", e.target.value)}
              disabled={isPending}
            />
          </Field>
        </>
      )}

      <Field label="Max Bonus ($)">
        <Input
          type="number"
          value={form.max_bonus}
          onChange={(e) => setField("max_bonus", e.target.value)}
          disabled={isPending}
        />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={handleCancel} disabled={isPending}>
          Cancel
        </Button>
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive" disabled={isPending}>
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete workflow rate?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the &ldquo;{form.workflow}&rdquo; workflow rate.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button type="button" size="sm" className="flex-1" onClick={handleSave} disabled={isPending || !canSave}>
          {isPending ? <Spinner className="size-4" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function WorkflowRatesSection({
  clientId,
  initialRates,
  onClose,
}: {
  clientId: string;
  initialRates: WorkflowRate[];
  onClose: () => void;
}) {
  const [rates, setRates] = useState<EditableRate[]>(
    initialRates.map((r) => ({ kind: "saved", data: r, form: rateToForm(r), dirty: false }))
  );
  const [activeTab, setActiveTab] = useState<string>(
    initialRates.length > 0 ? initialRates[0].id : ""
  );

  function handleAdd() {
    const tempId = `new-${Date.now()}`;
    setRates((prev) => [...prev, { kind: "new", tempId, form: blankRateForm() }]);
    setActiveTab(tempId);
  }

  function handleSaved(updated: WorkflowRate, tempId?: string) {
    setRates((prev) =>
      prev.map((r) => {
        // new rate just created — match by tempId, not activeTab snapshot
        if (r.kind === "new" && r.tempId === tempId) {
          return { kind: "saved", data: updated, form: rateToForm(updated), dirty: false };
        }
        // existing rate updated
        if (r.kind === "saved" && r.data.id === updated.id) {
          return { kind: "saved", data: updated, form: rateToForm(updated), dirty: false };
        }
        return r;
      })
    );
    setActiveTab(updated.id);
  }

  function handleDeleted(id: string) {
    setRates((prev) => {
      const remaining = prev.filter((r) => !(r.kind === "saved" && r.data.id === id));
      const first = remaining[0];
      setActiveTab(first ? rateTabId(first) : "");
      return remaining;
    });
  }

  function handleCancelled(tempId: string) {
    setRates((prev) => {
      const remaining = prev.filter((r) => !(r.kind === "new" && r.tempId === tempId));
      const first = remaining[0];
      setActiveTab(first ? rateTabId(first) : "");
      return remaining;
    });
  }

  if (rates.length === 0) {
    return (
      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full gap-1.5">
        <Plus className="size-4" />
        Add workflow rate
      </Button>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => {
      // Discard unsaved new tab when switching away
      setRates((prev) => prev.filter((r) => r.kind === "saved" || rateTabId(r) === v));
      setActiveTab(v);
    }}>
      <div className="flex items-center gap-1 min-w-0">
        <TabsList className="flex-1 overflow-x-auto overflow-y-hidden justify-start gap-1 bg-transparent p-0 flex-nowrap">
          {rates.map((rate) => (
            <TabsTrigger
              key={rateTabId(rate)}
              value={rateTabId(rate)}
              className="rounded-md bg-muted data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-1.5"
            >
              {rate.form.workflow.trim() || <span className="text-muted-foreground italic">New</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleAdd} title="Add workflow rate">
          <Plus className="size-4" />
        </Button>
      </div>

      {rates.map((rate) => (
        <TabsContent key={rateTabId(rate)} value={rateTabId(rate)} className="mt-4">
          <RateTabContent
            key={rateTabId(rate)}
            rate={rate}
            clientId={clientId}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onCancelled={handleCancelled}
            onClose={onClose}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
