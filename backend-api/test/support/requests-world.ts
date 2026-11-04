import { DEFAULT_B3_SETTINGS } from '../../src/b3-settings/b3-settings';
import { AcceptanceGuard } from '../../src/terms/terms-ports';
import { hmacHex } from '../../src/requests-orders/core/commerce-core';
import { MessagingService } from '../../src/requests-orders/messaging.service';
import { PublicRequestsService, SubmitBody } from '../../src/requests-orders/public-requests.service';
import { RequestsCron } from '../../src/requests-orders/requests.cron';
import { Catalogue, CatalogueItem, OwnGatewayGate } from '../../src/requests-orders/requests-ports';
import { StaffRequestsService } from '../../src/requests-orders/staff-requests.service';
import { VendorRequestsService } from '../../src/requests-orders/vendor-requests.service';
import { VendorWebhookService } from '../../src/requests-orders/vendor-webhook.service';
import { DirectoryVisitService } from '../../src/directory/directory-visit.service';
import { ResolvedEntitlements } from '../../src/plans/entitlements/entitlement-engine';
import { entitlements } from './site-fixtures';
import { directoryWorld, FakeSms } from './directory-world';
import { MemoryLifecycleStore } from './memory-lifecycle-store';
import { MemoryRequestsStore } from './memory-requests-store';

export const T0 = new Date('2026-11-05T10:00:00.000Z');
export const OWNER = { type: 'VENDOR' as const, id: 'user-1', ip: null };
export const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
export const HOST_A = 'shop-a.get4domain.com';
export const HOST_B = 'shop-b.get4domain.com';

class MemoryCatalogue extends Catalogue {
  items = new Map<string, CatalogueItem>();
  async find(vendorId: string, ref: string) { return this.items.get(`${vendorId}|${ref}`) ?? null; }
}

export const consent = (over: Record<string, unknown> = {}) => ({ contactByBusiness: true, contactByPlatform: true, marketing: false, textVersion: 1, ...over });
let keyN = 0;
export const key = (): string => `idem-key-${String(++keyN).padStart(8, '0')}-abcdef`;
export const enquiry = (over: Partial<SubmitBody> = {}): SubmitBody => ({ kind: 'ENQUIRY', name: 'Meena R', phone: '98765 43210', email: 'meena@example.in', payload: { message: 'Do you do geyser repairs?' }, consent: consent(), idempotencyKey: key(), ...over });

/** Two Pro ecommerce vendors (A and B) on two hosts, a Free vendor, everything in memory. */
export async function requestsWorld(opts: { acceptance?: AcceptanceGuard } = {}) {
  const dw = await directoryWorld();
  const store = new MemoryRequestsStore(); store.clock = () => new Date(T0);
  const lifecycle = new MemoryLifecycleStore(); lifecycle.clock = () => new Date(T0);
  const ents = new Map<string, ResolvedEntitlements>();
  const hostMap = new Map<string, string>();
  const sms = new FakeSms(); const catalogue = new MemoryCatalogue();
  const now = { t: new Date(T0) }; store.clock = () => new Date(now.t); dw.repo.clock = () => new Date(now.t);
  const b3 = { over: {} as Partial<typeof DEFAULT_B3_SETTINGS> };
  const b3svc = { get: async () => ({ ...DEFAULT_B3_SETTINGS, ...b3.over }) };
  const hosts = { resolveHost: async (h: string) => { const v = hostMap.get(h); return v ? ({ vendorId: v, host: h, primaryHost: h, decision: { action: 'SERVE' as const } }) : null; } };
  const entSvc = { resolve: async (v: string) => ents.get(v) ?? entitlements('FREE', 'ecommerce') };
  const messaging = new MessagingService(store, b3svc as never, dw.pepper); messaging.clock = () => new Date(now.t);
  const gateway = new OwnGatewayGate(); gateway.env = {};
  const pub = new PublicRequestsService(store, hosts as never, entSvc as never, lifecycle, dw.repo, dw.visits as unknown as DirectoryVisitService, b3svc as never, dw.pepper, messaging, catalogue, gateway, sms, { get: async () => ({ otpResendCooldownSeconds: 30, otpExpiryMinutes: 10, otpMaxAttempts: 5 }) } as never, 'https://app.example.test');
  pub.clock = () => new Date(now.t); pub.random = () => 123456; let sn = 0; pub.salt = () => `salt-${++sn}`;
  const vendor = new VendorRequestsService(store, messaging, gateway, lifecycle, b3svc as never, opts.acceptance); vendor.clock = () => new Date(now.t);
  const webhook = new VendorWebhookService(store, vendor);
  const staff = new StaffRequestsService(store, dw.pepper, { suspend: async (id: string) => { const v = await lifecycle.vendor(id); if (v) v.status = 'SUSPENDED'; lifecycle.vendors.get(id)!.status = 'SUSPENDED'; return { status: 'SUSPENDED', changed: true }; } } as never);
  staff.clock = () => new Date(now.t);
  const cron = new RequestsCron(store, messaging, lifecycle, b3svc as never); cron.clock = () => new Date(now.t);
  dw.visits.clock = () => new Date(now.t);

  const addVendor = (id: string, host: string, level: 'FREE' | 'PRO' = 'PRO', track: 'ecommerce' | 'handyman' = 'ecommerce') => {
    lifecycle.addVendor({ id, phone: '+919800000001', email: `${id}@x.invalid`, businessName: `Shop ${id}` }); hostMap.set(host, id); ents.set(id, entitlements(level, track));
  };
  addVendor('va', HOST_A); addVendor('vb', HOST_B); addVendor('vfree', 'free.get4domain.com', 'FREE');
  catalogue.items.set('va|sku-1', { productRef: 'sku-1', name: 'Brass lamp', unitPaise: 150_000, taxPercent: 0 });
  catalogue.items.set('va|sku-2', { productRef: 'sku-2', name: 'Bell', unitPaise: 25_000, taxPercent: 0 });
  catalogue.items.set('vb|sku-1', { productRef: 'sku-1', name: 'Other lamp', unitPaise: 100_000, taxPercent: 0 });

  const method = async (vendorId: string, kind: 'OWN_GATEWAY' | 'UPI' | 'PAY_ON_DELIVERY' | 'PAY_AT_VISIT' | 'BANK_TRANSFER', webhookSecret = 'whsec-' + vendorId + '-secret') => {
    const m = await vendor.createMethod(vendorId, { kind, label: `${kind} method`, details: kind === 'OWN_GATEWAY' || kind === 'UPI' ? 'rzp_vendor_key_1234' : undefined, webhookSecret: kind === 'OWN_GATEWAY' ? webhookSecret : undefined }, OWNER);
    await vendor.testMethod(vendorId, m.id, OWNER);
    await vendor.updateMethod(vendorId, m.id, { status: 'ACTIVE' }, OWNER);
    return m.id;
  };
  const signed = (secret: string, body: object) => { const raw = Buffer.from(JSON.stringify(body)); return { raw, sig: hmacHex(secret, raw) }; };
  const orderBody = (items: Array<{ productRef: string; qty: number }> = [{ productRef: 'sku-1', qty: 1 }], over: Record<string, unknown> = {}) => ({ ...enquiry({ kind: undefined as never, payload: undefined as never }), items, shipping: { address: '12 Main Road', city: 'Chennai', pincode: '600001' }, ...over });
  return { dw, store, lifecycle, ents, hostMap, sms, catalogue, now, b3, messaging, pub, vendor, webhook, staff, cron, addVendor, method, signed, orderBody };
}
export type RW = Awaited<ReturnType<typeof requestsWorld>>;
