"use client";

import { useState, useTransition, useActionState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { invalidate } from "@/lib/invalidate";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  saveBusinessDetails,
  saveInvoicingSettings,
  saveEmailSettings,
  type BusinessDetailsFormData,
  type InvoicingFormData,
} from "./actions";
import { changePassword, updateDisplayName } from "@/app/login/actions";
import type { BusinessDetails, InvoiceSequence, UserPreferences } from "@/lib/queries";

type Props =
  | { loading: true; userEmail: string; userName: string; initialTab?: string; businessDetails?: never; invoiceSequence?: never; userPreferences?: never }
  | { loading?: false; userEmail: string; userName: string; initialTab?: string; businessDetails: BusinessDetails | null; invoiceSequence: InvoiceSequence | null; userPreferences: UserPreferences | null };

function Field({
  label,
  id,
  value,
  onChange,
  disabled,
  type,
}: {
  label: string;
  id: string;
  value: string | number;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-6 pb-6">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InfoTab({
  businessDetails,
}: {
  businessDetails: BusinessDetails | null;
}) {
  const [bizForm, setBizForm] = useState<BusinessDetailsFormData>({
    name: businessDetails?.name ?? "",
    business_name: businessDetails?.business_name ?? "",
    abn: businessDetails?.abn ?? "",
    address: businessDetails?.address ?? "",
    suburb: businessDetails?.suburb ?? "",
    email: businessDetails?.email ?? "",
    super_fund: businessDetails?.super_fund ?? "",
    super_fund_abn: businessDetails?.super_fund_abn ?? "",
    super_usi: businessDetails?.super_usi ?? "",
    super_member_number: businessDetails?.super_member_number ?? "",
    bsb: businessDetails?.bsb ?? "",
    account_number: businessDetails?.account_number ?? "",
  });
  const [bizError, setBizError] = useState<string | null>(null);
  const [bizPending, startBizTransition] = useTransition();

  function setBiz<K extends keyof BusinessDetailsFormData>(
    key: K,
    value: BusinessDetailsFormData[K]
  ) {
    setBizForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveBiz() {
    setBizError(null);
    startBizTransition(async () => {
      try {
        await saveBusinessDetails(bizForm);
        invalidate("settings");
      } catch (e) {
        setBizError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card className="pb-0 gap-0">
        <CardHeader>
          <CardTitle>Business Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6 pb-6">
          <Field
            label="Name"
            id="name"
            value={bizForm.name}
            onChange={(v) => setBiz("name", v)}
            disabled={bizPending}
          />
          <Field
            label="Business Name"
            id="business_name"
            value={bizForm.business_name}
            onChange={(v) => setBiz("business_name", v)}
            disabled={bizPending}
          />
          <Field
            label="ABN"
            id="abn"
            value={bizForm.abn}
            onChange={(v) => setBiz("abn", v)}
            disabled={bizPending}
          />
          <Field
            label="Address"
            id="address"
            value={bizForm.address}
            onChange={(v) => setBiz("address", v)}
            disabled={bizPending}
          />
          <Field
            label="Suburb"
            id="suburb"
            value={bizForm.suburb}
            onChange={(v) => setBiz("suburb", v)}
            disabled={bizPending}
          />
          <Field
            label="Email"
            id="email"
            type="email"
            value={bizForm.email}
            onChange={(v) => setBiz("email", v)}
            disabled={bizPending}
          />
        </CardContent>
        <CardFooter className="border-t py-3 flex-col items-start gap-2">
          {bizError && <p className="text-sm text-destructive">{bizError}</p>}
          <Button onClick={handleSaveBiz} disabled={bizPending} size="sm">
            {bizPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="pb-0 gap-0">
        <CardHeader>
          <CardTitle>Super Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6 pb-6">
          <Field
            label="Fund Name"
            id="super_fund"
            value={bizForm.super_fund}
            onChange={(v) => setBiz("super_fund", v)}
            disabled={bizPending}
          />
          <Field
            label="Member Number"
            id="super_member_number"
            value={bizForm.super_member_number}
            onChange={(v) => setBiz("super_member_number", v)}
            disabled={bizPending}
          />
          <Field
            label="Fund ABN"
            id="super_fund_abn"
            value={bizForm.super_fund_abn}
            onChange={(v) => setBiz("super_fund_abn", v)}
            disabled={bizPending}
          />
          <Field
            label="USI"
            id="super_usi"
            value={bizForm.super_usi}
            onChange={(v) => setBiz("super_usi", v)}
            disabled={bizPending}
          />
        </CardContent>
        <CardFooter className="border-t py-3 flex-col items-start gap-2">
          {bizError && <p className="text-sm text-destructive">{bizError}</p>}
          <Button onClick={handleSaveBiz} disabled={bizPending} size="sm">
            {bizPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="pb-0 gap-0">
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6 pb-6">
          <Field
            label="BSB"
            id="bsb"
            value={bizForm.bsb}
            onChange={(v) => setBiz("bsb", v)}
            disabled={bizPending}
          />
          <Field
            label="Account Number"
            id="account_number"
            value={bizForm.account_number}
            onChange={(v) => setBiz("account_number", v)}
            disabled={bizPending}
          />
        </CardContent>
        <CardFooter className="border-t py-3 flex-col items-start gap-2">
          {bizError && <p className="text-sm text-destructive">{bizError}</p>}
          <Button onClick={handleSaveBiz} disabled={bizPending} size="sm">
            {bizPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function InvoicingTab({
  invoiceSequence,
}: {
  invoiceSequence: InvoiceSequence | null;
}) {
  const [form, setForm] = useState<InvoicingFormData>({
    invoice_prefix: invoiceSequence?.invoice_prefix ?? "",
    next_invoice_number: (invoiceSequence?.last_number ?? 0) + 1,
    due_date_offset: invoiceSequence?.due_date_offset ?? 30,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveInvoicingSettings(form);
        invalidate("settings");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card className="pb-0 gap-0">
        <CardHeader>
          <CardTitle>Invoice Sequence</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6 pb-6">
          <Field
            label="Invoice Prefix"
            id="invoice_prefix"
            value={form.invoice_prefix}
            onChange={(v) => setForm((prev) => ({ ...prev, invoice_prefix: v }))}
            disabled={pending}
          />
          <Field
            label="Next Invoice #"
            id="next_invoice_number"
            type="number"
            value={form.next_invoice_number}
            onChange={(v) =>
              setForm((prev) => ({
                ...prev,
                next_invoice_number: parseInt(v, 10) || 1,
              }))
            }
            disabled={pending}
          />
          <Field
            label="Due Date Offset (days)"
            id="due_date_offset"
            type="number"
            value={form.due_date_offset}
            onChange={(v) =>
              setForm((prev) => ({
                ...prev,
                due_date_offset: parseInt(v, 10) || 0,
              }))
            }
            disabled={pending}
          />
        </CardContent>
        <CardFooter className="border-t py-3 flex-col items-start gap-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSave} disabled={pending} size="sm">
            {pending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function EmailTab({
  userPreferences,
}: {
  userPreferences: UserPreferences | null;
}) {
  const [markAsIssued, setMarkAsIssued] = useState(userPreferences?.mark_as_issued_on_send ?? false);
  const [bccSelf, setBccSelf] = useState(userPreferences?.bcc_self ?? false);
  const [, startTransition] = useTransition();

  function handleChange(markAsIssuedVal: boolean, bccSelfVal: boolean) {
    startTransition(async () => {
      await saveEmailSettings({ mark_as_issued_on_send: markAsIssuedVal, bcc_self: bccSelfVal });
      invalidate("settings");
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="mark_as_issued_on_send" className="text-sm font-medium">
              Mark as issued after sending email
            </label>
            <Switch
              id="mark_as_issued_on_send"
              checked={markAsIssued}
              onCheckedChange={(v) => {
                setMarkAsIssued(v);
                handleChange(v, bccSelf);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="bcc_self" className="text-sm font-medium">
              Send me a copy of outbound emails
            </label>
            <Switch
              id="bcc_self"
              checked={bccSelf}
              onCheckedChange={(v) => {
                setBccSelf(v);
                handleChange(markAsIssued, v);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountTab({ email, name }: { email: string; name: string }) {
  const { theme, setTheme } = useTheme();
  const [nameState, nameAction, namePending] = useActionState(updateDisplayName, null);
  const [pwState, pwAction, pwPending] = useActionState(changePassword, null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card className="pb-0 gap-0">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6 pb-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email</label>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <form action={nameAction} className="flex flex-col gap-1.5">
            <label htmlFor="display_name" className="text-sm font-medium">Display name</label>
            <div className="flex gap-2">
              <Input
                id="display_name"
                name="display_name"
                defaultValue={name}
                disabled={namePending}
                className="max-w-xs"
                required
              />
              <Button type="submit" size="sm" disabled={namePending}>
                {namePending ? "Saving…" : "Save"}
              </Button>
            </div>
            {nameState?.error && <p className="text-sm text-destructive">{nameState.error}</p>}
            {nameState?.success && <p className="text-sm text-green-600">Name updated.</p>}
          </form>
          {!showPasswordForm ? (
            <Button variant="outline" size="sm" className="self-start" onClick={() => setShowPasswordForm(true)}>
              Change password
            </Button>
          ) : (
            <form action={pwAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new_password" className="text-sm font-medium">New password</label>
                <Input id="new_password" name="new_password" type="password" disabled={pwPending} required minLength={6} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm_password" className="text-sm font-medium">Confirm password</label>
                <Input id="confirm_password" name="confirm_password" type="password" disabled={pwPending} required />
              </div>
              {pwState?.error && <p className="text-sm text-destructive">{pwState.error}</p>}
              {pwState?.success && <p className="text-sm text-green-600">Password updated.</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pwPending}>
                  {pwPending ? "Saving…" : "Update password"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPasswordForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <Select value={theme ?? "system"} onValueChange={setTheme}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const VALID_TABS = ["info", "invoicing", "email", "account"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

export function SettingsClient({
  loading,
  userEmail,
  userName,
  initialTab,
  businessDetails,
  invoiceSequence,
  userPreferences,
}: Props) {
  const validInitial: SettingsTab = VALID_TABS.includes(initialTab as SettingsTab)
    ? (initialTab as SettingsTab)
    : "info";
  const [tab, setTab] = useState<SettingsTab>(validInitial);

  // Sync tab when navigating to settings from a deep link (e.g. sidebar → account)
  const prevInitialTab = useRef(initialTab);
  useEffect(() => {
    if (initialTab !== prevInitialTab.current) {
      prevInitialTab.current = initialTab;
      if (VALID_TABS.includes(initialTab as SettingsTab)) {
        setTab(initialTab as SettingsTab);
      }
    }
  }, [initialTab]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)} className="flex flex-col flex-1 overflow-hidden gap-0">
        <div className="px-4 md:px-6 pt-4">
          <TabsList>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="invoicing">Invoicing</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-auto pb-28 md:pb-0">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <TabsContent value="info">
                <InfoTab businessDetails={businessDetails ?? null} />
              </TabsContent>
              <TabsContent value="invoicing">
                <InvoicingTab invoiceSequence={invoiceSequence ?? null} />
              </TabsContent>
              <TabsContent value="email">
                <EmailTab userPreferences={userPreferences ?? null} />
              </TabsContent>
              <TabsContent value="account">
                <AccountTab email={userEmail} name={userName} />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
