interface UserSettings {
  businessName: string;
  abn: string;
  address: string;
  bsb: string;
  accountNumber: string;
  superFund: string;
  superMemberNumber: string;
  superFundAbn: string;
  superUsi: string;
}

interface Client {
  name: string;
  email: string;
  address: string;
  suburb: string;
  entryLabel?: string;
  paysSuper: boolean;
  showSuperOnInvoice: boolean;
  superRate: number; // e.g. 0.115 for 11.5%
  rateHourly?: number;
}

interface Entry {
  date: string; // "YYYY-MM-DD"
  billingTypeSnapshot: 'dayRate' | 'hourly' | 'manual';
  workflowType?: string;
  brand?: string;
  shootClient?: string;
  description?: string;
  role?: string;
  hoursWorked?: number;
  startTime?: string; // "HH:mm:ss"
  finishTime?: string; // "HH:mm:ss"
  breakMinutes?: number;
  baseAmount: number;
  bonusAmount: number;
  skus?: number;
}

interface Invoice {
  invoiceNumber: string;
  issuedDate: string; // "YYYY-MM-DD"
  dueDate: string;    // "YYYY-MM-DD"
  subtotal: number;
  superAmount: number;
  total: number;
}

function formatAmount(value: number): string {
  return value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRate(value: number): string {
  return value.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatTime(t: string): string {
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const hour = parseInt(parts[0], 10);
  const minute = parts[1].padStart(2, '0');
  return `${hour}:${minute}`;
}

function abbreviateRole(role?: string): string {
  switch (role?.toLowerCase()) {
    case 'photographer': return 'P';
    case 'operator': return 'O';
    default: return role ?? '';
  }
}

function formatDate(dateStr: string, format: 'short' | 'day'): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (format === 'short') {
    return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildLineItems(entries: Entry[], client: Client): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let html = '';

  for (const entry of sorted) {
    const dateStr = formatDate(entry.date, 'day');
    let description = '';
    let hours = '';
    let rate = '';
    const amount = formatAmount(entry.baseAmount);

    if (entry.billingTypeSnapshot === 'dayRate') {
      if (entry.workflowType === 'Own Brand') {
        description = entry.brand ?? 'Own Brand';
      } else if (entry.workflowType) {
        description = entry.workflowType;
      } else {
        description = 'Creative Assist';
      }
      rate = formatAmount(entry.baseAmount);

    } else if (entry.billingTypeSnapshot === 'hourly') {
      const label = entry.shootClient ?? entry.description ?? '';
      description = entry.role ? `${label} (${abbreviateRole(entry.role)})` : label;
      hours = entry.hoursWorked != null ? String(entry.hoursWorked) : '';
      rate = formatRate(client.rateHourly ?? 0);

    } else {
      description = entry.description ?? '';
    }

    html += `<tr><td class="col-date">${dateStr}</td><td class="col-item">${description}</td><td class="col-qty">${hours}</td><td class="col-rate">${rate}</td><td class="col-amount">${amount}</td></tr>\n`;

    if (entry.bonusAmount > 0 && entry.skus != null) {
      html += `<tr><td class="col-date"></td><td class="col-item">&nbsp;&nbsp;+ SKU bonus (${entry.skus} SKUs)</td><td class="col-qty"></td><td class="col-rate"></td><td class="col-amount">${formatAmount(entry.bonusAmount)}</td></tr>\n`;
    }

    if (entry.billingTypeSnapshot === 'hourly' && entry.startTime && entry.finishTime) {
      let subLine = `${formatTime(entry.startTime)} – ${formatTime(entry.finishTime)}`;
      if (entry.breakMinutes && entry.breakMinutes > 0) {
        subLine += ` (${entry.breakMinutes}m)`;
      }
      html += `<tr><td class="col-date"></td><td class="col-item" style="color:#555;font-size:0.75em;padding-top:0">${subLine}</td><td class="col-qty"></td><td class="col-rate"></td><td class="col-amount"></td></tr>\n`;
    }
  }

  return html;
}

export function buildInvoiceHTML(
  invoice: Invoice,
  entries: Entry[],
  client: Client,
  settings: UserSettings
): string {
  const issuedStr = formatDate(invoice.issuedDate, 'short');
  const dueStr = formatDate(invoice.dueDate, 'short');
  const lineItems = buildLineItems(entries, client);
  const descriptionHeader = client.entryLabel ?? 'Description';

  const superRatePct = Math.round(client.superRate * 100);
  const showSuper = client.paysSuper && client.showSuperOnInvoice;
  const superRow = showSuper
    ? `<div class="totals-row"><span class="label">Super (${superRatePct}%)</span><span class="value">${formatAmount(invoice.superAmount)}</span></div>`
    : '';
  const superMetaLines = showSuper
    ? `<p>${settings.superFund}, Member ${settings.superMemberNumber}, ABN ${settings.superFundAbn}</p><p>USI ${settings.superUsi}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 28px 42px; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #000; line-height: 1.2; }
  .page { width: 100%; background: white; }
  .top-header { display: flex; justify-content: space-between; margin-bottom: 80px; }
  .address-block { font-size: 13.5px; }
  .address-block p { margin: 0 0 3px 0; }
  .invoice-title { font-size: 52px; font-weight: 500; margin: 0 0 70px 0; letter-spacing: -1px; }
  .meta-container { display: flex; margin-bottom: 120px; font-size: 13.5px; }
  .dates-block { width: 28%; }
  .dates-block p { margin: 0 0 4px 0; }
  .bank-block { flex-grow: 1; }
  .bank-block p { margin: 0 0 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 100px; }
  th { text-align: left; padding: 10px 0; font-size: 13.5px; font-weight: normal; }
  td { padding: 6px 0; vertical-align: top; font-size: 13.5px; }
  .col-date   { width: 22%; }
  .col-item   { width: 37%; }
  .col-qty    { width: 11%; text-align: right; }
  .col-rate   { width: 11%; text-align: right; }
  .col-amount { width: 9%;  text-align: right; }
  .totals-section { display: flex; flex-direction: column; align-items: flex-end; font-size: 13.5px; }
  .totals-row { display: flex; justify-content: space-between; width: 100%; padding: 4px 0; }
  .totals-row.grand-total { margin-top: 40px; }
  .label { text-align: left; }
  .value { text-align: right; width: 100px; }
</style>
</head>
<body>
<div class="page">
  <div class="top-header">
    <div class="address-block">
      <p>${settings.businessName}</p>
      <p>ABN ${settings.abn}</p>
      <p>${settings.address}</p>
    </div>
    <div class="address-block">
      <p>${client.name}</p>
      <p>${client.email}</p>
      <p>${client.address}</p>
      <p>${client.suburb}</p>
    </div>
  </div>
  <h1 class="invoice-title">Invoice ${invoice.invoiceNumber}</h1>
  <div class="meta-container">
    <div class="dates-block">
      <p>Issued ${issuedStr}</p>
      <p>Due ${dueStr}</p>
    </div>
    <div class="bank-block">
      <p>BSB ${settings.bsb} Account Number ${settings.accountNumber}</p>
      ${superMetaLines}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="col-date">Item</th>
        <th class="col-item">${descriptionHeader}</th>
        <th class="col-qty">Hours</th>
        <th class="col-rate">Rate</th>
        <th class="col-amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems}
    </tbody>
  </table>
  <div class="totals-section">
    <div class="totals-row">
      <span class="label">Subtotal</span>
      <span class="value">${formatAmount(invoice.subtotal)}</span>
    </div>
    ${superRow}
    <div class="totals-row grand-total">
      <span class="label">Total</span>
      <span class="value">${formatAmount(invoice.total)}</span>
    </div>
  </div>
</div>
</body>
</html>`;
}
