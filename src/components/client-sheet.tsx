"use client";

import { useTransition, useEffect, useState } from "react";
import type { Client, BillingType } from "@/lib/types";
import { formatAUD } from "@/lib/format";
import {
  updateClientColor,
  fetchClientInvoices,
  updateShowSuperOnInvoice,
  createClientAction,
  updateClientAction,
  deleteClientAction,
  type RecentInvoice,
  type ClientFormData,
} from "@/app/(app)/clients/actions";
import { invalidate } from "@/lib/invalidate";
import { Separator } from "@/components/ui/separator";
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
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pencil } from "lucide-react";

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

// ── Color dot (detail view only) ─────────────────────────────────────────────

function ColorDot({ clientId, current }: { clientId: string; current: string | null }) {
  const [isPending, startTransition] = useTransition();
  const active = current ?? CLIENT_COLOR_FALLBACK;

  function pick(color: string) {
    startTransition(async () => { await updateClientColor(clientId, color); invalidate("clients", "entries"); });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="size-3 rounded-full shrink-0 ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ backgroundColor: active }}
          aria-label="Change client colour"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2.5" align="start">
        <div className={`flex gap-1.5 flex-wrap w-40${isPending ? " opacity-60 pointer-events-none" : ""}`}>
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
      <Label className="text-xs text-muted-foreground">{label}</Label>
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "0.00"}
    />
  );
}

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  billing_type: BillingType;
  rate_full_day: string;
  rate_half_day: string;
  rate_hourly: string;
  rate_hourly_photographer: string;
  rate_hourly_operator: string;
  default_start_time: string;
  default_finish_time: string;
  entry_label: string;
  show_role: boolean;
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
    billing_type: "day_rate",
    rate_full_day: "",
    rate_half_day: "",
    rate_hourly: "",
    rate_hourly_photographer: "",
    rate_hourly_operator: "",
    default_start_time: "",
    default_finish_time: "",
    entry_label: "",
    show_role: false,
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
    rate_hourly_photographer: client.rate_hourly_photographer != null ? String(client.rate_hourly_photographer) : "",
    rate_hourly_operator: client.rate_hourly_operator != null ? String(client.rate_hourly_operator) : "",
    default_start_time: client.default_start_time?.slice(0, 5) ?? "",
    default_finish_time: client.default_finish_time?.slice(0, 5) ?? "",
    entry_label: client.entry_label ?? "",
    show_role: client.show_role,
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
    rate_hourly_photographer: null,
    rate_hourly_operator: null,
    default_start_time: null,
    default_finish_time: null,
    entry_label: null,
    show_role: false,
    pays_super: f.pays_super,
    super_rate: parseFloat(f.super_rate) || 0.12,
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
    base.rate_full_day = parseFloat(f.rate_full_day) || null;
    base.rate_half_day = parseFloat(f.rate_half_day) || null;
  } else if (f.billing_type === "hourly") {
    base.rate_hourly = parseFloat(f.rate_hourly) || null;
    base.rate_hourly_photographer = parseFloat(f.rate_hourly_photographer) || null;
    base.rate_hourly_operator = parseFloat(f.rate_hourly_operator) || null;
    base.default_start_time = f.default_start_time || null;
    base.default_finish_time = f.default_finish_time || null;
    base.entry_label = f.entry_label.trim() || null;
    base.show_role = f.show_role;
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
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      const payload = formToPayload(form);
      if (isNew) {
        await createClientAction(payload);
      } else {
        await updateClientAction(clientId!, payload);
      }
      invalidate("clients", "entries");
      onSaved();
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
      <SheetHeader className="px-6 py-5 border-b">
        <SheetTitle>{isNew ? "New Client" : "Edit Client"}</SheetTitle>
        <SheetDescription>{isNew ? "Add a new client" : "Update client details"}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* Name */}
        <Field label="Name">
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Client name"
          />
        </Field>

        {/* Billing type */}
        <Field label="Billing Type">
          <ToggleGroup
            type="single"
            value={form.billing_type}
            onValueChange={(v) => v && set("billing_type", v as BillingType)}
            className="justify-start"
          >
            <ToggleGroupItem value="day_rate">Day Rate</ToggleGroupItem>
            <ToggleGroupItem value="hourly">Hourly</ToggleGroupItem>
            <ToggleGroupItem value="manual">Manual</ToggleGroupItem>
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
            <Field label="Hourly Rate ($)">
              <NumericInput value={form.rate_hourly} onChange={(v) => set("rate_hourly", v)} />
            </Field>
            <div className="flex gap-3">
              <Field label="Photographer ($)">
                <NumericInput value={form.rate_hourly_photographer} onChange={(v) => set("rate_hourly_photographer", v)} />
              </Field>
              <Field label="Operator ($)">
                <NumericInput value={form.rate_hourly_operator} onChange={(v) => set("rate_hourly_operator", v)} />
              </Field>
            </div>
            <div className="flex gap-3">
              <Field label="Default Start">
                <Input type="time" value={form.default_start_time} onChange={(e) => set("default_start_time", e.target.value)} />
              </Field>
              <Field label="Default Finish">
                <Input type="time" value={form.default_finish_time} onChange={(e) => set("default_finish_time", e.target.value)} />
              </Field>
            </div>
            <Field label="Entry Label">
              <Input
                value={form.entry_label}
                onChange={(e) => set("entry_label", e.target.value)}
                placeholder="e.g. Shoot Client"
              />
            </Field>
            <div className="flex items-center justify-between text-sm">
              <span>Show Role (Photographer / Operator)</span>
              <Switch checked={form.show_role} onCheckedChange={(v) => set("show_role", v)} />
            </div>
          </>
        )}

        <Separator />

        {/* Super */}
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

        <Separator />

        {/* Invoice frequency */}
        <Field label="Invoice Frequency">
          <ToggleGroup
            type="single"
            value={form.invoice_frequency}
            onValueChange={(v) => v && set("invoice_frequency", v as "weekly" | "per_job")}
            className="justify-start"
          >
            <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
            <ToggleGroupItem value="per_job">Per Job</ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <Separator />

        {/* Contact */}
        <Section title="Contact">
          <Field label="Contact Name">
            <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Suburb">
            <Input value={form.suburb} onChange={(e) => set("suburb", e.target.value)} />
          </Field>
          <Field label="ABN">
            <Input value={form.abn} onChange={(e) => set("abn", e.target.value)} />
          </Field>
        </Section>

        {/* Active (edit only) */}
        {!isNew && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span>Active</span>
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </div>
          </>
        )}

        {/* Workflow rates placeholder */}
        <Separator />
        <Section title="Workflow Rates">
          <p className="text-sm text-muted-foreground">Workflow rate configuration coming soon.</p>
        </Section>

        {/* Delete (edit only) */}
        {!isNew && (
          <>
            <Separator />
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

      <div className="px-6 py-4 border-t flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={isPending || !form.name.trim()}>
          {isPending ? <Spinner className="size-4" /> : isNew ? "Create Client" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

function ClientDetail({
  client,
  onEdit,
}: {
  client: Client;
  onEdit: () => void;
}) {
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
      const rates = [
        client.rate_hourly && `${formatAUD(client.rate_hourly)}/hr`,
        client.rate_hourly_photographer && `${formatAUD(client.rate_hourly_photographer)}/hr photo`,
        client.rate_hourly_operator && `${formatAUD(client.rate_hourly_operator)}/hr op`,
      ].filter(Boolean);
      return rates.join(", ") || "—";
    }
    return "Manual";
  })();

  return (
    <>
      <SheetHeader className="px-6 py-5 border-b">
        <div className="flex items-center gap-3">
          <ColorDot clientId={client.id} current={client.color} />
          <SheetTitle>{client.name}</SheetTitle>
          {!client.is_active && (
            <span className="ml-auto text-xs text-muted-foreground border rounded-full px-2 py-0.5">Inactive</span>
          )}
          <Button variant="ghost" size="icon" className="ml-auto shrink-0 size-8" onClick={onEdit} aria-label="Edit client">
            <Pencil className="size-4" />
          </Button>
        </div>
        <SheetDescription>{BILLING_LABEL[client.billing_type]}</SheetDescription>
      </SheetHeader>

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
          <Row label="Rate" value={primaryRate} />
          <Row label="Invoice frequency" value={client.invoice_frequency === "weekly" ? "Weekly" : "Per job"} />
          {client.pays_super && (
            <Row label="Super" value={`${(client.super_rate * 100).toFixed(1)}%`} />
          )}
          {client.pays_super && (
            <SuperOnInvoiceToggle clientId={client.id} value={client.show_super_on_invoice} />
          )}
        </Section>

        <Separator />

        <Section title="Settings">
          {client.entry_label && <Row label="Entry label" value={client.entry_label} />}
          <Row label="Show role" value={client.show_role ? "Yes" : "No"} />
        </Section>

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
            </div>
          )}
        </Section>
      </div>
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

  return <ClientDetail key={client.id} client={client} onEdit={() => setView("edit")} />;
}

export function ClientSheet({
  open,
  onOpenChange,
  client,
  initialView = "detail",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  initialView?: SheetView;
}) {
  const contentKey = initialView === "create" ? "create" : (client?.id ?? "none");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <ClientSheetContent
          key={contentKey}
          client={client}
          initialView={initialView}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
