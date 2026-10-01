import { Quote } from '@prisma/client';

const formatCurrency = (paise: number): string => `Rs. ${(paise / 100).toFixed(2)}`;

const formatDate = (date: Date | null): string =>
  date ? new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const GST_RATE = 0.18;

export interface ProposalCompany {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string | null;
}

export interface ProposalLineItem {
  label: string;
  description?: string;
  qty: number;
  unit?: string; // e.g. "months", "one-time"
  rate: number; // paise, per unit
  notes?: string;
}

export interface ProposalRenderOpts {
  company?: Partial<ProposalCompany>;
  includeGst?: boolean;
  /** Admin-editable terms paragraph — KSM can change this text later. */
  terms?: string;
}

// Standard terms placeholder (dispatch 01-Oct-2026: "KSM can edit the template
// later"). Kept as one named constant so it's easy to find and change.
export const DEFAULT_PROPOSAL_TERMS =
  'This proposal is valid for 30 days from the date above. 50% advance is payable to commence work, with the balance due on delivery/milestone completion as agreed. Scope changes beyond what is itemised here will be quoted separately. All amounts are in Indian Rupees and inclusive of applicable GST unless stated otherwise.';

function resolveCompany(c?: Partial<ProposalCompany>): ProposalCompany {
  return {
    name: c?.name ?? process.env.COMPANY_NAME ?? 'Get4Domain',
    address: c?.address ?? process.env.COMPANY_ADDRESS ?? 'Tidel Park, D Block, Tharamani, Chennai 600113',
    phone: c?.phone ?? process.env.COMPANY_PHONE ?? '',
    email: c?.email ?? process.env.COMPANY_EMAIL ?? 'admin@get4domain.com',
    logoUrl: c?.logoUrl ?? process.env.COMPANY_LOGO_URL ?? 'https://get4domain.com/logo.png',
  };
}

export function renderProposalHtml(quote: Quote, items: ProposalLineItem[], opts: ProposalRenderOpts = {}): string {
  const co = resolveCompany(opts.company);
  const includeGst = opts.includeGst ?? true;
  const terms = opts.terms ?? DEFAULT_PROPOSAL_TERMS;

  const lineTotal = (i: ProposalLineItem) => i.qty * i.rate;
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const gstAmount = includeGst ? Math.round(subtotal * GST_RATE) : 0;
  const grandTotal = subtotal + gstAmount;

  const itemRows = items.map((i) => `
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <div style="font-weight:600;">${i.label}</div>
            ${i.description ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${i.description}</div>` : ''}
            ${i.notes ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;font-style:italic;">${i.notes}</div>` : ''}
          </td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0; white-space:nowrap;">${i.qty}${i.unit ? ` ${i.unit}` : ''}</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0; white-space:nowrap;">${formatCurrency(i.rate)}</td>
          <td align="right" style="padding: 10px; border: 1px solid #e2e8f0; white-space:nowrap;">${formatCurrency(lineTotal(i))}</td>
        </tr>`).join('');

  const statusLabel = quote.status.charAt(0).toUpperCase() + quote.status.slice(1);
  const statusColor: Record<string, string> = {
    draft: 'background:#f1f5f9;color:#475569;',
    sent: 'background:#fef3c7;color:#92400e;',
    accepted: 'background:#dcfce7;color:#166534;',
    declined: 'background:#fee2e2;color:#991b1b;',
    viewed: 'background:#dbeafe;color:#1e40af;',
  };
  const statusBadge = `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.4px;${statusColor[quote.status] ?? statusColor.draft}">${statusLabel.toUpperCase()}</span>`;

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
              <div style="font-size:12px;color:#dbeafe;">Managed Services · get4domain.com</div>
            </td>
          </tr></table>
        </td>
        <td align="right" style="padding:22px 28px;vertical-align:middle;">
          <div style="font-size:22px;font-weight:800;letter-spacing:1px;">PROPOSAL</div>
          <div style="font-size:13px;color:#dbeafe;">${quote.id}</div>
        </td>
      </tr>
    </table>

    <!-- Meta strip -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <tr>
        <td style="padding:12px 28px;font-size:12px;color:#475569;">
          <strong style="color:#0f172a;">Date:</strong> ${formatDate(quote.createdAt)}
        </td>
        <td align="right" style="padding:12px 28px;">${statusBadge}</td>
      </tr>
    </table>

    <div style="padding:24px 28px;">
      <!-- From / Prepared For -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
        <tr>
          <td style="vertical-align:top;width:50%;">
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">From</div>
            <div style="font-weight:700;">${co.name}</div>
            <div style="font-size:13px;color:#475569;">${co.address}</div>
            <div style="font-size:13px;color:#475569;">${co.phone} · ${co.email}</div>
          </td>
          <td style="vertical-align:top;width:50%;" align="right">
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Prepared For</div>
            <div style="font-weight:700;">${quote.prospectName}</div>
            ${quote.prospectEmail ? `<div style="font-size:13px;color:#475569;">${quote.prospectEmail}</div>` : ''}
            ${quote.prospectPhone ? `<div style="font-size:13px;color:#475569;">${quote.prospectPhone}</div>` : ''}
          </td>
        </tr>
      </table>

      <!-- Line items -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;">
        <thead>
          <tr style="background:#0f172a;color:#fff;">
            <th align="left" style="padding:10px 12px;font-size:12px;">Scope</th>
            <th align="right" style="padding:10px 12px;font-size:12px;">Qty</th>
            <th align="right" style="padding:10px 12px;font-size:12px;">Rate</th>
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
              <tr><td style="padding:5px 0;color:#64748b;">Subtotal</td><td align="right" style="padding:5px 0;">${formatCurrency(subtotal)}</td></tr>
              ${includeGst ? `<tr><td style="padding:5px 0;color:#64748b;">GST (18%)</td><td align="right" style="padding:5px 0;">${formatCurrency(gstAmount)}</td></tr>` : ''}
              <tr><td style="padding:10px 12px;background:#2563eb;color:#fff;font-weight:800;border-radius:8px 0 0 8px;">Total</td><td align="right" style="padding:10px 12px;background:#2563eb;color:#fff;font-weight:800;border-radius:0 8px 8px 0;">${formatCurrency(grandTotal)}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      ${quote.notes ? `<div style="margin-bottom:20px;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:13px;color:#1e40af;"><strong>Notes:</strong> ${quote.notes}</div>` : ''}

      <div style="font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px;">
        <strong>Terms:</strong> ${terms}
      </div>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;font-size:11px;color:#94a3b8;text-align:center;">
      ${co.name} &middot; ${co.address} &middot; ${co.phone} &middot; ${co.email}<br/>
      This is a system-generated proposal document.
    </div>
  </div>
  `;
}
