import { cleanText } from '../../v3-pack-records/core/record-core';
import { normalizeModules, TeamArea } from '../../team/team-access';

/**
 * Pure rules of the Wave 2 Part B vendor gap routes. No clock, no randomness, no database. Product text: no timeframes, "enquiries" not "leads", never an internal product word, prices exclude GST,
 * and a PENDING price is never a number.
 */

// ── B4: the five groups of the vendor app bar (Amendment 14 F3) ───────────────────────────────────────────────────────────────────────────────────────
export const BAR_GROUPS = ['home', 'business', 'grow', 'money', 'more'] as const;
export type BarGroup = (typeof BAR_GROUPS)[number];
/** The COMMON tabs and the group each sits in. DATA: move a key here, not a branch in code. Pack, capability and add-on tabs are the business's own work and sit in Business. */
export const COMMON_TAB_GROUP: Readonly<Record<string, BarGroup>> = {
  industry: 'business', crm: 'business', telecrm: 'business',
  website: 'grow', promotion: 'grow', social: 'grow', ai_studio: 'grow', domain: 'grow',
  billing: 'money', accounting: 'money',
  support: 'more', plan: 'more', migration: 'more',
};
export function barGroupOf(scope: 'COMMON' | 'PACK' | 'CAPABILITY' | 'ADDON', key: string): BarGroup {
  if (scope !== 'COMMON') return 'business';
  return COMMON_TAB_GROUP[key] ?? 'business';
}

// ── B5: next steps from real state ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface NextStepFacts {
  /** a published site exists */
  sitePublished: boolean;
  /** the draft has been started (a revision beyond the empty one) */
  draftStarted: boolean;
  /** what the latest build says is missing from the site, as plain labels */
  missingDetails: string[];
  /** a plan order was started and is waiting for payment */
  unpaidPlanOrder: boolean;
  /** a custom domain was added and is not yet connected (its hostname) */
  unconnectedDomain: string | null;
  /** Wave 3 Part G: the business is on a Free plan (a paid plan is what moves it on). Absent or false = no prompt. */
  onFreePlan?: boolean;
}
export interface NextStep { id: string; text: string; route: string; /** who may see it: a team member needs the area, the owner sees all */ area: TeamArea | 'OWNER' }

/** At most 5 steps, in the order a vendor would do them. No number, no price, no date: only what is true now. */
export function nextSteps(f: NextStepFacts): NextStep[] {
  const out: NextStep[] = [];
  if (!f.sitePublished) out.push({ id: 'publish_site', text: f.draftStarted ? 'Your website is ready to look over and publish.' : 'Start your website.', route: '/website', area: 'website' });
  if (f.missingDetails.length > 0) {
    const shown = f.missingDetails.slice(0, 3).join(', ');
    out.push({ id: 'site_details', text: `Add the missing details to your website: ${shown}${f.missingDetails.length > 3 ? ' and more' : ''}.`, route: '/website', area: 'website' });
  }
  if (f.unpaidPlanOrder) out.push({ id: 'plan_payment', text: 'Finish paying for your plan.', route: '/plan', area: 'OWNER' });
  if (f.unconnectedDomain) out.push({ id: 'connect_domain', text: `Finish connecting ${f.unconnectedDomain}.`, route: '/domain', area: 'OWNER' });
  // the conversion prompt: only for a business on a Free plan with no payment already waiting, last in the list, with no price in it
  if (f.onFreePlan === true && !f.unpaidPlanOrder) out.push({ id: 'move_to_paid_plan', text: 'Your website is on the Free plan. Move to a paid plan when you are ready to unlock more of your business tools.', route: '/plan', area: 'OWNER' });
  return out.slice(0, 5);
}

// ── B8: promotion and social drafts ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const PROMO_KINDS = ['PROMOTION', 'SOCIAL'] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];
/** The channels a draft may be written for. Nothing is ever posted: a channel only labels the draft. */
export const PROMO_CHANNELS: Readonly<Record<PromoKind, readonly string[]>> = {
  PROMOTION: ['OFFER', 'ANNOUNCEMENT', 'FESTIVAL'],
  SOCIAL: ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'GOOGLE_BUSINESS', 'WHATSAPP_STATUS'],
};
export const PROMO_LIMITS = { title: 120, body: 2000 } as const;

export function checkPromoDraft(kind: PromoKind, input: { channel?: unknown; title?: unknown; body?: unknown }): { ok: true; value: { channel: string; title: string; body: string } } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const channel = typeof input.channel === 'string' && PROMO_CHANNELS[kind].includes(input.channel) ? input.channel : null;
  if (!channel) errors.channel = 'Pick one of the listed channels.';
  const title = cleanText(input.title, PROMO_LIMITS.title, false); if (!title.ok) errors.title = title.error; else if (title.value.length === 0) errors.title = 'This is required.';
  const body = cleanText(input.body, PROMO_LIMITS.body, true); if (!body.ok) errors.body = body.error; else if (body.value.length === 0) errors.body = 'This is required.';
  if (Object.keys(errors).length || !channel || !title.ok || !body.ok) return { ok: false, errors };
  return { ok: true, value: { channel, title: title.value, body: body.value } };
}

// ── B9: team ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The vendor's own departments. These are NOT staff roles (SALES, SUPPORT, OPERATIONS, ADMIN, SUPER_ADMIN stay Get4Domain's). */
export const VENDOR_DEPARTMENTS = ['Sales', 'Support', 'Accounts', 'Marketing'] as const;
export type VendorDepartment = (typeof VENDOR_DEPARTMENTS)[number];
/** The areas a department opens by default (the owner can change them per person). Wallet, plan and billing, settings and team stay with the owner and are never offered. */
export const DEPARTMENT_AREAS: Readonly<Record<VendorDepartment, readonly TeamArea[]>> = {
  Sales: ['telecrm', 'communication', 'reports'],
  Support: ['communication', 'telecrm'],
  Accounts: ['accounts', 'reports'],
  Marketing: ['campaigns', 'website', 'ai_studio', 'reports'],
};
/** Areas a vendor may hand to a team member. Wallet is the owner's. */
export const OFFERED_AREAS: readonly TeamArea[] = ['telecrm', 'campaigns', 'communication', 'accounts', 'website', 'reports', 'ai_studio'];

export interface TeamInviteInput { name?: unknown; email?: unknown; phone?: unknown; role?: unknown; department?: unknown; areas?: unknown }
export function checkTeamInvite(input: TeamInviteInput): { ok: true; value: { name: string; email: string | null; phone: string | null; role: string; department: VendorDepartment | null; areas: TeamArea[] } } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = cleanText(input.name, 80, false); if (!name.ok) errors.name = name.error; else if (name.value.length < 2) errors.name = 'Enter the name.';
  const role = cleanText(input.role, 60, false); if (!role.ok) errors.role = role.error; else if (role.value.length === 0) errors.role = 'Enter the role.';
  const email = typeof input.email === 'string' && input.email.trim() !== '' ? input.email.trim().toLowerCase() : null;
  if (input.email !== undefined && input.email !== null && input.email !== '' && (email === null || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) errors.email = 'Enter an email address.';
  const phoneRaw = typeof input.phone === 'string' ? input.phone.replace(/[\s-]/g, '') : '';
  if (input.phone !== undefined && input.phone !== null && input.phone !== '' && !/^\+?\d{7,15}$/.test(phoneRaw)) errors.phone = 'Enter a phone number with 7 to 15 digits.';
  if (!email && !phoneRaw) errors.email = errors.email ?? 'Give an email address or a phone number.';
  const department = input.department === undefined || input.department === null || input.department === '' ? null : (VENDOR_DEPARTMENTS as readonly string[]).includes(String(input.department)) ? (input.department as VendorDepartment) : undefined;
  if (department === undefined) errors.department = 'Pick Sales, Support, Accounts or Marketing.';
  const areas = checkAreas(input.areas, department && department !== undefined ? department : null); if (!areas.ok) errors.areas = areas.error;
  if (Object.keys(errors).length || !name.ok || !role.ok || !areas.ok || department === undefined) return { ok: false, errors };
  return { ok: true, value: { name: name.value, email, phone: phoneRaw || null, role: role.value, department, areas: areas.value } };
}

/** Areas sent by the owner, or the department's default when none were sent. Only the offered areas are accepted. */
export function checkAreas(input: unknown, department: VendorDepartment | null): { ok: true; value: TeamArea[] } | { ok: false; error: string } {
  if (input === undefined || input === null) return { ok: true, value: department ? [...DEPARTMENT_AREAS[department]] : [] };
  if (!Array.isArray(input) || input.length > OFFERED_AREAS.length) return { ok: false, error: 'Send the areas as a list.' };
  const areas = normalizeModules(input);
  if (areas.length !== new Set(input.map((x) => String(x).trim().toLowerCase())).size || areas.some((a) => !OFFERED_AREAS.includes(a))) return { ok: false, error: 'Pick from the areas offered.' };
  return { ok: true, value: areas };
}

// ── B6: the plan invoice as a page ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const esc = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string));
const rupees = (paise: unknown): string => (typeof paise === 'number' && Number.isFinite(paise) ? `Rs ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '');
const day = (v: unknown): string => { const d = new Date(String(v ?? '')); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };

export interface InvoiceForPage { invoiceNumber: string; financialYear: string; issuedAt: Date | string; snapshot: Record<string, unknown>; taxBreakdown: Record<string, unknown> }
/** The invoice as a self-contained HTML page, from the stored snapshot only (no live data). Every value is escaped. Prices are shown with the tax lines the snapshot recorded. */
/** How it was paid, from the stored snapshot: the gateway and its payment id, or the cash receipt reference. Nothing is printed for an invoice that has no payment block. */
function paymentNote(p: { method?: unknown; gateway?: unknown; reference?: unknown; receivedOn?: unknown } | undefined): string {
  if (!p || (typeof p.reference !== 'string' && p.method !== 'CASH')) return '';
  const ref = typeof p.reference === 'string' && p.reference ? esc(p.reference) : '';
  if (p.method === 'CASH') return `<p class="muted">Paid in cash${ref ? `. Receipt reference ${ref}` : ''}${typeof p.receivedOn === 'string' ? `. Received ${esc(p.receivedOn)}` : ''}</p>`;
  const gw = p.gateway === 'cashfree' ? 'Cashfree' : p.gateway === 'razorpay' ? 'Razorpay' : 'the payment gateway';
  return `<p class="muted">Paid through ${esc(gw)}${ref ? `. Payment reference ${ref}` : ''}</p>`;
}

export function renderInvoiceHtml(inv: InvoiceForPage): string {
  const s = inv.snapshot as { seller?: Record<string, unknown>; buyer?: Record<string, unknown>; plan?: Record<string, unknown>; period?: Record<string, unknown>; amountPaise?: unknown; termMonths?: unknown; payment?: { method?: unknown; gateway?: unknown; reference?: unknown; receivedOn?: unknown } };
  const t = inv.taxBreakdown as { name?: unknown; ratePercent?: unknown; taxableMinor?: unknown; taxMinor?: unknown; creditPaise?: unknown; taxInclusive?: unknown };
  const rows: string[] = [];
  if (typeof t.taxableMinor === 'number') rows.push(`<tr><td>Amount before tax</td><td class="n">${esc(rupees(t.taxableMinor))}</td></tr>`);
  if (typeof t.taxMinor === 'number' && t.taxMinor > 0) rows.push(`<tr><td>${esc(t.name ?? 'Tax')}${typeof t.ratePercent === 'number' ? ` at ${esc(t.ratePercent)}%` : ''}</td><td class="n">${esc(rupees(t.taxMinor))}</td></tr>`);
  if (typeof t.creditPaise === 'number' && t.creditPaise > 0) rows.push(`<tr><td>Credit applied</td><td class="n">${esc(rupees(t.creditPaise))}</td></tr>`);
  const gstin = s.seller?.gstin ? `<div>GSTIN ${esc(s.seller.gstin)}</div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Invoice ${esc(inv.invoiceNumber)}</title>`
    + '<style>body{font:14px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:42rem;padding:0 1rem;color:#111}h1{font-size:1.25rem}table{width:100%;border-collapse:collapse;margin-top:1rem}td{padding:.4rem 0;border-bottom:1px solid #ddd}.n{text-align:right}.total td{font-weight:700;border-bottom:2px solid #111}.muted{color:#555}</style></head><body>'
    + `<h1>Invoice ${esc(inv.invoiceNumber)}</h1><div class="muted">Issued ${esc(day(inv.issuedAt))} · Financial year ${esc(inv.financialYear)}</div>`
    + `<p><strong>${esc(s.seller?.name)}</strong><br>${esc(s.seller?.address)}${gstin}</p>`
    + `<p><strong>Billed to</strong><br>${esc(s.buyer?.businessName ?? s.buyer?.name)}<br>${esc(s.buyer?.email)}</p>`
    + `<table><tr><td>${esc(s.plan?.name)} plan, ${esc(s.termMonths)} months<div class="muted">${esc(day(s.period?.from))} to ${esc(day(s.period?.to))}</div></td><td class="n"></td></tr>${rows.join('')}`
    + `<tr class="total"><td>Total paid</td><td class="n">${esc(rupees(s.amountPaise))}</td></tr></table>${paymentNote(s.payment)}</body></html>`;
}
