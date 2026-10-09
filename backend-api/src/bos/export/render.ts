import { BosDocument, BosDocumentLine, BosSettings } from '@prisma/client';

const esc = (s: string | null | undefined): string => (s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);
const inr = (p: number): string => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: Date | null | undefined): string => (d ? new Date(d.getTime() + 330 * 60_000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

const TITLE: Record<string, (d: BosDocument) => string> = {
  SALES_INVOICE: (d) => (d.taxKind === 'GST' ? 'Tax Invoice' : 'Bill of Supply'),
  QUOTE: () => 'Quotation', SALES_ORDER: () => 'Sales Order', CREDIT_NOTE: () => 'Credit Note', PURCHASE_BILL: () => 'Purchase Bill',
};

export interface Brand { name: string; logo?: string | null; phone?: string | null; email?: string | null; address?: string | null }

export interface RenderOptions {
  /** 80 mm till-roll layout. */
  thermal?: boolean;
  /** A "Pay now" link, only when the vendor has set up their OWN gateway. */
  payUrl?: string | null;
  /** Show the receipts/credits applied (internal view). */
  paidLine?: boolean;
}

/** A print-friendly page for every business document (the browser's "Save as PDF" makes the PDF). Vendor details come from their own settings. */
export function renderDocumentHtml(doc: BosDocument & { lines: BosDocumentLine[] }, brand: Brand, s: BosSettings, opts: RenderOptions = {}): string {
  const title = (TITLE[doc.docType] ?? (() => 'Document'))(doc);
  const gst = doc.taxKind === 'GST';
  const th = opts.thermal;
  const rows = doc.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}${l.variantKey ? `<br><small>${esc(l.variantKey)}</small>` : ''}${l.description ? `<br><small>${esc(l.description)}</small>` : ''}</td>${gst && !th ? `<td>${esc(l.hsn)}</td>` : ''}<td class="r">${l.qty}${l.unit ? ` ${esc(l.unit)}` : ''}</td><td class="r">${inr(l.ratePaise)}</td>${gst && !th ? `<td class="r">${l.gstRate}%</td>` : ''}<td class="r">${inr(l.taxablePaise + (doc.priceMode === 'INCLUSIVE' ? l.cgstPaise + l.sgstPaise + l.igstPaise : 0))}</td></tr>`).join('');
  const out = Math.max(0, doc.totalPaise - doc.paidPaise);
  const taxRows = gst ? [
    doc.intraState ? `<tr><td>CGST</td><td class="r">${inr(doc.cgstPaise)}</td></tr><tr><td>SGST</td><td class="r">${inr(doc.sgstPaise)}</td></tr>` : `<tr><td>IGST</td><td class="r">${inr(doc.igstPaise)}</td></tr>`,
  ].join('') : '';
  const width = th ? '300px' : '780px';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} ${esc(doc.number ?? '')}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:${width};margin:${th ? '0' : '24px'} auto;padding:${th ? '8px' : '0 12px'};font-size:${th ? '12px' : '14px'}}
h1{font-size:${th ? '15px' : '20px'};margin:0}table{width:100%;border-collapse:collapse}th,td{padding:${th ? '3px' : '8px'};border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}th{background:#f1f5f9;font-size:12px}.r{text-align:right}small{color:#64748b}.hd{display:flex;justify-content:space-between;gap:16px;margin-bottom:16px}.tot td{border:0;padding:3px 8px}.grand td{font-weight:700;font-size:${th ? '14px' : '16px'};border-top:2px solid #0f172a}.badge{display:inline-block;border:1px solid #94a3b8;border-radius:6px;padding:2px 8px;font-size:12px}.pay{display:inline-block;margin-top:12px;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700}.void{color:#b91c1c;font-weight:700}@media print{.pay,.noprint{display:none}body{margin:0}}</style></head><body>
<div class="hd"><div>${brand.logo ? `<img src="${esc(brand.logo)}" alt="" style="max-height:48px;margin-bottom:6px"><br>` : ''}<h1>${esc(s.legalName ?? brand.name)}</h1>${brand.address ? `<small>${esc(brand.address)}</small><br>` : ''}${brand.phone ? `<small>${esc(brand.phone)}</small> ` : ''}${brand.email ? `<small>${esc(brand.email)}</small>` : ''}${s.gstin ? `<br><small>GSTIN: ${esc(s.gstin)}</small>` : ''}</div>
<div class="r"><div style="font-size:${th ? '14px' : '18px'};font-weight:700">${esc(title)}</div>${doc.number ? `<div>${esc(doc.number)}</div>` : '<div><span class="badge">Draft</span></div>'}<div><small>Date: ${day(doc.docDate)}</small></div>${doc.dueDate ? `<div><small>Due: ${day(doc.dueDate)}</small></div>` : ''}${doc.status === 'CANCELLED' ? '<div class="void">CANCELLED</div>' : ''}</div></div>
<div style="margin-bottom:12px"><small>${doc.docType === 'PURCHASE_BILL' ? 'Supplier' : 'Bill to'}</small><br><b>${esc(doc.partyName ?? 'Walk-in customer')}</b>${doc.billingAddress ? `<br><small>${esc(doc.billingAddress)}</small>` : ''}${doc.partyGstin ? `<br><small>GSTIN: ${esc(doc.partyGstin)}</small>` : ''}${gst && doc.placeOfSupply ? `<br><small>Place of supply: ${esc(doc.placeOfSupply)}</small>` : ''}</div>
<table><thead><tr><th>#</th><th>Item</th>${gst && !th ? '<th>HSN/SAC</th>' : ''}<th class="r">Qty</th><th class="r">Rate</th>${gst && !th ? '<th class="r">GST</th>' : ''}<th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class="tot" style="margin-top:8px;max-width:${th ? '100%' : '320px'};margin-left:auto"><tr><td>Items total</td><td class="r">${inr(doc.subtotalPaise)}</td></tr>${doc.discountPaise ? `<tr><td>Discount</td><td class="r">- ${inr(doc.discountPaise)}</td></tr>` : ''}${doc.shippingPaise ? `<tr><td>Shipping</td><td class="r">${inr(doc.shippingPaise)}</td></tr>` : ''}${gst ? `<tr><td>Taxable value</td><td class="r">${inr(doc.taxablePaise)}</td></tr>` : ''}${taxRows}${doc.roundOffPaise ? `<tr><td>Round off</td><td class="r">${doc.roundOffPaise > 0 ? '' : '- '}${inr(Math.abs(doc.roundOffPaise))}</td></tr>` : ''}<tr class="grand"><td>Total</td><td class="r">₹${inr(doc.totalPaise)}</td></tr>${opts.paidLine !== false && doc.docType === 'SALES_INVOICE' && doc.paidPaise > 0 ? `<tr><td>Paid</td><td class="r">${inr(doc.paidPaise)}</td></tr><tr><td><b>Balance due</b></td><td class="r"><b>${inr(out)}</b></td></tr>` : ''}</table>
${doc.notes ? `<p><small>${esc(doc.notes)}</small></p>` : ''}
${doc.docType === 'SALES_INVOICE' && (s.bankDetails || s.upiId) ? `<p><small><b>Pay to:</b> ${esc(s.bankDetails)}${s.upiId ? ` · UPI ${esc(s.upiId)}` : ''}</small></p>` : ''}
${doc.terms ? `<p><small><b>Terms:</b> ${esc(doc.terms)}</small></p>` : ''}
${opts.payUrl && out > 0 ? `<a class="pay noprint" href="${esc(opts.payUrl)}">Pay ₹${inr(out)} now</a>` : ''}
<p class="noprint"><small>${gst ? 'This is a computer-generated tax invoice.' : 'Bill of supply: no GST is charged.'}</small></p></body></html>`;
}
