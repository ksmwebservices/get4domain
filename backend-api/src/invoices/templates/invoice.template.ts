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
    logoUrl: c?.logoUrl ?? process.env.COMPANY_LOGO_URL ?? null,
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

  const logo = co.logoUrl
    ? `<img src="${co.logoUrl}" alt="${co.name}" style="height:44px;width:auto;" />`
    : `<div style="width: 48px; height: 48px; border-radius: 8px; background: linear-gradient(135deg,#2563eb,#3b82f6); display: inline-block;"></div>`;

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

  return `
  <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #1e293b;">
    <table width="100%" style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
      <tr>
        <td>
          ${logo}
          <div style="font-size: 20px; font-weight: 700; margin-top: 8px;">${co.name}</div>
          <div style="font-size: 13px; color: #64748b;">Brand: Get4Domain — get4domain.com</div>
        </td>
        <td align="right" style="vertical-align: top;">
          <div style="font-size: 22px; font-weight: 700; color: #2563eb;">TAX INVOICE</div>
          <div style="font-size: 13px; color: #64748b;">${invoice.invoiceNumber}</div>
        </td>
      </tr>
    </table>

    <table width="100%" style="margin-bottom: 24px;">
      <tr>
        <td style="vertical-align: top; width: 50%;">
          <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Billed To</div>
          <div style="font-weight: 600;">${vendor.businessName}</div>
          <div>${vendor.name}</div>
          <div>${vendor.email}</div>
          ${vendor.phone ? `<div>${vendor.phone}</div>` : ''}
        </td>
        <td style="vertical-align: top; width: 50%;" align="right">
          <div><strong>Invoice Date:</strong> ${formatDate(invoice.createdAt)}</div>
          <div><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</div>
          <div><strong>GSTIN:</strong> ${co.gstin}</div>
          <div><strong>PAN:</strong> ${co.pan}</div>
        </td>
      </tr>
    </table>

    <table width="100%" style="border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th align="left" style="padding: 10px; border: 1px solid #e2e8f0;">Description</th>
          <th align="right" style="padding: 10px; border: 1px solid #e2e8f0;">Price</th>
          <th align="right" style="padding: 10px; border: 1px solid #e2e8f0;">Discount</th>
          <th align="right" style="padding: 10px; border: 1px solid #e2e8f0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${hasDiscount ? `
        <tr>
          <td colspan="3" style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; color:#64748b;">Subtotal</td>
          <td align="right" style="padding: 8px 10px; border: 1px solid #e2e8f0;">${formatCurrency(grossSubtotal)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; color:#64748b;">Discount</td>
          <td align="right" style="padding: 8px 10px; border: 1px solid #e2e8f0;">– ${formatCurrency(discountTotal)}</td>
        </tr>` : ''}
        <tr>
          <td colspan="3" style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; color:#64748b;">Taxable Value</td>
          <td align="right" style="padding: 8px 10px; border: 1px solid #e2e8f0;">${formatCurrency(invoice.amount)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; color:#64748b;">GST (18%)</td>
          <td align="right" style="padding: 8px 10px; border: 1px solid #e2e8f0;">${formatCurrency(invoice.gstAmount)}</td>
        </tr>
        <tr style="font-weight: 700; background: #f8fafc;">
          <td colspan="3" style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">Grand Total</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0;">${formatCurrency(invoice.totalAmount)}</td>
        </tr>
      </tbody>
    </table>

    ${renewalNote}

    <div style="margin-bottom: 24px;">
      <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Payment Method</div>
      <div>${paymentMode}${paidNote}</div>
    </div>

    <div style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 16px;">
      <strong>Terms &amp; Conditions:</strong> Payment is due by the date specified above. Late payments may result in
      service suspension. All amounts are in Indian Rupees (INR) and inclusive of applicable GST. Wallet credits are
      valid for 90 days from top-up and are non-refundable once consumed. This is a system-generated tax invoice.
    </div>

    <div style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px;">
      ${co.name} &middot; ${co.address} &middot; ${co.phone} &middot; ${co.email}<br/>
      This is a computer generated invoice and does not require a signature.
    </div>
  </div>
  `;
}
