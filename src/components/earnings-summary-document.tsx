import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { FYSummary } from "@/lib/types";
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

  title: {
    fontFamily: SANS,
    fontSize: 39,
    lineHeight: 1,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  rangeLabel: {
    fontSize: 10,
    color: "#555555",
    marginBottom: 48,
  },

  // Table — no borders, mirror invoice doc spacing
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
  colMonth:    { width: "40%", fontSize: 10 },
  colEarnings: { flex: 1, fontSize: 10, textAlign: "right" },
  colSuper:    { flex: 1, fontSize: 10, textAlign: "right" },
  colTotal:    { flex: 1, fontSize: 10, textAlign: "right" },

  headerLabel: { fontSize: 7.5, color: "#555555", textTransform: "uppercase" },

  divider: {
    borderTopWidth: 1,
    borderTopColor: "#000000",
    marginTop: 6,
    marginBottom: 2,
  },

  totalsRow: {
    flexDirection: "row",
    paddingTop: 6,
    fontFamily: SANS,
  },
  totalsLabel:  { width: "40%", fontSize: 10, fontFamily: SANS },
  totalsValue:  { flex: 1, fontSize: 10, textAlign: "right" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 7.5,
    color: "#555555",
  },
});

function fmtAmount(n: number): string {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Props = {
  summary: FYSummary;
  business: BusinessDetails | null;
};

export function EarningsSummaryDocument({ summary, business }: Props) {
  const generated = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Business header */}
        <View style={s.topHeader}>
          <View style={s.addressBlock}>
            {business?.business_name ? <Text style={s.addressLine}>{business.business_name}</Text> : null}
            {business?.abn ? <Text style={s.addressLine}>ABN {business.abn}</Text> : null}
            {business?.address ? <Text style={s.addressLine}>{business.address}</Text> : null}
          </View>
        </View>

        {/* Title + date range */}
        <Text style={s.title}>{summary.fyLabel} Earnings Summary</Text>
        <Text style={s.rangeLabel}>{summary.rangeLabel}</Text>

        {/* Table */}
        <View>
          <View style={s.tableHeader}>
            <Text style={[s.colMonth, s.headerLabel]}>Month</Text>
            <Text style={[s.colEarnings, s.headerLabel]}>Earnings</Text>
            <Text style={[s.colSuper, s.headerLabel]}>Super</Text>
            <Text style={[s.colTotal, s.headerLabel]}>Total</Text>
          </View>

          {summary.rows.map((row) => (
            <View style={s.tableRow} key={row.month}>
              <Text style={s.colMonth}>{row.label}</Text>
              <Text style={s.colEarnings}>{fmtAmount(row.earnings)}</Text>
              <Text style={s.colSuper}>{fmtAmount(row.super)}</Text>
              <Text style={s.colTotal}>{fmtAmount(row.total)}</Text>
            </View>
          ))}

          <View style={s.divider} />

          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Total</Text>
            <Text style={s.totalsValue}>{fmtAmount(summary.totalEarnings)}</Text>
            <Text style={s.totalsValue}>{fmtAmount(summary.totalSuper)}</Text>
            <Text style={s.totalsValue}>{fmtAmount(summary.grandTotal)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={s.footer} fixed>Generated {generated}</Text>
      </Page>
    </Document>
  );
}
