import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceDetail } from "@/lib/types";
import type { BusinessDetails } from "@/lib/queries";

const SANS = "Helvetica";

const s = StyleSheet.create({
  page: {
    fontFamily: SANS,
    fontSize: 10,
    color: "#000000",
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 32,
    backgroundColor: "#ffffff",
    lineHeight: 1.2,
  },

  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 52,
  },
  addressBlock: { fontSize: 10 },
  addressLine: { marginBottom: 2 },

  invoiceTitle: {
    fontFamily: SANS,
    fontSize: 39,
    marginBottom: 72,
    letterSpacing: -0.5,
  },

  metaContainer: {
    flexDirection: "row",
    marginBottom: 95,
    fontSize: 10,
  },
  datesBlock: { width: "28%" },
  datesLine: { marginBottom: 3 },
  bankBlock: { flex: 1 },
  bankLine: { marginBottom: 3 },

  // Table — no borders anywhere
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 6,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingTop: 5,
    paddingBottom: 2,
  },
  tableSubRow: {
    flexDirection: "row",
    paddingBottom: 4,
  },

  colDate:   { width: "22%", fontSize: 10 },
  colItem:   { width: "37%", fontSize: 10 },
  colQty:    { width: "11%", fontSize: 10, textAlign: "right" },
  colRate:   { width: "11%", fontSize: 10, textAlign: "right" },
  colAmount: { flex: 1,      fontSize: 10, textAlign: "right" },

  subText: { fontSize: 7.5, color: "#555555" },

  tableWrapper: { marginBottom: 100 },

  // Totals — full width, label left, value right
  totalsSection: { fontSize: 10 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsGrandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 28,
  },
  totalsValue: { textAlign: "right" },
  totalsLabelBold: {},
  totalsValueBold: { textAlign: "right" },
});

function fmtAmount(n: number): string {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRate(n: number): string {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// "16 Apr 2026" — matches reference image issued/due date style
function fmtDateShort(d: string): string {
  const dt = new Date(d + "T00:00:00");
  const day = dt.getDate();
  const month = dt.toLocaleDateString("en-AU", { month: "short" });
  const year = dt.getFullYear();
  return `${day} ${month} ${year}`;
}

// "Tue, 14 Apr" — matches reference image table row date style
function fmtDateDay(d: string): string {
  const dt = new Date(d + "T00:00:00");
  const dow = dt.toLocaleDateString("en-AU", { weekday: "short" });
  const day = dt.getDate();
  const month = dt.toLocaleDateString("en-AU", { month: "short" });
  return `${dow}, ${day} ${month}`;
}

function fmtTime(t: string): string {
  const parts = t.split(":");
  if (parts.length < 2) return t;
  return `${parseInt(parts[0], 10)}:${parts[1].padStart(2, "0")}`;
}

function abbreviateRole(role?: string | null): string {
  switch (role?.toLowerCase()) {
    case "photographer": return "P";
    case "operator": return "O";
    default: return role ?? "";
  }
}

type Entry = InvoiceDetail["entries"][0];
type LineItem = InvoiceDetail["line_items"][0];

type RowData =
  | { type: "entry"; entry: Entry; clientRateHourly: number }
  | { type: "sku_bonus"; entry: Entry }
  | { type: "time_range"; entry: Entry }
  | { type: "line_item"; item: LineItem };

function buildRows(entries: Entry[], lineItems: LineItem[], clientRateHourly: number): RowData[] {
  const rows: RowData[] = [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  for (const entry of sorted) {
    rows.push({ type: "entry", entry, clientRateHourly });
    if (entry.bonus_amount > 0 && entry.skus != null) {
      rows.push({ type: "sku_bonus", entry });
    }
    if (entry.billing_type === "hourly" && entry.start_time && entry.finish_time) {
      rows.push({ type: "time_range", entry });
    }
  }

  for (const item of lineItems) {
    rows.push({ type: "line_item", item });
  }

  return rows;
}

function entryDescription(entry: Entry): string {
  if (entry.billing_type === "day_rate") {
    if (entry.workflow_type === "Own Brand") return entry.brand ?? "Own Brand";
    if (entry.workflow_type) return entry.workflow_type;
    return "Creative Assist";
  }
  if (entry.billing_type === "hourly") {
    const label = entry.shoot_client ?? entry.description ?? "";
    return entry.role ? `${label} (${abbreviateRole(entry.role)})` : label;
  }
  return entry.description ?? "";
}

function EntryRow({ entry, clientRateHourly }: { entry: Entry; clientRateHourly: number }) {
  const description = entryDescription(entry);
  const hours = entry.billing_type === "hourly" && entry.hours_worked != null
    ? String(entry.hours_worked)
    : "";
  const rate = entry.billing_type === "hourly"
    ? fmtRate(clientRateHourly)
    : entry.billing_type === "day_rate"
    ? fmtAmount(entry.base_amount)
    : "";
  const amount = fmtAmount(entry.base_amount);

  return (
    <View style={s.tableRow}>
      <Text style={s.colDate}>{fmtDateDay(entry.date)}</Text>
      <Text style={s.colItem}>{description}</Text>
      <Text style={s.colQty}>{hours}</Text>
      <Text style={s.colRate}>{rate}</Text>
      <Text style={s.colAmount}>{amount}</Text>
    </View>
  );
}

function SkuBonusRow({ entry }: { entry: Entry }) {
  return (
    <View style={s.tableRow}>
      <Text style={s.colDate} />
      <Text style={[s.colItem, s.subText]}>{`  + SKU bonus (${entry.skus} SKUs)`}</Text>
      <Text style={s.colQty} />
      <Text style={s.colRate} />
      <Text style={[s.colAmount, s.subText]}>{fmtAmount(entry.bonus_amount)}</Text>
    </View>
  );
}

function TimeRangeRow({ entry }: { entry: Entry }) {
  let label = `${fmtTime(entry.start_time!)} – ${fmtTime(entry.finish_time!)}`;
  if (entry.break_minutes && entry.break_minutes > 0) {
    label += ` (${entry.break_minutes}m)`;
  }
  return (
    <View style={s.tableSubRow}>
      <Text style={s.colDate} />
      <Text style={[s.colItem, s.subText]}>{label}</Text>
      <Text style={s.colQty} />
      <Text style={s.colRate} />
      <Text style={s.colAmount} />
    </View>
  );
}

function LineItemRow({ item }: { item: LineItem }) {
  return (
    <View style={s.tableRow}>
      <Text style={s.colDate} />
      <Text style={s.colItem}>{item.description}</Text>
      <Text style={s.colQty}>{item.quantity != null ? String(item.quantity) : ""}</Text>
      <Text style={s.colRate} />
      <Text style={s.colAmount}>{fmtAmount(item.amount)}</Text>
    </View>
  );
}

type Props = {
  invoice: InvoiceDetail;
  business: BusinessDetails;
};

export function InvoiceDocument({ invoice, business }: Props) {
  const { client } = invoice;
  const showSuper = client.pays_super && client.show_super_on_invoice;
  const superRatePct = Math.round(client.super_rate * 100);
  const descriptionHeader = client.entry_label ?? "Description";
  const clientRateHourly = client.rate_hourly ?? 0;

  const rows = buildRows(invoice.entries, invoice.line_items, clientRateHourly);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Top header */}
        <View style={s.topHeader}>
          <View style={s.addressBlock}>
            <Text style={s.addressLine}>{business.business_name || business.name}</Text>
            {business.abn ? <Text style={s.addressLine}>ABN {business.abn}</Text> : null}
            {business.address ? <Text style={s.addressLine}>{business.address}</Text> : null}
          </View>
          <View style={s.addressBlock}>
            <Text style={s.addressLine}>{client.name}</Text>
            <Text style={s.addressLine}>{client.email}</Text>
            {client.address ? <Text style={s.addressLine}>{client.address}</Text> : null}
            {client.suburb ? <Text style={s.addressLine}>{client.suburb}</Text> : null}
          </View>
        </View>

        {/* Invoice title */}
        <Text style={s.invoiceTitle}>Invoice {invoice.number}</Text>

        {/* Meta row */}
        <View style={s.metaContainer}>
          <View style={s.datesBlock}>
            <Text style={s.datesLine}>Issued {fmtDateShort(invoice.issued_date)}</Text>
            {invoice.due_date
              ? <Text style={s.datesLine}>Due {fmtDateShort(invoice.due_date)}</Text>
              : null}
          </View>
          <View style={s.bankBlock}>
            {(business.bsb || business.account_number)
              ? <Text style={s.bankLine}>BSB {business.bsb}  Account Number {business.account_number}</Text>
              : null}
            {showSuper && business.super_fund
              ? <Text style={s.bankLine}>{business.super_fund}, Member {business.super_member_number}, ABN {business.super_fund_abn}</Text>
              : null}
            {showSuper && business.super_usi
              ? <Text style={s.bankLine}>USI {business.super_usi}</Text>
              : null}
          </View>
        </View>

        {/* Table */}
        <View style={s.tableWrapper}>
          <View style={s.tableHeader}>
            <Text style={s.colDate}>Item</Text>
            <Text style={s.colItem}>{descriptionHeader}</Text>
            <Text style={s.colQty}>Hours</Text>
            <Text style={s.colRate}>Rate</Text>
            <Text style={s.colAmount}>Amount</Text>
          </View>

          {rows.map((row, i) => {
            if (row.type === "entry") {
              return <EntryRow key={`e-${row.entry.id}`} entry={row.entry} clientRateHourly={clientRateHourly} />;
            }
            if (row.type === "sku_bonus") {
              return <SkuBonusRow key={`sku-${row.entry.id}`} entry={row.entry} />;
            }
            if (row.type === "time_range") {
              return <TimeRangeRow key={`tr-${row.entry.id}-${i}`} entry={row.entry} />;
            }
            return <LineItemRow key={`li-${row.item.id}`} item={row.item} />;
          })}
        </View>

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalsRow}>
            <Text>Subtotal</Text>
            <Text style={s.totalsValue}>{fmtAmount(invoice.subtotal)}</Text>
          </View>
          {showSuper && (
            <View style={s.totalsRow}>
              <Text>Super ({superRatePct}%)</Text>
              <Text style={s.totalsValue}>{fmtAmount(invoice.super_amount)}</Text>
            </View>
          )}
          <View style={s.totalsGrandRow}>
            <Text style={s.totalsLabelBold}>Total</Text>
            <Text style={s.totalsValueBold}>{fmtAmount(invoice.total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
