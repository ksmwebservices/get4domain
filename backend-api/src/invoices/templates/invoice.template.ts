import { Invoice, Vendor } from '@prisma/client';

const formatCurrency = (paise: number): string => `Rs. ${(paise / 100).toFixed(2)}`;

const formatDate = (date: Date | null): string =>
  date ? new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export function renderInvoiceHtml(invoice: Invoice, vendor: Vendor): string {
  const companyName = process.env.COMPANY_NAME ?? 'KSM Quantum Technologies';
  const companyGst = process.env.COMPANY_GST ?? 'GSTIN pending';
  const companyPan = process.env.COMPANY_PAN ?? 'PAN pending';
  const companyAddress = process.env.COMPANY_ADDRESS ?? 'Address pending';
  const companyPhone = process.env.COMPANY_PHONE ?? '';
  const companyEmail = process.env.COMPANY_EMAIL ?? 'admin@get4domain.com';

  return `
  <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #1e293b;">
    <table width="100%" style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
      <tr>
        <td>
          <div style="width: 48px; height: 48px; border-radius: 8px; background: linear-gradient(135deg,#2563eb,#3b82f6); display: inline-block;"></div>
          <div style="font-size: 20px; font-weight: 700; margin-top: 8px;">${companyName}</div>
          <div style="font-size: 13px; color: #64748b;">Brand: Get4Domain — get4domain.com</div>
        </td>
        <td align="right" style="vertical-align: top;">
          <div style="font-size: 22px; font-weight: 700; color: #2563eb;">INVOICE</div>
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
          <div><strong>GSTIN:</strong> ${companyGst}</div>
          <div><strong>PAN:</strong> ${companyPan}</div>
        </td>
      </tr>
    </table>

    <table width="100%" style="border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th align="left" style="padding: 10px; border: 1px solid #e2e8f0;">Description</th>
          <th align="right" style="padding: 10px; border: 1px solid #e2e8f0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">${invoice.description}</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0;">${formatCurrency(invoice.amount)}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">GST (18%)</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0;">${formatCurrency(invoice.gstAmount)}</td>
        </tr>
        <tr style="font-weight: 700; background: #f8fafc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0;">Total</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0;">${formatCurrency(invoice.totalAmount)}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-bottom: 24px;">
      <div style="font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Payment Method</div>
      <div>${invoice.status === 'PAID' ? `Razorpay — Paid on ${formatDate(invoice.paidAt)}` : 'Pending — Razorpay'}</div>
    </div>

    <div style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 16px;">
      <strong>Terms &amp; Conditions:</strong> Payment is due by the date specified above. Late payments may result in
      service suspension. All amounts are in Indian Rupees (INR) and inclusive of applicable GST.
    </div>

    <div style="font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px;">
      ${companyName} &middot; ${companyAddress} &middot; ${companyPhone} &middot; ${companyEmail}<br/>
      This is a computer generated invoice and does not require a signature.
    </div>
  </div>
  `;
}
