"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  saveBusinessDetails,
  saveInvoicingSettings,
  type BusinessDetailsFormData,
  type InvoicingFormData,
} from "./actions";
import type { BusinessDetails, InvoiceSequence } from "@/lib/queries";

type Props =
  | { loading: true; businessDetails?: never; invoiceSequence?: never }
  | { loading?: false; businessDetails: BusinessDetails | null; invoiceSequence: InvoiceSequence | null };

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
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-2xl">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
      } catch (e) {
        setBizError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Business Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
            label="Email"
            id="email"
            type="email"
            value={bizForm.email}
            onChange={(v) => setBiz("email", v)}
            disabled={bizPending}
          />
          {bizError && (
            <p className="text-sm text-destructive">{bizError}</p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSaveBiz} disabled={bizPending} size="sm">
              {bizPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Super Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
          {bizError && (
            <p className="text-sm text-destructive">{bizError}</p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSaveBiz} disabled={bizPending} size="sm">
              {bizPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
          {bizError && (
            <p className="text-sm text-destructive">{bizError}</p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSaveBiz} disabled={bizPending} size="sm">
              {bizPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
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
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveInvoicingSettings(form);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Sequence</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={pending} size="sm">
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsClient({
  loading,
  businessDetails,
  invoiceSequence,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" />
      <Tabs defaultValue="info" className="flex flex-col flex-1 overflow-hidden gap-0">
        <div className="border-b px-4">
          <TabsList variant="line" className="h-10">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="invoicing">Invoicing</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-auto">
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
              <TabsContent value="account">
                <div className="flex flex-col gap-4 p-4 md:p-6 max-w-2xl">
                  <Card>
                    <CardHeader>
                      <CardTitle>Account</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Account email and avatar coming soon.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
