"use client";

import { useTransition, useEffect, useState } from "react";
import { useActiveView } from "@/components/active-view-context";
import type { Client, BillingType } from "@/lib/types";
import { formatAUD } from "@/lib/format";
import {
  updateClientColor,
  fetchClientInvoices,
  updateShowSuperOnInvoice,
  createClientAction,
  updateClientAction,
  deleteClientAction,
  fetchWorkflowRates,
  fetchRolesWithEntries,
  type RecentInvoice,
  type ClientFormData,
  type WorkflowRate,
} from "@/app/(app)/clients/actions";
import { WorkflowRatesSection } from "@/components/workflow-rates-section";
import { invalidate } from "@/lib/invalidate";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Spinner } from "@/components/ui/spinner";
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { ClientSquircle } from "@/components/client-squircle";

const CLIENT_COLOR_FALLBACK = "#9ca3af";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#10b981", "#64748b",
];

const BILLING_LABEL: Record<string, string> = {
  day_rate: "Day rate",
  hourly: "Hourly",
  manual: "Manual",
};

// ── Color squircle (detail view only) ────────────────────────────────────────

function ColorSquircle({ clientId, name, current }: { clientId: string; name: string; current: string | null }) {
  const [isPending, startTransition] = useTransition();
  const active = current ?? CLIENT_COLOR_FALLBACK;

  function pick(color: string) {
    startTransition(async () => { await updateClientColor(clientId, color); invalidate("clients", "entries"); });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-[30%]"
          aria-label="Change client colour"
        >
          <ClientSquircle name={name} color={active} className="size-9" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3" align="start">
        <div className={`flex gap-1.5 flex-wrap${isPending ? " opacity-60 pointer-events-none" : ""}`}>
          {PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => pick(color)}
              className="size-6 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                backgroundColor: color,
                borderColor: active === color ? "white" : "transparent",
                boxShadow: active === color ? `0 0 0 2px ${color}` : undefined,
              }}
              aria-label={color}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Detail view sub-components ────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = { draft: "Draft", issued: "Issued", paid: "Paid" };
const STATUS_VARIANT: Record<string, "secondary" | "outline" | "default"> = {
  draft: "secondary", issued: "outline", paid: "default",
};

function RecentInvoiceRow({ invoice }: { invoice: RecentInvoice }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex-1 min-w-0">
        <p className="font-medium">{invoice.number}</p>
        <p className="text-xs text-muted-foreground">
          {invoice.issued_date ? new Date(invoice.issued_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge variant={STATUS_VARIANT[invoice.status] ?? "secondary"} className="text-xs font-normal">
          {STATUS_LABEL[invoice.status] ?? invoice.status}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">{formatAUD(invoice.total)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function SuperOnInvoiceToggle({ clientId, value }: { clientId: string; value: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex justify-between items-center gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">Show super on invoice</span>
      <Switch
        checked={value}
        disabled={isPending}
        onCheckedChange={(checked) => {
          startTransition(async () => { await updateShowSuperOnInvoice(clientId, checked); invalidate("clients"); });
        }}
      />
    </div>
  );
}

// ── Form field helpers ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function NumericInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="0.01"
      className="text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "0.00"}
    />
  );
}

// ── Form state ────────────────────────────────────────────────────────────────

type RoleRow = { id?: string; name: string; rate: string };

type FormState = {
  name: string;
  billing_type: BillingType;
  rate_full_day: string;
  rate_half_day: string;
  rate_hourly: string;
  default_start_time: string;
  default_finish_time: string;
  entry_label: string;
  roles: RoleRow[];
  pays_super: boolean;
  super_rate: string;
  show_super_on_invoice: boolean;
  invoice_frequency: "weekly" | "per_job";
  contact_name: string;
  email: string;
  address: string;
  suburb: string;
  abn: string;
  is_active: boolean;
};

function blankForm(): FormState {
  return {
    name: "",
    billing_type: "manual",
    rate_full_day: "",
    rate_half_day: "",
    rate_hourly: "",
    default_start_time: "",
    default_finish_time: "",
    entry_label: "",
    roles: [],
    pays_super: false,
    super_rate: "0.12",
    show_super_on_invoice: true,
    invoice_frequency: "weekly",
    contact_name: "",
    email: "",
    address: "",
    suburb: "",
    abn: "",
    is_active: true,
  };
}

function clientToForm(client: Client): FormState {
  return {
    name: client.name,
    billing_type: client.billing_type,
    rate_full_day: client.rate_full_day != null ? String(client.rate_full_day) : "",
    rate_half_day: client.rate_half_day != null ? String(client.rate_half_day) : "",
    rate_hourly: client.rate_hourly != null ? String(client.rate_hourly) : "",
    default_start_time: client.default_start_time?.slice(0, 5) ?? "",
    default_finish_time: client.default_finish_time?.slice(0, 5) ?? "",
    entry_label: client.entry_label ?? "",
    roles: client.roles.map((r) => ({ id: r.id, name: r.name, rate: String(r.rate) })),
    pays_super: client.pays_super,
    super_rate: String(client.super_rate),
    show_super_on_invoice: client.show_super_on_invoice,
    invoice_frequency: client.invoice_frequency,
    contact_name: client.contact_name ?? "",
    email: client.email,
    address: client.address,
    suburb: client.suburb,
    abn: client.abn ?? "",
    is_active: client.is_active,
  };
}

function formToPayload(f: FormState): ClientFormData {
  const base: ClientFormData = {
    name: f.name.trim(),
    billing_type: f.billing_type,
    rate_full_day: null,
    rate_half_day: null,
    rate_hourly: null,
    default_start_time: null,
    default_finish_time: null,
    entry_label: null,
    roles: f.roles
      .filter((r) => r.name.trim())
      .map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), rate: r.rate !== "" ? parseFloat(r.rate) : 0 })),
    pays_super: f.pays_super,
    super_rate: f.super_rate !== "" ? parseFloat(f.super_rate) : 0.12,
    show_super_on_invoice: f.show_super_on_invoice,
    invoice_frequency: f.invoice_frequency,
    contact_name: f.contact_name.trim() || null,
    email: f.email.trim(),
    address: f.address.trim(),
    suburb: f.suburb.trim(),
    abn: f.abn.trim() || null,
    is_active: f.is_active,
  };

  if (f.billing_type === "day_rate") {
    base.rate_full_day = f.rate_full_day !== "" ? parseFloat(f.rate_full_day) : null;
    base.rate_half_day = f.rate_half_day !== "" ? parseFloat(f.rate_half_day) : null;
  } else if (f.billing_type === "hourly") {
    base.rate_hourly = f.rate_hourly !== "" ? parseFloat(f.rate_hourly) : null;
    base.default_start_time = f.default_start_time || null;
    base.default_finish_time = f.default_finish_time || null;
    base.entry_label = f.entry_label.trim() || null;
  }

  return base;
}

// ── Form view ─────────────────────────────────────────────────────────────────

function ClientForm({
  initial,
  clientId,
  isNew,
  onClose,
  onSaved,
}: {
  initial: FormState;
  clientId: string | null;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [touchedRoles, setTouchedRoles] = useState<Set<number>>(new Set());
  const [rolesWithEntries, setRolesWithEntries] = useState<Set<string>>(new Set());
  const [lockedRoleError, setLockedRoleError] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    fetchRolesWithEntries(clientId).then(setRolesWithEntries).catch(() => {});
  }, [clientId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const hasDuplicateRoles = (() => {
    const names = form.roles.map((r) => r.name.trim()).filter(Boolean);
    return names.length !== new Set(names).size;
  })();

  function handleSave() {
    if (!form.name.trim() || hasDuplicateRoles) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        const payload = formToPayload(form);
        if (isNew) {
          await createClientAction(payload);
        } else {
          await updateClientAction(clientId!, payload);
        }
        invalidate("clients", "entries");
        onSaved();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteClientAction(clientId!);
      if (result.ok) {
        invalidate("clients");
        onClose();
      } else {
        const parts = [];
        if (result.entryCount > 0) parts.push(`${result.entryCount} ${result.entryCount === 1 ? "entry" : "entries"}`);
        if (result.invoiceCount > 0) parts.push(`${result.invoiceCount} ${result.invoiceCount === 1 ? "invoice" : "invoices"}`);
        setDeleteError(`This client has ${parts.join(" and ")}. Mark as inactive instead.`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-0 h-full">
      <div className="flex flex-row items-center gap-1.5 px-6 py-5 border-b">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <SheetTitle>{isNew ? "Add Client" : "Edit Client"}</SheetTitle>
          <SheetDescription>{isNew ? "Add a new client" : "Update client details"}</SheetDescription>
        </div>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" className="shrink-0 self-center size-8">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </SheetClose>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Name">
              <Input className="text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Client name" />
            </Field>
            {detailsOpen && (
              <>
                <Field label="Contact Name">
                  <Input className="text-sm" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input className="text-sm" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Address">
                  <Input className="text-sm" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </Field>
                <Field label="Suburb">
                  <Input className="text-sm" value={form.suburb} onChange={(e) => set("suburb", e.target.value)} />
                </Field>
                <Field label="ABN">
                  <Input className="text-sm" value={form.abn} onChange={(e) => set("abn", e.target.value)} />
                </Field>
              </>
            )}
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ChevronRight className={`size-4 transition-transform ${detailsOpen ? "rotate-90" : ""}`} />
              {detailsOpen ? "Less" : "More details"}
            </button>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Billing Type">
              <ToggleGroup
                type="single"
                size="sm"
                value={form.billing_type}
                onValueChange={(v) => v && set("billing_type", v as BillingType)}
                className="w-full rounded-lg border border-input p-1 dark:bg-input/30"
              >
                <ToggleGroupItem value="manual" className="flex-1 rounded-md! text-muted-foreground hover:bg-transparent! hover:text-foreground data-[state=on]:text-foreground">Manual</ToggleGroupItem>
                <ToggleGroupItem value="day_rate" className="flex-1 rounded-md! text-muted-foreground hover:bg-transparent! hover:text-foreground data-[state=on]:text-foreground">Day Rate</ToggleGroupItem>
                <ToggleGroupItem value="hourly" className="flex-1 rounded-md! text-muted-foreground hover:bg-transparent! hover:text-foreground data-[state=on]:text-foreground">Hourly</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field label="Invoice Frequency">
              <ToggleGroup
                type="single"
                size="sm"
                value={form.invoice_frequency}
                onValueChange={(v) => v && set("invoice_frequency", v as "weekly" | "per_job")}
                className="w-full rounded-lg border border-input p-1 dark:bg-input/30"
              >
                <ToggleGroupItem value="weekly" className="flex-1 rounded-md! text-muted-foreground hover:bg-transparent! hover:text-foreground data-[state=on]:text-foreground">Weekly</ToggleGroupItem>
                <ToggleGroupItem value="per_job" className="flex-1 rounded-md! text-muted-foreground hover:bg-transparent! hover:text-foreground data-[state=on]:text-foreground">Per Job</ToggleGroupItem>
              </ToggleGroup>
            </Field>

            {/* Day rate fields */}
            {form.billing_type === "day_rate" && (
              <div className="flex gap-3">
                <Field label="Full Day ($)">
                  <NumericInput value={form.rate_full_day} onChange={(v) => set("rate_full_day", v)} />
                </Field>
                <Field label="Half Day ($)">
                  <NumericInput value={form.rate_half_day} onChange={(v) => set("rate_half_day", v)} />
                </Field>
              </div>
            )}

            {/* Hourly fields */}
            {form.billing_type === "hourly" && (
              <>
                {form.roles.length === 0 && (
                  <Field label="Hourly Rate ($)">
                    <NumericInput value={form.rate_hourly} onChange={(v) => set("rate_hourly", v)} />
                  </Field>
                )}

                {/* Roles */}
                {(() => {
                  const nameCounts = form.roles.reduce<Record<string, number>>((acc, r) => {
                    const n = r.name.trim();
                    if (n) acc[n] = (acc[n] ?? 0) + 1;
                    return acc;
                  }, {});
                  return (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">Roles</label>
                      {form.roles.map((role, i) => (
                        <div key={role.id ?? `new-${i}`} className="flex flex-col gap-1">
                          <div className="flex gap-2 items-center">
                            <Input
                              className={`flex-1 min-w-0 text-sm${touchedRoles.has(i) && (nameCounts[role.name.trim()] ?? 0) > 1 ? " border-destructive focus-visible:ring-destructive" : ""}`}
                              placeholder="Role name"
                              value={role.name}
                              onChange={(e) => {
                                const updated = form.roles.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r);
                                set("roles", updated);
                              }}
                              onBlur={() => setTouchedRoles((prev) => new Set(prev).add(i))}
                            />
                            <div className="w-24 shrink-0 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                placeholder="0.00"
                                className="pl-6 text-sm"
                                value={role.rate}
                                onChange={(e) => {
                                  const updated = form.roles.map((r, idx) => idx === i ? { ...r, rate: e.target.value } : r);
                                  set("roles", updated);
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              onClick={() => {
                                if (rolesWithEntries.has(role.name.trim())) {
                                  setLockedRoleError(i);
                                } else {
                                  setLockedRoleError(null);
                                  set("roles", form.roles.filter((_, idx) => idx !== i));
                                  setTouchedRoles(new Set());
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          {lockedRoleError === i && (
                            <p className="text-xs text-destructive pl-1">Has entries attached — reassign or delete them first</p>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => set("roles", [...form.roles, { name: "", rate: "" }])}
                      >
                        + Add role
                      </Button>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Default Start">
                    <div className="h-9 rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 flex items-center">
                      <input
                        type="time"
                        className="w-full bg-transparent outline-none text-sm text-foreground"
                        value={form.default_start_time}
                        onChange={(e) => set("default_start_time", e.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="Default Finish">
                    <div className="h-9 rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 flex items-center">
                      <input
                        type="time"
                        className="w-full bg-transparent outline-none text-sm text-foreground"
                        value={form.default_finish_time}
                        onChange={(e) => set("default_finish_time", e.target.value)}
                      />
                    </div>
                  </Field>
                </div>
                <Field label="Entry Label">
                  <Input
                    className="text-sm"
                    value={form.entry_label}
                    onChange={(e) => set("entry_label", e.target.value)}
                    placeholder="e.g. Shoot Client"
                  />
                </Field>
              </>
            )}
          </CardContent>
        </Card>

        {/* Super */}
        <Card>
          <CardHeader>
            <CardTitle>Superannuation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm">
              <span>Pays Super</span>
              <Switch checked={form.pays_super} onCheckedChange={(v) => set("pays_super", v)} />
            </div>
            {form.pays_super && (
              <>
                <Field label="Super Rate (e.g. 0.12)">
                  <NumericInput value={form.super_rate} onChange={(v) => set("super_rate", v)} placeholder="0.12" />
                </Field>
                <div className="flex items-center justify-between text-sm">
                  <span>Show Super on Invoice</span>
                  <Switch checked={form.show_super_on_invoice} onCheckedChange={(v) => set("show_super_on_invoice", v)} />
                </div>
              </>
            )}
          </CardContent>
        </Card>



        {/* Active (edit only) */}
        {!isNew && (
          <Card>
            <CardContent className="flex items-center justify-between text-sm pt-6">
              <span>Active</span>
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </CardContent>
          </Card>
        )}

        {/* Delete (edit only) */}
        {!isNew && (
          <>
            {deleteError ? (
              <p className="text-sm text-destructive">{deleteError}</p>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeleting} className="w-full">
                    {isDeleting ? <Spinner className="size-4" /> : "Delete Client"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete client?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone. The client and their workflow rates will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </div>

      <div className="px-6 py-4 border-t flex flex-col gap-3">
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => { setForm(initial); onClose(); }} disabled={isPending}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={isPending || !form.name.trim() || hasDuplicateRoles}>
            {isPending ? <Spinner className="size-4" /> : isNew ? "Create Client" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function ClientDetail({
  client,
  onEdit,
  onClose,
}: {
  client: Client;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { setView } = useActiveView();
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchClientInvoices(client.id)
      .then((data) => { if (!cancelled) setRecentInvoices(data); })
      .catch(() => { if (!cancelled) setRecentInvoices([]); });
    return () => { cancelled = true; };
  }, [client.id]);

  const primaryRate = (() => {
    if (client.billing_type === "day_rate") {
      const parts = [];
      if (client.rate_full_day) parts.push(`${formatAUD(client.rate_full_day)} full`);
      if (client.rate_half_day) parts.push(`${formatAUD(client.rate_half_day)} half`);
      return parts.join(" / ") || "—";
    }
    if (client.billing_type === "hourly") {
      return client.rate_hourly ? `${formatAUD(client.rate_hourly)}/hr` : "—";
    }
    return "Manual";
  })();

  return (
    <>
      <div className="flex flex-row items-center gap-1.5 px-6 py-5 border-b">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ColorSquircle clientId={client.id} name={client.name} current={client.color} />
            <SheetTitle className="truncate">{client.name}</SheetTitle>
            {!client.is_active && (
              <span className="shrink-0 text-xs text-muted-foreground border rounded-full px-2 py-0.5">Inactive</span>
            )}
          </div>
          <SheetDescription>{BILLING_LABEL[client.billing_type]}</SheetDescription>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 size-8 self-center" onClick={onEdit} aria-label="Edit client">
          <Pencil className="size-4" />
        </Button>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" className="shrink-0 self-center size-8">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </SheetClose>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
        <Section title="Contact">
          {client.contact_name && <Row label="Contact" value={client.contact_name} />}
          {client.email && <Row label="Email" value={<a href={`mailto:${client.email}`} className="underline underline-offset-2">{client.email}</a>} />}
          {(client.address || client.suburb) && (
            <Row label="Address" value={[client.address, client.suburb].filter(Boolean).join(", ")} />
          )}
          {client.abn && <Row label="ABN" value={client.abn} />}
        </Section>

        <Separator />

        <Section title="Billing Rates">
          <Row label="Type" value={BILLING_LABEL[client.billing_type]} />
          {client.roles.length === 0 && <Row label="Rate" value={primaryRate} />}
          {client.roles.length > 0 && (
            <div className="flex flex-col gap-3 pl-3">
              {client.roles.map((r) => (
                <div key={r.id} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground shrink-0">{r.name}</span>
                  <span className="text-right">{formatAUD(r.rate)}/hr</span>
                </div>
              ))}
            </div>
          )}
          <Row label="Invoice frequency" value={client.invoice_frequency === "weekly" ? "Weekly" : "Per job"} />
          {client.pays_super && (
            <Row label="Super" value={`${(client.super_rate * 100).toFixed(1)}%`} />
          )}
          {client.pays_super && (
            <SuperOnInvoiceToggle clientId={client.id} value={client.show_super_on_invoice} />
          )}
        </Section>

        {client.entry_label && (
          <>
            <Separator />
            <Section title="Settings">
              <Row label="Entry label" value={client.entry_label} />
            </Section>
          </>
        )}

        {client.notes && (
          <>
            <Separator />
            <Section title="Notes">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
            </Section>
          </>
        )}

        <Separator />

        <Section title="Recent Invoices">
          {recentInvoices === null ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recentInvoices.map((inv) => (
                <RecentInvoiceRow key={inv.id} invoice={inv} />
              ))}
              {client.invoice_count > 5 && (
                <button
                  onClick={() => { onClose(); setView("invoices"); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 text-left"
                >
                  View all {client.invoice_count} invoices →
                </button>
              )}
            </div>
          )}
        </Section>

        <Separator />

        <WorkflowRatesSheet clientId={client.id} />
      </div>
    </>
  );
}

// ── Workflow rates sheet ──────────────────────────────────────────────────────

function WorkflowRatesSheet({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState<WorkflowRate[] | null>(null);

  useEffect(() => {
    if (!open) { setRates(null); return; }
    fetchWorkflowRates(clientId).then(setRates).catch(() => setRates([]));
  }, [open, clientId]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-between w-full text-sm py-0.5 hover:text-foreground text-muted-foreground transition-colors group"
      >
        <span className="text-foreground">Workflow Rates</span>
        <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <div className="flex flex-row items-center gap-1.5 px-6 py-5 border-b">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <SheetTitle>Workflow Rates</SheetTitle>
              <SheetDescription>Per-client KPI bonus structures</SheetDescription>
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="shrink-0 self-center size-8">
                <X className="size-5" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {rates === null ? (
              <div className="flex flex-col gap-2">
                <div className="h-7 bg-muted rounded-md animate-pulse w-3/4" />
                <div className="h-10 bg-muted rounded-md animate-pulse" />
              </div>
            ) : (
              <WorkflowRatesSection clientId={clientId} initialRates={rates} onClose={() => setOpen(false)} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

type SheetView = "detail" | "edit" | "create";

function ClientSheetContent({
  client,
  initialView,
  onClose,
}: {
  client: Client | null;
  initialView: SheetView;
  onClose: () => void;
}) {
  const [view, setView] = useState<SheetView>(initialView);

  function handleSaved() { setView("detail"); }

  const isCreate = view === "create" || !client;

  if (isCreate) {
    return (
      <ClientForm
        initial={blankForm()}
        clientId={null}
        isNew
        onClose={onClose}
        onSaved={onClose}
      />
    );
  }

  if (view === "edit") {
    return (
      <ClientForm
        initial={clientToForm(client)}
        clientId={client.id}
        isNew={false}
        onClose={() => setView("detail")}
        onSaved={handleSaved}
      />
    );
  }

  return <ClientDetail key={client.id} client={client} onEdit={() => setView("edit")} onClose={onClose} />;
}

export function ClientSheet({
  open,
  onOpenChangeAction,
  client,
  initialView = "detail",
}: {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  client: Client | null;
  initialView?: SheetView;
}) {
  const contentKey = initialView === "create" ? "create" : (client?.id ?? "none");

  return (
    <Sheet open={open} onOpenChange={onOpenChangeAction}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <ClientSheetContent
          key={contentKey}
          client={client}
          initialView={initialView}
          onClose={() => onOpenChangeAction(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
