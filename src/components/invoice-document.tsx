import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { InvoiceDetail } from "@/lib/types";
import type { BusinessDetails } from "@/lib/queries";
import { lineItemTotal } from "@/lib/utils";

// Grid layout from the invoice-pdf-recreate template (A4 @ 96dpi), converted
// to points (x0.75). Column widths and fixed row heights mirror its CSS grid.
// Wrap whole words; react-pdf hyphenates mid-word by default ("Inte-gration").
Font.registerHyphenationCallback((word) => [word]);

const LINE = "0.75pt solid #5a5a5a";
const C1 = 99, C2 = 198.75, C3 = 148.5; // column 4 takes the rest
const ROW = 24;
// Invoice No/To and Dates rows share one height so the grid stays even.
const MID_ROW = 72;
const PAD = 12;

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    lineHeight: 1.12,
    color: "#161616",
    backgroundColor: "#ffffff",
    textTransform: "uppercase",
  },
  row: { flexDirection: "row" },
  bb: { borderBottom: LINE },
  br: { borderRight: LINE },
  left: { width: C1 + C2, paddingHorizontal: PAD },
  right: { flex: 1, paddingHorizontal: PAD },
  split: { justifyContent: "space-between", paddingBottom: 6 },

  title: { alignSelf: "flex-end", fontFamily: "Helvetica", fontSize: 40.5, letterSpacing: -0.8, lineHeight: 1 },
  gap: { marginTop: 4.5 },

  cell: { minHeight: ROW, paddingHorizontal: PAD, paddingVertical: 4, justifyContent: "center" },
  c1: { width: C1 },
  c2: { width: C2 },
  cQty: { width: 56 },
  c3: { width: C3 },
  rate: { flex: 1 },
  c4: { flex: 1 },
  // Qty/Hours sits just right of the centre line, sharing column 3 with Rate.
  rateWrap: { width: C3, flexDirection: "row" },
  r: { textAlign: "right" },
  val: { fontFamily: "Helvetica", fontSize: 12, lineHeight: 1.1, textTransform: "none" },
  amt: { fontSize: 12, lineHeight: 1.1 },
  date: { fontSize: 8, lineHeight: 1.12, paddingTop: 3 },
  sub: { fontSize: 8, lineHeight: 1.12 },
  // Short rows: KPI bonus and description sub-lines.
  short: { minHeight: 16, paddingVertical: 2 },

  notes: { justifyContent: "flex-end", paddingBottom: 22.5 },
  // lineHeight needs fontSize alongside it, or react-pdf resolves it against 18pt.
  notesText: { width: 184, fontFamily: "Helvetica", fontSize: 7.5, textTransform: "none", lineHeight: 1.1 },
  footer: { height: 75, justifyContent: "flex-end", paddingBottom: 10 },
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
  | { type: "entry"; entry: Entry }
  | { type: "sku_bonus"; entry: Entry }
  | { type: "line_item"; item: LineItem };

function buildRows(entries: Entry[], lineItems: LineItem[]): RowData[] {
  const rows: RowData[] = [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  for (const entry of sorted) {
    rows.push({ type: "entry", entry });
    // skus != null guard also suppresses the bonus breakdown row for Own Brand entries,
    // whose markup is folded into the rate/amount columns instead.
    if (entry.bonus_amount > 0 && entry.skus != null) {
      rows.push({ type: "sku_bonus", entry });
    }
  }
  for (const item of lineItems) rows.push({ type: "line_item", item });
  return rows;
}

function entryDescription(entry: Entry): string {
  if (entry.billing_type === "day_rate") {
    // ponytail: batch_lines deliberately not named here — internal batch labels
    // ("Batch A") are not shown to the client, and the sheet is the source of
    // truth for this line. Keep in sync with entryDescription in invoice-sheet.tsx.
    if (entry.workflow_type === "Own Brand") return entry.brand ?? "Own Brand";
    if (entry.workflow_type) return entry.workflow_type;
    return "Creative Assist";
  }
  if (entry.billing_type === "hourly") {
    const label = entry.label ?? entry.description ?? "";
    return entry.role ? `${label} (${abbreviateRole(entry.role)})` : label;
  }
  // manual: label holds the item; description (rendered as a sub-row) is a fallback for legacy entries
  return entry.label ?? entry.description ?? "";
}

// One grid row. `sub` is the small second line under the description
// (time range, manual-entry detail, line-item details).
function Row(p: { date?: string; desc: string; sub?: string | null; qty?: string; rate?: string; amount?: string; showQty: boolean; short?: boolean }) {
  const cell = p.short ? [s.cell, s.short] : [s.cell];
  const main = (
    // A row with a sub-line drops its bottom border so the two read as one block.
    <View style={p.sub ? s.row : [s.row, s.bb]} wrap={false}>
      <View style={[...cell, s.c1, s.br]}><Text style={s.date}>{p.date ?? ""}</Text></View>
      <View style={[...cell, s.c2, s.br]}><Text style={p.short ? s.sub : s.val}>{p.desc}</Text></View>
      <View style={s.rateWrap}>
        {p.showQty ? <View style={[...cell, s.cQty, s.br]}><Text style={[s.val, s.r]}>{p.qty ?? ""}</Text></View> : null}
        <View style={[...cell, s.rate, s.br]}><Text style={[s.val, s.r]}>{p.rate ?? ""}</Text></View>
      </View>
      <View style={[...cell, s.c4]}><Text style={[s.amt, s.r]}>{p.amount ?? ""}</Text></View>
    </View>
  );
  if (!p.sub) return main;
  return (
    <>
      {main}
      <Row desc={p.sub} showQty={p.showQty} short />
    </>
  );
}

function EntryRow({ entry, showQty }: { entry: Entry; showQty: boolean }) {
  const qty = entry.billing_type === "hourly" && entry.hours_worked != null
    ? String(entry.hours_worked)
    : entry.billing_type === "manual" && entry.skus != null
    ? String(entry.skus)
    : "";
  // Own Brand entries show the line total (base + markup) in both rate and amount columns,
  // hiding the internal base/markup split from the client.
  const isOwnBrand = entry.workflow_type === "Own Brand";
  const lineTotal = entry.base_amount + entry.bonus_amount;
  // Derive the actual hourly rate from this entry (base / hours) so role-based rates
  // show correctly — the client default rate is wrong when the entry used another role.
  const rate = entry.billing_type === "hourly"
    ? (entry.hours_worked && entry.hours_worked > 0 ? fmtRate(entry.base_amount / entry.hours_worked) : "")
    : entry.billing_type === "day_rate"
    ? fmtAmount(isOwnBrand ? lineTotal : entry.base_amount)
    : entry.skus
    ? fmtAmount(entry.base_amount / entry.skus)
    : lineTotal === 0
    ? ""
    : fmtAmount(lineTotal); // manual, no SKU count: one unit, so rate = amount
  // manual entries with no amount entered show a blank cell rather than 0.00
  const amount = entry.billing_type === "manual" && lineTotal === 0
    ? ""
    : fmtAmount(isOwnBrand ? lineTotal : entry.skus == null ? lineTotal : entry.base_amount);
  // Time range goes under the date; only manual detail stays under the description.
  const time = entry.billing_type === "hourly" && entry.start_time && entry.finish_time
    ? timeRangeLabel(entry)
    : null;
  const sub = entry.billing_type === "manual" && entry.label ? entry.description : null;

  return (
    <Row date={time ? `${fmtDateDay(entry.date)}\n${time}` : fmtDateDay(entry.date)} desc={entryDescription(entry)} sub={sub}
      qty={qty} rate={rate} amount={amount} showQty={showQty} />
  );
}

function skuBonusLabel(entry: Entry): string {
  return entry.batch_lines?.length
    ? `+ KPI bonus (${entry.batch_lines.map((l) => `${l.skus} ${l.workflow}`).join(" + ")})`
    : `+ KPI bonus (${entry.skus} SKUs)`;
}

function timeRangeLabel(entry: Entry): string {
  let label = `${fmtTime(entry.start_time!)} – ${fmtTime(entry.finish_time!)}`;
  if (entry.break_minutes && entry.break_minutes > 0) {
    label += ` (${entry.break_minutes}m)`;
  }
  return label;
}

function LineItemRow({ item, showQty, qtyFirst }: { item: LineItem; showQty: boolean; qtyFirst: boolean }) {
  // Blank quantity bills as 1 × amount (lineItemTotal), so show it that way.
  const qty = String(item.quantity ?? 1);
  return (
    <Row desc={item.description} sub={item.details}
      date={qtyFirst ? qty : undefined} qty={qty}
      rate={fmtAmount(item.amount)}
      amount={fmtAmount(lineItemTotal(item))} showQty={showQty} />
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={[s.row, s.bb]}>
      <View style={[s.cell, s.c3, s.br]}><Text>{label}</Text></View>
      <View style={[s.cell, s.c4]}><Text style={[s.amt, s.r]}>${fmtAmount(value)}</Text></View>
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
  const showSuperDetails = client.pays_super;
  const superRatePct = Math.round(client.super_rate * 100);
  const descriptionHeader = client.entry_label ?? "Description";
  const showHours = invoice.entries.some((e) => e.billing_type === "hourly");
  const showRate = invoice.entries.length > 0 || invoice.line_items.length > 0;
  const showQty =
    showHours ||
    invoice.line_items.length > 0 ||
    invoice.entries.some((e) => e.billing_type === "manual" && e.skus != null);

  // No dated entries (custom lines only): qty takes over the date column
  // instead of squeezing the description.
  const qtyFirst = showQty && invoice.entries.length === 0;
  const qtyCol = showQty && !qtyFirst;

  const rows = buildRows(invoice.entries, invoice.line_items);

  return (
    <Document>
      {/* ponytail: one fixed A4 grid; rows that overflow wrap onto a second page without the header grid. Add a fixed repeating header when invoices get that long. */}
      <Page size="A4" style={s.page}>
        {/* Top block: each cell's bottom label names the cell below it */}
        <View style={[s.row, s.bb, { height: 142.5 }]}>
          <View style={[s.left, s.br, s.split, { paddingTop: 10 }]}>
            <View>
              <Text>{business.business_name || business.name}</Text>
              {business.abn ? <Text>ABN {business.abn}</Text> : null}
              {business.address ? <Text>{business.address}</Text> : null}
              {business.suburb ? <Text>{business.suburb}</Text> : null}
            </View>
            <Text>Invoice No</Text>
          </View>
          <View style={[s.right, s.split, { paddingTop: 18 }]}>
            <Text style={s.title}>Invoice</Text>
            <Text>To</Text>
          </View>
        </View>

        <View style={[s.row, { height: MID_ROW }]}>
          <View style={[s.left, s.br, s.bb, s.split, { paddingTop: 12 }]}>
            <Text>{invoice.number}</Text>
            <Text>Dates</Text>
          </View>
          <View style={[s.right, { paddingTop: 12 }]}>
            <Text>{client.name}</Text>
            {/* ABN identifies the client on a tax invoice; email is the fallback. */}
            {client.abn ? <Text>ABN {client.abn}</Text> : client.email ? <Text>{client.email}</Text> : null}
            {client.address ? <Text>{client.address}</Text> : null}
            {client.suburb ? <Text>{client.suburb}</Text> : null}
          </View>
        </View>

        <View style={[s.row, s.bb, { height: MID_ROW }]}>
          <View style={[s.left, s.br, { paddingTop: 12 }]}>
            {invoice.issued_date ? <Text>Issued{"\n"}{fmtDateShort(invoice.issued_date)}</Text> : null}
            {invoice.due_date ? <Text style={s.gap}>Due{"\n"}{fmtDateShort(invoice.due_date)}</Text> : null}
          </View>
          <View style={s.right} />
        </View>

        {/* Table head */}
        <View style={[s.row, s.bb]}>
          <View style={[s.cell, s.c1, s.br]}><Text>{qtyFirst ? "Qty" : "Date"}</Text></View>
          <View style={[s.cell, s.c2, s.br]}><Text>{descriptionHeader}</Text></View>
          <View style={s.rateWrap}>
            {qtyCol ? <View style={[s.cell, s.cQty, s.br]}><Text style={s.r}>{showHours ? "Hours" : "Qty"}</Text></View> : null}
            <View style={[s.cell, s.rate, s.br]}><Text style={s.r}>{showRate ? "Rate" : ""}</Text></View>
          </View>
          <View style={[s.cell, s.c4]}><Text style={s.r}>Amount</Text></View>
        </View>

        {rows.map((row) =>
          row.type === "entry" ? <EntryRow key={`e-${row.entry.id}`} entry={row.entry} showQty={qtyCol} />
          : row.type === "sku_bonus" ? <Row key={`sku-${row.entry.id}`} desc={skuBonusLabel(row.entry)} amount={fmtAmount(row.entry.bonus_amount)} showQty={qtyCol} short />
          : <LineItemRow key={`li-${row.item.id}`} item={row.item} showQty={qtyCol} qtyFirst={qtyFirst} />
        )}

        {/* Spacer + notes (left) and totals (right) fill the rest of the page */}
        <View style={[s.row, { flex: 1 }]}>
          <View style={[s.left, s.br, s.bb, s.notes]}>
            {(business.bsb || business.account_number)
              ? <Text>Pay to{"\n"}BSB {business.bsb}{"\n"}Account Number {business.account_number}</Text>
              : null}
            {showSuperDetails && business.super_fund ? (
              <Text style={s.gap}>
                {business.super_fund}{"\n"}Member {business.super_member_number}, ABN {business.super_fund_abn}
                {business.super_usi ? `\nUSI ${business.super_usi}` : ""}
              </Text>
            ) : null}
            {invoice.notes ? <Text style={[s.notesText, { marginTop: 12 }]}>{invoice.notes}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <View style={[s.bb, { flex: 1 }]} />
            <Total label="Subtotal" value={invoice.subtotal} />
            {showSuper ? <Total label={`Super (${superRatePct}%)`} value={invoice.super_amount} /> : null}
            <Total label="Total" value={showSuper ? invoice.total : invoice.subtotal} />
          </View>
        </View>

        {/* Footer */}
        <View style={s.row}>
          <View style={[s.left, s.br, s.footer]}>
            {business.email ? <Text>{business.email}</Text> : null}
            {business.website ? <Text>{business.website}</Text> : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
