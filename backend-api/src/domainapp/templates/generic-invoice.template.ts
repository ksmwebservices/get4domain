import { Contact, GenericInvoice, Vendor } from '@prisma/client';

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
}

const formatCurrency = (amount: number): string =>
  `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (date: Date | null): string =>
  date
    ? new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

/**
 * Renders a printable HTML invoice (used by GET /domainapp/invoices/:id/pdf).
 * The frontend / browser handles print-to-PDF, matching the platform's
 * existing subscription-invoice approach (no server-side PDF dependency).
 */
export function renderGenericInvoiceHtml(
  invoice: GenericInvoice,
  vendor: Vendor,
  contact: Contact,
): string {
  const items = (invoice.items as unknown as LineItem[]) ?? [];
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatCurrency(item.rate)}</td>
          <td class="num">${formatCurrency(item.quantity * item.rate)}</td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; margin: 0; padding: 40px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .brand { font-size: 22px; font-weight: 700; }
  .muted { color: #64748b; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  th { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }
  .num { text-align: right; }
  .totals { margin-top: 16px; margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .totals .grand { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 10px; font-weight: 700; font-size: 16px; }
  .status { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .print-hint { margin-top: 40px; }
  @media print { .print-hint { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="brand">${vendor.businessName ?? vendor.name}</div>
      <div class="muted">${vendor.email ?? ''}${vendor.phone ? ' · ' + vendor.phone : ''}</div>
    </div>
    <div style="text-align:right">
      <h1>INVOICE</h1>
      <div class="muted">#${invoice.invoiceNumber}</div>
      <div class="muted">Date: ${formatDate(invoice.createdAt)}</div>
      ${invoice.dueDate ? `<div class="muted">Due: ${formatDate(invoice.dueDate)}</div>` : ''}
    </div>
  </div>

  <div class="muted">Bill To</div>
  <div style="font-weight:600; margin-bottom:4px">${contact.name}</div>
  <div class="muted">${contact.phone}${contact.email ? ' · ' + contact.email : ''}</div>
  ${contact.address ? `<div class="muted">${contact.address}</div>` : ''}

  <table>
    <thead>
      <tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${formatCurrency(invoice.subtotal)}</span></div>
    <div><span>GST (${invoice.gstRate}%)</span><span>${formatCurrency(invoice.gstAmount)}</span></div>
    <div class="grand"><span>Total</span><span>${formatCurrency(invoice.total)}</span></div>
  </div>

  <div class="print-hint muted">Status: ${invoice.status} — Use your browser's Print → Save as PDF to download.</div>
</body>
</html>`;
}
