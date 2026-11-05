import { Actor } from '../../src/plans/admin/audit.service';
import { ServicesTx } from '../../src/v3-services/services.store';
import { WalletTx } from '../../src/v3-wallet/wallet.store';
import { RequestStatus } from '../../src/v3-service-requests/core/request-core';
import {
  AdminRequestFilter, DeliverableRow, DuplicateRequestError, EventRow, InvoiceRow, NewDeliverable, NewEvent, NewInvoice, NewRequest, RequestPatch, RequestRow, RequestsStore, RequestsTx,
} from '../../src/v3-service-requests/requests.store';
import { MemoryServicesStore } from './memory-services-store';

/**
 * In-memory twin of the Prisma requests store. It enforces what the database enforces (one request per vendor and key, a unique hold and charge per request, one invoice per request, the funding
 * check, append-only events and invoices) and rolls back with the wallet and services twins when a unit throws.
 */
const OPEN: RequestStatus[] = ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED'];
export class MemoryServiceRequestsStore extends RequestsStore {
  requests: RequestRow[] = []; eventRows: EventRow[] = []; deliverableRows: DeliverableRow[] = []; invoiceRows: InvoiceRow[] = []; audits: Array<{ actor: Actor; action: string; entityId: string | null; before: unknown; after: unknown }> = [];
  termStart: Date | null = null; clock: () => Date = () => new Date();
  private n = 0;
  constructor(readonly services: MemoryServicesStore) { super(); services.wallets.sidecars.push(this); }
  private id(p: string): string { return `${p}-${++this.n}`; }

  capture(): () => void {
    const s = { rq: this.requests.map((r) => ({ ...r, brief: { ...r.brief }, attachmentRefs: [...r.attachmentRefs] })), ev: [...this.eventRows], dl: [...this.deliverableRows], iv: [...this.invoiceRows], au: this.audits.length };
    return () => { this.requests = s.rq; this.eventRows = s.ev; this.deliverableRows = s.dl; this.invoiceRows = s.iv; this.audits.length = s.au; };
  }

  unit<T>(vendorId: string, fn: (r: RequestsTx, s: ServicesTx, w: WalletTx) => Promise<T>): Promise<T> { return this.services.withWallet(vendorId, (stx, wtx) => fn(this.tx(vendorId), stx, wtx)); }

  private tx(vendorId: string): RequestsTx {
    const mine = (id: string): RequestRow | undefined => this.requests.find((r) => r.id === id && r.vendorId === vendorId);
    const svcKey = (serviceId: string): string => this.services.serviceRows.find((s) => s.id === serviceId)?.key ?? serviceId;
    const cp = (r: RequestRow): RequestRow => ({ ...r, brief: { ...r.brief }, attachmentRefs: [...r.attachmentRefs], taxSnapshot: { ...r.taxSnapshot } });
    return {
      insertRequest: async (d: NewRequest) => {
        if (this.requests.some((r) => r.vendorId === d.vendorId && r.idempotencyKey === d.idempotencyKey) || (d.holdLedgerId && this.requests.some((r) => r.holdLedgerId === d.holdLedgerId))) throw new DuplicateRequestError();
        if (d.fundingKind === 'WALLET' ? !(d.priceSnapshotPaise && d.holdLedgerId) : d.holdLedgerId) throw new Error('check constraint: g4d_service_requests_funding_chk');
        const now = this.clock();
        const row: RequestRow = { ...d, serviceKey: svcKey(d.serviceId), chargeLedgerId: null, assignedStaffId: null, slaDueAt: null, slaBreachedAt: null, readyAt: null, revisionsUsed: 0, grantEndsAt: null, grantOverrideId: null, rejectReason: null, approvedAt: null, cancelledAt: null, createdAt: now, updatedAt: now };
        this.requests.push(row); return cp(row);
      },
      getRequest: async (id) => { const r = mine(id); return r ? cp(r) : null; },
      findByKey: async (key) => { const r = this.requests.find((x) => x.vendorId === vendorId && x.idempotencyKey === key); return r ? cp(r) : null; },
      updateRequestCas: async (id, expected, patch: RequestPatch) => { const r = mine(id); if (!r || !expected.includes(r.status)) return false; if (patch.chargeLedgerId && this.requests.some((x) => x.chargeLedgerId === patch.chargeLedgerId)) throw new Error('unique: chargeLedgerId'); Object.assign(r, patch, { updatedAt: this.clock() }); return true; },
      patchRequest: async (id, patch) => { const r = mine(id); if (r) Object.assign(r, patch, { updatedAt: this.clock() }); },
      insertEvent: async (d: NewEvent) => { this.eventRows.push({ ...d, id: this.id('evt') }); },
      events: async (requestId) => this.eventRows.filter((e) => e.requestId === requestId && e.vendorId === vendorId).map((e) => ({ ...e })),
      insertDeliverable: async (d: NewDeliverable) => { const row = { ...d, id: this.id('dlv') }; this.deliverableRows.push(row); return { ...row }; },
      deliverables: async (requestId) => this.deliverableRows.filter((x) => x.requestId === requestId && x.vendorId === vendorId).map((x) => ({ ...x })),
      insertInvoice: async (d: NewInvoice) => {
        if (this.invoiceRows.some((i) => i.requestId === d.requestId || i.invoiceNumber === d.invoiceNumber || i.ledgerEntryId === d.ledgerEntryId)) throw new Error('unique: invoice');
        const row = { ...d, id: this.id('sinv') }; this.invoiceRows.push(row); return { ...row };
      },
      invoiceFor: async (requestId) => { const i = this.invoiceRows.find((x) => x.requestId === requestId && x.vendorId === vendorId); return i ? { ...i } : null; },
      allowanceUsed: async (serviceId) => this.requests.filter((r) => r.vendorId === vendorId && r.serviceId === serviceId && r.fundingKind === 'INCLUDED_ALLOWANCE' && r.status !== 'CANCELLED' && r.status !== 'REJECTED_BY_TEAM' && (!this.termStart || r.createdAt >= this.termStart)).length,
      packReserved: async (serviceId) => this.requests.filter((r) => r.vendorId === vendorId && r.serviceId === serviceId && r.fundingKind === 'PACK' && OPEN.includes(r.status)).length,
      claimGrant: async (id) => { const r = mine(id); if (!r || r.grantOverrideId !== null) return false; r.grantOverrideId = 'PENDING'; return true; },
      finishGrant: async (id, overrideId) => { const r = mine(id); if (r) r.grantOverrideId = overrideId; },
      audit: async (actor, action, entityId, before, after) => { this.audits.push({ actor, action, entityId, before, after }); },
    };
  }

  async listForVendor(vendorId: string, skip: number, take: number) { const all = this.requests.filter((r) => r.vendorId === vendorId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); return { items: all.slice(skip, skip + take).map((r) => ({ ...r })), total: all.length }; }
  async getForVendor(vendorId: string, id: string) { const r = this.requests.find((x) => x.vendorId === vendorId && x.id === id); return r ? { ...r } : null; }
  async detail(requestId: string) {
    const invoice = this.invoiceRows.find((i) => i.requestId === requestId);
    return { events: this.eventRows.filter((e) => e.requestId === requestId).map((e) => ({ ...e })), deliverables: this.deliverableRows.filter((d) => d.requestId === requestId).map((d) => ({ ...d })), invoice: invoice ? { ...invoice } : null };
  }
  async invoicesForVendor(vendorId: string, skip: number, take: number) { const all = this.invoiceRows.filter((i) => i.vendorId === vendorId); return { items: all.slice(skip, skip + take).map((i) => ({ ...i })), total: all.length }; }
  async adminList(f: AdminRequestFilter) {
    const all = this.requests.filter((r) => (!f.serviceKey || r.serviceKey === f.serviceKey) && (!f.status || r.status === f.status) && (!f.fundingKind || r.fundingKind === f.fundingKind) && (!f.vendorId || r.vendorId === f.vendorId)
      && (f.slaBreached !== true || !!r.slaBreachedAt || (!!r.slaDueAt && r.slaDueAt < f.now && ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'REVISION_REQUESTED'].includes(r.status))));
    return { items: all.slice(f.skip, f.skip + f.take).map((r) => ({ ...r })), total: all.length };
  }
  async adminGet(id: string) { const r = this.requests.find((x) => x.id === id); return r ? { ...r } : null; }
  async slaCandidates(now: Date, limit: number) { return this.requests.filter((r) => r.slaDueAt && r.slaDueAt < now && !r.slaBreachedAt && ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'REVISION_REQUESTED'].includes(r.status)).slice(0, limit).map((r) => ({ ...r })); }
  async autoApproveCandidates(readyBefore: Date, limit: number) { return this.requests.filter((r) => r.status === 'READY_FOR_REVIEW' && r.readyAt && r.readyAt <= readyBefore).slice(0, limit).map((r) => ({ ...r })); }
  async allowanceUsedFor(vendorId: string, serviceKey: string) { return this.requests.filter((r) => r.vendorId === vendorId && r.serviceKey === serviceKey && r.fundingKind === 'INCLUDED_ALLOWANCE' && r.status !== 'CANCELLED' && r.status !== 'REJECTED_BY_TEAM' && (!this.termStart || r.createdAt >= this.termStart)).length; }
}
