/**
 * Commercial Engine v1 — typed client for the admin, vendor and public-pay APIs.
 * No call here ever sends a payment amount: the server derives every amount from the invoice.
 */
import { apiCall } from './api';
import { planDisplayName } from './nav.generated';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

export type PlanKey = 'WORKSPACE' | 'BOS';
export type Cycle = 'MONTHLY' | 'HALF_YEARLY' | 'ANNUAL' | 'CUSTOM_MONTHS';
export type GstMode = 'EXCLUSIVE' | 'INCLUSIVE' | 'NONE';
export type Channel = 'RAZORPAY' | 'UPI_QR' | 'OFFLINE';
export type InvoiceKind = 'ACTIVATION' | 'RENEWAL' | 'PLAN_CHANGE' | 'ADDON' | 'MANAGED_SERVICE';

export const rupees = (paise: number | null | undefined): string => {
  const p = paise ?? 0;
  return `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: p % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
};
export const fmtDate = (d: string | Date | null | undefined): string =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const CYCLE_LABEL: Record<Cycle, string> = { MONTHLY: 'Monthly', HALF_YEARLY: 'Half-yearly', ANNUAL: 'Annual', CUSTOM_MONTHS: 'Custom months' };
export const PLAN_LABEL: Record<PlanKey, string> = { WORKSPACE: planDisplayName('WORKSPACE'), BOS: planDisplayName('BOS') };
export const GST_LABEL: Record<GstMode, string> = { EXCLUSIVE: 'GST on top (18%)', INCLUSIVE: 'GST included in price', NONE: 'No GST' };

export interface PricedLine { kind: 'PLAN' | 'ADDON' | 'CUSTOM' | 'CREDIT'; label: string; amountPaise: number; qty?: number }
export interface Totals { subtotalPaise: number; discountPaise: number; netPaise: number; taxablePaise: number; gstPaise: number; totalPaise: number }

export interface DealSpec {
  vendorId?: string;
  prospect?: { name?: string; phone?: string; email?: string; business?: string; demoSubdomain?: string };
  kind?: InvoiceKind;
  planKey?: PlanKey;
  billingCycle?: Cycle;
  customMonths?: number;
  addons?: { kind: 'ADDON' | 'CUSTOM'; label: string; amountPaise: number; qty?: number }[];
  discount?: { mode: 'NONE' | 'PERCENT' | 'FLAT' | 'PROMO'; value?: number; reason?: string; confirm?: string };
  promoCode?: string;
  gstMode: GstMode;
  graceDays?: number;
  allowedChannels?: Channel[];
  linkExpiryDays?: number;
  allowPromoEntry?: boolean;
  allowPromoStacking?: boolean;
  paymentDueDays?: number;
  /** AI Studio credit override in paise (₹0–₹5,000). Omit to use the server's prorated amount. */
  aiCreditPaise?: number;
  notes?: string;
}

export interface InvoiceRow {
  id: string; invoiceNumber: string; kind: InvoiceKind | null; description: string; status: string;
  amount: number; gstAmount: number; totalAmount: number; paidPaise: number; balanceDuePaise: number; overpaymentPaise: number;
  gstMode: GstMode; discountPaise: number; discountReason: string | null; planKey: PlanKey | null; billingCycle: Cycle | null;
  allowedChannels: Channel[]; dueDate: string | null; sentAt: string | null; paidAt: string | null; createdAt: string; tokenExpiresAt: string | null;
  periodStart: string | null; periodEnd: string | null; paidVia: Channel | null; lineItems: PricedLine[] | null;
  vendorId: string; vendor?: { id: string; businessName: string; name: string } | null;
}

export interface TermRow {
  id: string; vendorId: string; planKey: PlanKey; billingCycle: Cycle; cycleMonths: number; listAmountPaise: number; discountPaise: number; netAmountPaise: number;
  gstMode: GstMode; gstNote: string | null; periodStart: string | null; periodEnd: string | null; graceDays: number;
  status: 'DEMO' | 'ACTIVE' | 'ACTIVE_PAYMENT_DUE' | 'LAPSED' | 'CANCELLED'; source: 'STANDARD' | 'ADMIN_DEAL'; isCurrent: boolean;
  allowedChannels: Channel[]; scheduledNextPlan: PlanKey | null; scheduledNextCycle: Cycle | null; paymentDueAt: string | null; createdAt: string; createdBy: string | null;
  /** One-time AI Studio credit this term entitles the vendor to (null = prorated default). */
  aiCreditPaise: number | null;
}

/** `aiCreditAnnualPaise` is the ANNUAL list credit; what a vendor gets is prorated by term (see the term's aiCreditPaise). */
export interface Entitlements { aiCreditAnnualPaise: number; seoKeywords: number; themeChangesPerYear: number; whatsappBotReply: boolean; fullAccounting: boolean; hrm: boolean; inventory: boolean; taskManagement: boolean }

export interface PayView {
  invoice: {
    id?: string; number: string; kind: InvoiceKind; description: string; status: string;
    lines: PricedLine[]; subtotalPaise: number; discountPaise: number; discountReason: string | null; promoCode: string | null;
    gstMode: GstMode; gstNote?: string | null; gstForgonePaise?: number | null; taxablePaise: number; gstPaise: number; totalPaise: number; paidPaise: number; balanceDuePaise: number; overpaymentPaise: number;
    planKey: PlanKey | null; billingCycle: Cycle | null; periodStart: string | null; periodEnd: string | null; dueDate: string | null; paidAt: string | null; expiresAt: string | null;
  };
  business: { name: string };
  channels: { razorpay: boolean; upiQr: boolean; offline: boolean };
  razorpayKeyId?: string;
  allowPromoEntry: boolean;
  payee: { upiId: string | null; payeeName: string | null; qrImageUrl: string | null; instructions: string | null; bank: { bankName: string | null; accountName: string | null; accountNumber: string; ifsc: string | null; branch: string | null } | null } | null;
  submission: { status: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED'; submittedAt: string; reason?: string | null; utrTail: string } | null;
}

export interface UpiPayload { upiLink: string; qrDataUrl: string; upiId: string; payeeName: string | null; amountPaise: number; note: string; staticQrUrl: string | null }

/** The operations the shared pay panel needs — implemented once for the public token page and once for the dashboard. */
export interface PayApi {
  view(): Promise<PayView>;
  razorpayOrder(): Promise<{ orderId: string; amount: number; currency: string; keyId?: string }>;
  razorpayVerify(r: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }): Promise<{ verified: boolean; status: string }>;
  upi(): Promise<UpiPayload>;
  submitProof(form: FormData): Promise<{ submitted: boolean }>;
  applyPromo(code: string): Promise<{ applied: boolean; discountPaise: number; totalPaise: number }>;
  removePromo(): Promise<{ removed: boolean; totalPaise: number }>;
}

// ── public (no auth header, ever) ────────────────────────────────────────────────────────────────

async function publicCall<T>(path: string, init: RequestInit & { form?: boolean } = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init.form ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
    credentials: 'omit',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    const err = new Error(msg || 'Something went wrong. Please try again.') as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (body.data ?? body) as T;
}

export function publicPayApi(token: string): PayApi {
  const base = `/public/pay/${encodeURIComponent(token)}`;
  return {
    view: () => publicCall(base),
    razorpayOrder: () => publicCall(`${base}/razorpay/order`, { method: 'POST', body: '{}' }),
    razorpayVerify: (r) => publicCall(`${base}/razorpay/verify`, { method: 'POST', body: JSON.stringify(r) }),
    upi: () => publicCall(`${base}/upi`),
    submitProof: (form) => publicCall(`${base}/proof`, { method: 'POST', body: form, form: true }),
    applyPromo: (code) => publicCall(`${base}/promo`, { method: 'POST', body: JSON.stringify({ code }) }),
    removePromo: () => publicCall(`${base}/promo`, { method: 'DELETE' }),
  };
}

// ── vendor dashboard (authenticated) ─────────────────────────────────────────────────────────────

async function authForm<T>(path: string, form: FormData): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('g4d_token') : null;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((Array.isArray(body?.message) ? body.message.join(', ') : body?.message) || 'Could not submit');
  return (body.data ?? body) as T;
}

export function vendorPayApi(invoiceId: string): PayApi {
  const base = `/billing/invoices/${encodeURIComponent(invoiceId)}`;
  const unwrap = async <T,>(p: Promise<{ data: T }>): Promise<T> => (await p).data;
  return {
    view: () => unwrap(apiCall(`${base}/pay`)),
    razorpayOrder: () => unwrap(apiCall(`${base}/razorpay/order`, { method: 'POST', body: '{}' })),
    razorpayVerify: (r) => unwrap(apiCall(`${base}/razorpay/verify`, { method: 'POST', body: JSON.stringify(r) })),
    upi: () => unwrap(apiCall(`${base}/upi`)),
    submitProof: (form) => authForm(`${base}/proof`, form),
    applyPromo: (code) => unwrap(apiCall(`${base}/promo`, { method: 'POST', body: JSON.stringify({ code }) })),
    removePromo: () => unwrap(apiCall(`${base}/promo`, { method: 'DELETE' })),
  };
}

export interface VendorBilling {
  term: (Pick<TermRow, 'id' | 'planKey' | 'billingCycle' | 'cycleMonths' | 'status' | 'source' | 'netAmountPaise' | 'gstMode' | 'periodStart' | 'periodEnd' | 'graceDays' | 'paymentDueAt' | 'scheduledNextPlan' | 'scheduledNextCycle'> & { adminDeal: boolean; entitlements: Entitlements; aiCreditIncludedPaise: number }) | null;
  invoices: InvoiceRow[];
  planChangeRequests: { id: string; toPlanKey: PlanKey; toCycle: Cycle; toCycleMonths: number; effective: string; status: string; vendorNote: string | null; adminNote: string | null; requestedAt: string }[];
}

export const billingApi = {
  me: (): Promise<{ data: VendorBilling }> => apiCall('/billing/me'),
  invoicePdf: (id: string): Promise<{ data: { html: string } }> => apiCall(`/billing/invoices/${encodeURIComponent(id)}/pdf`),
  requestChange: (b: { toPlanKey: PlanKey; toCycle: Cycle; customMonths?: number; effective?: 'AT_RENEWAL' | 'NOW'; note?: string }) =>
    apiCall('/billing/plan-change-requests', { method: 'POST', body: JSON.stringify(b) }),
};

// ── admin ────────────────────────────────────────────────────────────────────────────────────────

const j = (b: unknown) => JSON.stringify(b);

export const commerceApi = {
  summary: (): Promise<{ data: { paymentsToConfirm: number; planChangeRequests: number } }> => apiCall('/admin/commerce/summary'),
  getPayee: () => apiCall('/admin/commerce/payee'),
  updatePayee: (b: Record<string, string | null>) => apiCall('/admin/commerce/payee', { method: 'PUT', body: j(b) }),
  previewPayee: (): Promise<{ data: { configured: boolean; upiLink?: string; qrDataUrl?: string } }> => apiCall('/admin/commerce/payee/preview'),

  preview: (spec: DealSpec): Promise<{ data: { lines: PricedLine[]; months: number | null; totals: Totals; discountReason: string | null; bigDiscount: boolean; promo: { id: string; code: string } | null } }> =>
    apiCall('/admin/commerce/deals/preview', { method: 'POST', body: j(spec) }),
  saveDraft: (spec: DealSpec & { dealId?: string }) => apiCall('/admin/commerce/deals/draft', { method: 'POST', body: j(spec) }),
  listDeals: (vendorId?: string) => apiCall(`/admin/commerce/deals${vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : ''}`),
  createInvoice: (spec: DealSpec & { dealId?: string; activateNow?: boolean; sendNow?: boolean; overrideReason?: string }): Promise<{ data: { invoice: InvoiceRow; payLink: string; dealId: string; vendorId: string } }> =>
    apiCall('/admin/commerce/deals/invoice', { method: 'POST', body: j(spec) }),

  listInvoices: (f: { status?: string; kind?: string; vendorId?: string; q?: string } = {}): Promise<{ data: InvoiceRow[] }> => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
    return apiCall(`/admin/commerce/invoices${qs ? `?${qs}` : ''}`);
  },
  getInvoice: (id: string) => apiCall(`/admin/commerce/invoices/${id}`),
  reissueLink: (id: string, b: { send?: boolean; expiryDays?: number } = {}): Promise<{ data: { payLink: string; sent?: { email: boolean; whatsapp: boolean } } }> =>
    apiCall(`/admin/commerce/invoices/${id}/link`, { method: 'POST', body: j(b) }),
  voidInvoice: (id: string, reason: string) => apiCall(`/admin/commerce/invoices/${id}/void`, { method: 'POST', body: j({ reason }) }),
  invoicePdf: (id: string): Promise<{ data: { html: string } }> => apiCall(`/admin/commerce/invoices/${id}/pdf`),

  listPayments: (status: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'ALL' = 'SUBMITTED') => apiCall(`/admin/commerce/payments?status=${status}`),
  confirmPayment: (id: string, receivedAmountPaise: number, note?: string) => apiCall(`/admin/commerce/payments/${id}/confirm`, { method: 'POST', body: j({ receivedAmountPaise, note }) }),
  rejectPayment: (id: string, reason: string) => apiCall(`/admin/commerce/payments/${id}/reject`, { method: 'POST', body: j({ reason }) }),
  /** The proof is a private file behind admin auth — fetched as a blob and shown via an object URL (never a public URL). */
  proofBlobUrl: async (id: string): Promise<string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('g4d_token') : null;
    const res = await fetch(`${API_BASE}/admin/commerce/payments/${id}/proof`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error('Could not load the screenshot');
    return URL.createObjectURL(await res.blob());
  },

  listPromos: () => apiCall('/admin/commerce/promos'),
  createPromo: (b: Record<string, unknown>) => apiCall('/admin/commerce/promos', { method: 'POST', body: j(b) }),
  updatePromo: (id: string, b: Record<string, unknown>) => apiCall(`/admin/commerce/promos/${id}`, { method: 'PUT', body: j(b) }),

  vendorBilling: (vendorId: string) => apiCall(`/admin/commerce/vendors/${vendorId}/billing`),
  overrideTerm: (vendorId: string, b: Record<string, unknown>) => apiCall(`/admin/commerce/vendors/${vendorId}/billing/override`, { method: 'POST', body: j(b) }),
  scheduleNext: (vendorId: string, b: { planKey: PlanKey; billingCycle: Cycle; customMonths?: number }) => apiCall(`/admin/commerce/vendors/${vendorId}/billing/schedule-next`, { method: 'POST', body: j(b) }),
  clearScheduled: (vendorId: string) => apiCall(`/admin/commerce/vendors/${vendorId}/billing/schedule-next`, { method: 'DELETE' }),

  planChanges: (status?: string) => apiCall(`/admin/commerce/plan-changes${status ? `?status=${status}` : ''}`),
  approvePlanChange: (id: string, b: { effective?: 'AT_RENEWAL' | 'NOW'; adminNote?: string; netPaise?: number; discountReason?: string; confirm?: string }) => apiCall(`/admin/commerce/plan-changes/${id}/approve`, { method: 'POST', body: j(b) }),
  rejectPlanChange: (id: string, reason: string) => apiCall(`/admin/commerce/plan-changes/${id}/reject`, { method: 'POST', body: j({ reason }) }),
  runRenewal: () => apiCall('/admin/commerce/renewal/run', { method: 'POST', body: '{}' }),
};

// ── Plan access (Release 1A): module-to-plan map from the feature registry, per-vendor exceptions ────────────────────────
export interface PlanAccessRow { moduleKey: string | null; addonKey: string | null; featureId: string; label: string; department: string; minPlan: string; status: string }
export interface PlanAccessProvision { grantModules: string[]; grantAddons: string[]; keptOffModules: string[]; keptOffAddons: string[]; beyondPlanModules: string[]; beyondPlanAddons: string[] }
export interface PlanAccessVendor {
  vendor: { id: string; businessName: string; subdomain: string | null; industry: string | null };
  plan: PlanKey | null; planName: string; profile: string; custom: boolean;
  modules: { key: string; label: string; enabled: boolean; fromRow: boolean }[];
  addons: { key: string; label: string; enabled: boolean }[];
  provisionPlan: PlanAccessProvision | null;
  exceptions: { id: string; at: string; actor: string; kind: string; key: string; enabled: boolean; reason: string }[];
}
export const planAccessApi = {
  map: (): Promise<{ data: PlanAccessRow[] }> => apiCall('/admin/plan-access/map'),
  vendors: (q = ''): Promise<{ data: { id: string; businessName: string; subdomain: string | null; plan: string; navV2: boolean }[] }> => apiCall(`/admin/plan-access/vendors${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  vendor: (id: string): Promise<{ data: PlanAccessVendor }> => apiCall(`/admin/plan-access/vendors/${id}`),
  setException: (id: string, b: { kind: 'module' | 'addon'; key: string; enabled: boolean; reason: string }): Promise<{ data: PlanAccessVendor }> =>
    apiCall(`/admin/plan-access/vendors/${id}/exception`, { method: 'POST', body: JSON.stringify(b) }),
  provision: (id: string): Promise<{ data: PlanAccessVendor }> => apiCall(`/admin/plan-access/vendors/${id}/provision`, { method: 'POST' }),
};

// ── Special arrangements (Release 1A) ───────────────────────────────────────────────────────────────────────────────────
export interface ArrangementRow {
  id: string; vendorId: string; allowHalfYear: boolean; gstMode: 'EXCLUSIVE' | 'NONE'; allowedChannels: string[]; validUntil: string; reason: string;
  createdBy: string; createdAt: string; active: boolean; endedAt: string | null; endedBy: string | null; endReason: string | null;
  history: { at: string; by: string; action: string; reason?: string }[];
  vendor: { id: string; businessName: string; subdomain: string | null } | null;
  plan: { planKey: string; cycleMonths: number; gstMode: string } | null;
  state: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'ENDED';
}
export interface ArrangementSummary { active: boolean; allowHalfYear: boolean; gstMode: string; allowedChannels: string[]; validUntil: string | null; reason: string | null }
export interface GstReport { rows: { month: string; vendorId: string; businessName: string; invoices: number; gstForgonePaise: number; paidGstForgonePaise: number }[]; totalPaise: number; paidTotalPaise: number }
export interface ArrangementInputBody { vendorId?: string; allowHalfYear: boolean; gstMode: 'EXCLUSIVE' | 'NONE'; allowedChannels: string[]; validUntil: string; reason: string }
export const arrangementsApi = {
  list: (filter: 'all' | 'active' | 'expiring' | 'expired' = 'all'): Promise<{ data: ArrangementRow[] }> => apiCall(`/admin/special-arrangements?filter=${filter}`),
  forVendor: (vendorId: string): Promise<{ data: { active: ArrangementSummary | null } }> => apiCall(`/admin/special-arrangements/vendor/${vendorId}`),
  create: (b: ArrangementInputBody & { vendorId: string }) => apiCall('/admin/special-arrangements', { method: 'POST', body: JSON.stringify(b) }),
  update: (id: string, b: Omit<ArrangementInputBody, 'vendorId'>) => apiCall(`/admin/special-arrangements/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  end: (id: string, reason: string) => apiCall(`/admin/special-arrangements/${id}/end`, { method: 'POST', body: JSON.stringify({ reason }) }),
  gstReport: (): Promise<{ data: GstReport }> => apiCall('/admin/special-arrangements/gst-report'),
};
