import { InvoicesClient } from "./invoices-client";

export default function InvoicesLoading() {
  return <InvoicesClient filters={{ sortKey: "issued_date", sortDir: "desc" }} loading />;
}
