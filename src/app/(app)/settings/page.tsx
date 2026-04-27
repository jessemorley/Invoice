import { Suspense } from "react";
import { SettingsClient } from "./settings-client";
import { fetchSettings } from "./actions";

async function SettingsData() {
  const { businessDetails, invoiceSequence } = await fetchSettings();
  return (
    <SettingsClient
      businessDetails={businessDetails}
      invoiceSequence={invoiceSequence}
    />
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsClient loading />}>
      <SettingsData />
    </Suspense>
  );
}
