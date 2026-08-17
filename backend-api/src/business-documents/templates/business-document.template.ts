/**
 * Business-document templates — letterhead / visiting card / ID card.
 *
 * These are CODED HTML layouts (NOT AI-generated, NOT Canva) with the vendor's
 * details slotted in — the same "coded HTML → browser print-to-PDF" mechanism the
 * invoice PDF uses (see invoices/templates/invoice.template.ts + invoices.service
 * .generatePDF). A different mechanism per document type is the point of the AI
 * Studio redesign: these fixed layouts must look crisp and professional, which an
 * image model can't guarantee.
 */

export type BusinessDocType = 'letterhead' | 'visiting_card' | 'id_card';

/** Flat value map, keyed by the field `key`s the frontend form collects. */
export interface BusinessDocValues {
  business?: string;
  person?: string;
  designation?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  tagline?: string;
}

export interface BusinessDocBrand {
  /** Primary brand colour (hex). Defaults to the Get4Domain blue. */
  color?: string;
  /** Vendor logo URL (optional). */
  logoUrl?: string | null;
}

const esc = (s: string | undefined): string =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function logoMark(brand: string, business: string, logoUrl?: string | null, size = 44): string {
  if (logoUrl) {
    return `<img src="${esc(logoUrl)}" alt="${esc(business)}" style="height:${size}px;width:auto;max-width:${size * 3}px;object-fit:contain;" />`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:10px;background:${brand};color:#fff;font-weight:800;font-size:${Math.round(size / 2)}px;line-height:${size}px;text-align:center;font-family:Arial,sans-serif;">${esc((business || '?').charAt(0).toUpperCase())}</div>`;
}

const FONT = `font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color:#0f172a;`;

function letterhead(v: BusinessDocValues, brand: string, logoUrl?: string | null): string {
  return `<div style="${FONT} max-width:760px;margin:0 auto;background:#fff;">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:28px 36px;border-bottom:4px solid ${brand};">
      <div style="display:flex;align-items:center;gap:14px;">
        ${logoMark(brand, v.business ?? '', logoUrl, 52)}
        <div>
          <div style="font-size:26px;font-weight:800;color:${brand};line-height:1.1;">${esc(v.business)}</div>
          ${v.tagline ? `<div style="font-size:12px;color:#64748b;margin-top:3px;">${esc(v.tagline)}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;font-size:12px;color:#475569;line-height:1.6;">
        ${v.phone ? `${esc(v.phone)}<br/>` : ''}${v.email ? `${esc(v.email)}<br/>` : ''}${v.website ? `${esc(v.website)}` : ''}
      </div>
    </div>
    <div style="min-height:560px;padding:44px 36px;color:#334155;font-size:14px;line-height:1.9;">
      Date: _________________<br/><br/>
      Dear _________________,<br/><br/>
      <span style="color:#94a3b8;">[ Your letter content goes here. This branded letterhead is ready to print or save as PDF. ]</span>
    </div>
    <div style="border-top:1px solid #e2e8f0;padding:16px 36px;text-align:center;font-size:11px;color:#94a3b8;">
      ${esc(v.business)}${v.address ? ` · ${esc(v.address)}` : ''}${v.phone ? ` · ${esc(v.phone)}` : ''}${v.email ? ` · ${esc(v.email)}` : ''}
    </div>
  </div>`;
}

function visitingCard(v: BusinessDocValues, brand: string, logoUrl?: string | null): string {
  // Standard business-card proportions (3.5in × 2in) — front + back.
  return `<div style="${FONT} display:flex;gap:24px;flex-wrap:wrap;justify-content:center;">
    <div style="width:350px;height:200px;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 6px 20px rgba(0,0,0,.08);padding:22px;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:10px;">
        ${logoMark(brand, v.business ?? '', logoUrl, 40)}
        <div style="font-size:19px;font-weight:800;color:${brand};line-height:1.05;">${esc(v.business)}</div>
      </div>
      <div>
        <div style="font-size:16px;font-weight:700;">${esc(v.person)}</div>
        ${v.designation ? `<div style="font-size:12px;color:${brand};font-weight:600;">${esc(v.designation)}</div>` : ''}
      </div>
      <div style="font-size:11px;color:#475569;line-height:1.7;">
        ${v.phone ? `☎ ${esc(v.phone)}` : ''}${v.email ? `&nbsp;&nbsp;✉ ${esc(v.email)}` : ''}
        ${v.address ? `<br/>📍 ${esc(v.address)}` : ''}${v.website ? `<br/>🌐 ${esc(v.website)}` : ''}
      </div>
    </div>
    <div style="width:350px;height:200px;border-radius:14px;background:${brand};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 20px rgba(0,0,0,.08);box-sizing:border-box;padding:20px;text-align:center;">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="" style="height:40px;width:auto;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);" />` : ''}
      <div style="font-size:22px;font-weight:800;">${esc(v.business)}</div>
      ${v.tagline ? `<div style="font-size:12px;opacity:.9;">${esc(v.tagline)}</div>` : ''}
    </div>
  </div>`;
}

function idCard(v: BusinessDocValues, brand: string, logoUrl?: string | null): string {
  // Portrait ID-card proportions (roughly CR80 portrait).
  return `<div style="${FONT} width:300px;margin:0 auto;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.10);background:#fff;">
    <div style="background:${brand};color:#fff;padding:18px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="" style="height:34px;width:auto;max-width:150px;object-fit:contain;filter:brightness(0) invert(1);" />` : ''}
      <div style="font-weight:800;font-size:17px;">${esc(v.business)}</div>
    </div>
    <div style="padding:22px 20px;text-align:center;">
      <div style="width:104px;height:104px;border-radius:50%;background:#f1f5f9;border:3px solid ${brand};margin:0 auto;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">PHOTO</div>
      <div style="font-size:19px;font-weight:800;margin-top:14px;">${esc(v.person)}</div>
      ${v.designation ? `<div style="font-size:13px;color:${brand};font-weight:600;">${esc(v.designation)}</div>` : ''}
      <div style="font-size:12px;color:#475569;margin-top:12px;line-height:1.7;">
        ${v.phone ? `${esc(v.phone)}<br/>` : ''}${v.email ? `${esc(v.email)}` : ''}
      </div>
    </div>
    <div style="background:#f8fafc;padding:10px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      ${esc(v.address || v.business)}
    </div>
  </div>`;
}

export function renderBusinessDocument(
  type: BusinessDocType,
  values: BusinessDocValues,
  brand: BusinessDocBrand = {},
): string {
  const color = brand.color && /^#[0-9a-fA-F]{3,8}$/.test(brand.color) ? brand.color : '#2563eb';
  const logo = brand.logoUrl ?? null;
  if (type === 'letterhead') return letterhead(values, color, logo);
  if (type === 'visiting_card') return visitingCard(values, color, logo);
  return idCard(values, color, logo);
}
