import { PromotionGrantPort } from '../../src/v3-service-requests/promotion-grant.port';
import { ServiceRequestsService } from '../../src/v3-service-requests/service-requests.service';
import { postEntry } from '../../src/v3-wallet/wallet-engine';
import { MemoryServiceRequestsStore } from './memory-service-requests-store';
import { servicesWorld, ServicesWorld } from './services-world';
import { V1, V2 } from './wallet-world';

/**
 * The services world plus the requests twin joined to it (one unit of work covers the request, the pack and the wallet), a controllable promotion port, and helpers. The price of POSTER_DESIGN is
 * made up by the test (50,000 paise before tax; with the test's own tax rows a buyer in the seller's state pays 59,000).
 */
export const TEAM = { type: 'STAFF' as const, id: 'team-1', ip: null };
export const POSTER_TOTAL = 59_000;
export interface RequestsWorld extends ServicesWorld {
  requests: MemoryServiceRequestsStore; svcReq: ServiceRequestsService;
  promo: { calls: Array<{ vendorId: string; endsAt: Date; reason: string }>; fail: boolean };
  /** a vendor with an open wallet holding `amount` paise and a billing state (default: the seller's state, so tax is CGST plus SGST) */
  vendor(vendorId: string, amount: number, stateCode?: string): Promise<void>;
  brief(over?: Record<string, unknown>): Record<string, unknown>;
  /** make a request and walk it to READY_FOR_REVIEW through the team's steps (one deliverable) */
  ready(vendorId: string, serviceKey?: string, key?: string, brief?: Record<string, unknown>): Promise<string>;
  key(): string;
}

export function requestsWorld(): RequestsWorld {
  const sw = servicesWorld(); const requests = new MemoryServiceRequestsStore(sw.services); requests.clock = () => new Date(sw.now.t);
  sw.wsettings.over = { ...sw.wsettings.over, serviceMaxRevisions: 2 };
  const promo = { calls: [] as Array<{ vendorId: string; endsAt: Date; reason: string }>, fail: false };
  const promotion: PromotionGrantPort = { grantCustomDomain: async (vendorId, endsAt, reason) => { if (promo.fail) throw new Error('add-on service down'); promo.calls.push({ vendorId, endsAt, reason }); return `override-${promo.calls.length}`; } };
  const svcReq = new ServiceRequestsService(requests, sw.services, sw.svc, sw.store, sw.settingsService, sw.billingService, sw.entitlements, promotion, sw.bus); svcReq.clock = () => new Date(sw.now.t);
  let n = 0; const key = () => `req-key-${++n}-abcdefgh`;
  const vendor = async (vendorId: string, amount: number, stateCode = '33') => {
    await sw.open(vendorId);
    if (amount > 0) await sw.store.unit(vendorId, (tx) => postEntry(tx, { kind: 'TOPUP', amountPaise: amount, idempotencyKey: `seed-${vendorId}-${n++}-${amount}`, actor: { type: 'SYSTEM', id: null }, now: new Date(sw.now.t), validityDays: 365 }));
    await sw.svc.setBillingProfile(vendorId, { stateCode }, vendorId === 'v1' ? V1 : V2);
  };
  const brief = (over: Record<string, unknown> = {}) => ({ details: 'A poster for our festival offer with the shop name and phone number.', ...over });
  const ready = async (vendorId: string, serviceKey = 'POSTER_DESIGN', k = key(), b: Record<string, unknown> = brief()) => {
    const r = await svcReq.create(vendorId, { serviceKey, brief: b, idempotencyKey: k }, { type: 'VENDOR', actor: { type: 'VENDOR', id: vendorId, ip: null } });
    await svcReq.setStatus(r.id, { to: 'ACCEPTED' }, TEAM); await svcReq.setStatus(r.id, { to: 'IN_PRODUCTION' }, TEAM);
    if (serviceKey === 'CUSTOM_DOMAIN_PROMOTION') await svcReq.assign(r.id, { grantEndsAt: new Date(sw.now.t.getTime() + 30 * 86_400_000).toISOString() }, TEAM);
    await svcReq.addDeliverable(r.id, { kind: 'TEXT', text: 'Here is your finished work, ready to use.' }, TEAM);
    await svcReq.setStatus(r.id, { to: 'READY_FOR_REVIEW' }, TEAM);
    return r.id;
  };
  return { ...sw, requests, svcReq, promo, vendor, brief, ready, key };
}
export const vendorActor = (id: string) => ({ type: 'VENDOR' as const, id, ip: null });
