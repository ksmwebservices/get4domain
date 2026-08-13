import { Invoice, Vendor } from '@prisma/client';

const formatCurrency = (paise: number): string => `Rs. ${(paise / 100).toFixed(2)}`;

const formatDate = (date: Date | null): string =>
  date ? new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export interface InvoiceCompany {
  name: string;
  gstin: string;
  pan: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string | null;
}

export interface InvoiceLineItem {
  description: string;
  /** Gross line price in paise, before any line discount. */
  price: number;
  /** Line discount in paise (optional). */
  discount?: number;
}

export interface InvoiceRenderOpts {
  company?: Partial<InvoiceCompany>;
  /** e.g. "Razorpay", "Wallet", "UPI". */
  paymentMode?: string;
  /** Next renewal date for the renewal reminder note. */
  nextRenewal?: Date | null;
  /** Itemised breakdown. When omitted, a single row from invoice.description/amount is shown. */
  lineItems?: InvoiceLineItem[];
}

function resolveCompany(c?: Partial<InvoiceCompany>): InvoiceCompany {
  return {
    name: c?.name ?? process.env.COMPANY_NAME ?? 'KSM Quantum Technologies',
    gstin: c?.gstin ?? process.env.COMPANY_GST ?? 'GSTIN pending',
    pan: c?.pan ?? process.env.COMPANY_PAN ?? 'PAN pending',
    address: c?.address ?? process.env.COMPANY_ADDRESS ?? 'Tidel Park, D Block, Tharamani, Chennai 600113',
    phone: c?.phone ?? process.env.COMPANY_PHONE ?? '',
    email: c?.email ?? process.env.COMPANY_EMAIL ?? 'admin@get4domain.com',
    // Default to the canonical brand logo so invoices stay consistent with the site
    // header/favicon when no explicit Company Logo is uploaded in Admin.
    logoUrl: c?.logoUrl ?? process.env.COMPANY_LOGO_URL ?? 'https://get4domain.com/logo.png',
  };
}

export function renderInvoiceHtml(invoice: Invoice, vendor: Vendor, opts: InvoiceRenderOpts = {}): string {
  const co = resolveCompany(opts.company);

  // Stored invoice totals are authoritative (amount = taxable, gstAmount, totalAmount).
  const items: InvoiceLineItem[] = opts.lineItems?.length
    ? opts.lineItems
    : [{ description: invoice.description, price: invoice.amount, discount: 0 }];
  const grossSubtotal = items.reduce((s, i) => s + i.price, 0);
  const discountTotal = items.reduce((s, i) => s + (i.discount ?? 0), 0);
  const hasDiscount = discountTotal > 0;

  const paymentMode = opts.paymentMode ?? (invoice.status === 'PAID' ? 'Razorpay' : 'Pending — Razorpay');
  const paidNote = invoice.status === 'PAID' ? ` — Paid on ${formatDate(invoice.paidAt)}` : '';

  const itemRows = items.map((i) => `
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">${i.description}</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0;">${formatCurrency(i.price)}</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0;">${i.discount ? '– ' + formatCurrency(i.discount) : '—'}</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0;">${formatCurrency(i.price - (i.discount ?? 0))}</td>
        </tr>`).join('');

  const renewalNote = opts.nextRenewal
    ? `<div style="margin-bottom: 20px; padding: 12px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 13px; color: #1e40af;">
        <strong>Renewal reminder:</strong> Your next renewal is due on <strong>${formatDate(opts.nextRenewal)}</strong>. Renew before this date to avoid any service interruption.
      </div>`
    : '';

  const paid = invoice.status === 'PAID';
  const statusBadge = `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.4px;${paid ? 'background:#dcfce7;color:#166534;' : 'background:#fef3c7;color:#92400e;'}">${paid ? 'PAID' : String(invoice.status).toUpperCase()}</span>`;
  const bandLogo = co.logoUrl
    ? `<img src="${co.logoUrl}" alt="${co.name}" style="height:40px;width:auto;background:#fff;border-radius:8px;padding:4px;" />`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#ffffff;color:#2563eb;font-weight:800;font-size:20px;line-height:44px;text-align:center;font-family:Arial,sans-serif;">${co.name.charAt(0)}</div>`;

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 720px; margin: 0 auto; color: #1e293b; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">

    <!-- Brand band -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#2563eb;color:#fff;">
      <tr>
        <td style="padding:22px 28px;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:12px;">${bandLogo}</td>
            <td style="vertical-align:middle;">
              <div style="font-size:18px;font-weight:800;line-height:1.2;">${co.name}</div>
              <div style="font-size:12px;color:#dbeafe;">Get4Domain · get4domain.com</div>
            </td>
          </tr></table>
        </td>
        <td align="right" style="padding:22px 28px;vertical-align:middle;">
          <div style="font-size:22px;font-weight:800;letter-spacing:1px;">TAX INVOICE</div>
          <div style="font-size:13px;color:#dbeafe;">${invoice.invoiceNumber}</div>
        </td>
      </tr>
    </table>

    <!-- Meta strip -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <tr>
        <td style="padding:12px 28px;font-size:12px;color:#475569;">
          <strong style="color:#0f172a;">Invoice Date:</strong> ${formatDate(invoice.createdAt)}
          &nbsp;&nbsp;·&nbsp;&nbsp;<strong style="color:#0f172a;">Due:</strong> ${formatDate(invoice.dueDate)}
        </td>
        <td align="right" style="padding:12px 28px;">${statusBadge}</td>
      </tr>
    </table>

    <div style="padding:24px 28px;">
      <!-- From / Bill To -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
        <tr>
          <td style="vertical-align:top;width:50%;">
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">From</div>
            <div style="font-weight:700;">${co.name}</div>
            <div style="font-size:13px;color:#475569;">${co.address}</div>
            <div style="font-size:13px;color:#475569;">GSTIN: ${co.gstin} · PAN: ${co.pan}</div>
            <div style="font-size:13px;color:#475569;">${co.phone} · ${co.email}</div>
          </td>
          <td style="vertical-align:top;width:50%;" align="right">
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Billed To</div>
            <div style="font-weight:700;">${vendor.businessName}</div>
            <div style="font-size:13px;color:#475569;">${vendor.name}</div>
            <div style="font-size:13px;color:#475569;">${vendor.email}</div>
            ${vendor.phone ? `<div style="font-size:13px;color:#475569;">${vendor.phone}</div>` : ''}
          </td>
        </tr>
      </table>

      <!-- Line items -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;">
        <thead>
          <tr style="background:#0f172a;color:#fff;">
            <th align="left" style="padding:10px 12px;font-size:12px;">Description</th>
            <th align="right" style="padding:10px 12px;font-size:12px;">Price</th>
            <th align="right" style="padding:10px 12px;font-size:12px;">Discount</th>
            <th align="right" style="padding:10px 12px;font-size:12px;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="width:55%;"></td>
          <td style="width:45%;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
              ${hasDiscount ? `
              <tr><td style="padding:5px 0;color:#64748b;">Subtotal</td><td align="right" style="padding:5px 0;">${formatCurrency(grossSubtotal)}</td></tr>
              <tr><td style="padding:5px 0;color:#64748b;">Discount</td><td align="right" style="padding:5px 0;color:#16a34a;">– ${formatCurrency(discountTotal)}</td></tr>` : ''}
              <tr><td style="padding:5px 0;color:#64748b;">Taxable Value</td><td align="right" style="padding:5px 0;">${formatCurrency(invoice.amount)}</td></tr>
              <tr><td style="padding:5px 0;color:#64748b;">GST (18%)</td><td align="right" style="padding:5px 0;">${formatCurrency(invoice.gstAmount)}</td></tr>
              <tr><td style="padding:10px 12px;background:#2563eb;color:#fff;font-weight:800;border-radius:8px 0 0 8px;">Grand Total</td><td align="right" style="padding:10px 12px;background:#2563eb;color:#fff;font-weight:800;border-radius:0 8px 8px 0;">${formatCurrency(invoice.totalAmount)}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
        <tr>
          <td style="font-size:12px;color:#475569;"><span style="color:#94a3b8;text-transform:uppercase;font-size:11px;letter-spacing:.5px;">Payment Method</span><br/>${paymentMode}${paidNote}</td>
        </tr>
      </table>

      ${renewalNote}

      <div style="font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px;">
        <strong>Terms &amp; Conditions:</strong> Payment is due by the date specified above. Late payments may result in
        service suspension. All amounts are in Indian Rupees (INR) and inclusive of applicable GST. Wallet credits are
        valid for 90 days from top-up and are non-refundable once consumed. This is a system-generated tax invoice.
      </div>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;font-size:11px;color:#94a3b8;text-align:center;">
      ${co.name} &middot; ${co.address} &middot; ${co.phone} &middot; ${co.email}<br/>
      This is a computer-generated invoice and does not require a signature.
    </div>
  </div>
  `;
}
