import { ActivityBus, ActivityEvent } from '../../src/common/activity-bus';
import { CloudflareError, CloudflarePort, HostnameState } from '../../src/v3-domain-automation/cloudflare.port';
import { ConnectionPatch, ConnectionRow, ConnectionStore, DomainFacts, NewConnection } from '../../src/v3-domain-automation/connection.store';
import { DomainConnectionService } from '../../src/v3-domain-automation/connection.service';
import { AutomationSettings, DEFAULT_AUTOMATION_SETTINGS } from '../../src/v3-domain-automation/settings/automation-settings';
import { ConnectionStatus } from '../../src/v3-domain-automation/core/connection-core';

/** In-memory twin of PrismaConnectionStore: one connection per domain, every read names the vendor, compare-and-set on the status. */
export class MemoryConnectionStore extends ConnectionStore {
  domains: DomainFacts[] = []; subdomains = new Map<string, string>(); txt = new Map<string, string>(); rows: ConnectionRow[] = []; private n = 0; clock = new Date('2026-11-12T10:00:00Z');
  async domain(vendorId: string, domainId: string) { return this.domains.find((d) => d.id === domainId && d.vendorId === vendorId) ?? null; }
  async subdomainHost(vendorId: string) { return this.subdomains.get(vendorId) ?? null; }
  async txtValue(vendorId: string, domainId: string) { return this.domains.some((d) => d.id === domainId && d.vendorId === vendorId) ? this.txt.get(domainId) ?? null : null; }
  async forDomain(vendorId: string, domainId: string) { const r = this.rows.find((x) => x.vendorId === vendorId && x.domainId === domainId); return r ? { ...r } : null; }
  async get(vendorId: string, id: string) { const r = this.rows.find((x) => x.vendorId === vendorId && x.id === id); return r ? { ...r } : null; }
  async create(n: NewConnection) {
    if (this.rows.some((r) => r.domainId === n.domainId)) return null;
    const row: ConnectionRow = { ...n, id: `c${++this.n}`, status: 'PENDING', certStatus: 'NONE', cfHostnameId: null, attempts: 0, failureReason: null, lastCheckedAt: null, activatedAt: null, createdAt: this.clock, updatedAt: this.clock };
    this.rows.push(row); return { ...row };
  }
  async update(vendorId: string, id: string, expected: ConnectionStatus[], patch: ConnectionPatch) {
    const r = this.rows.find((x) => x.vendorId === vendorId && x.id === id && expected.includes(x.status)); if (!r) return null; Object.assign(r, patch); return { ...r };
  }
  async listForVendor(vendorId: string) { return this.rows.filter((r) => r.vendorId === vendorId).map((r) => ({ ...r })); }
  async listForStaff(f: { status?: ConnectionStatus }, skip: number, take: number) { const all = this.rows.filter((r) => !f.status || r.status === f.status); return { items: all.slice(skip, skip + take).map((r) => ({ ...r })), total: all.length }; }
  async watchList(limit: number) { return this.rows.filter((r) => ['PENDING', 'VERIFYING', 'ACTIVE', 'LAPSED'].includes(r.status)).slice(0, limit).map((r) => ({ ...r })); }
}

/** The fake Cloudflare of the tests (never in the product): scripted failures, certificates the test moves along, and a record of every call. */
export class FakeCloudflare extends CloudflarePort {
  calls: string[] = []; hostnames = new Map<string, HostnameState>(); redirects = new Map<string, string>(); createFailures: CloudflareError[] = []; getFailures: CloudflareError[] = []; private n = 0;
  async createCustomHostname(hostname: string) {
    this.calls.push(`create:${hostname}`); const f = this.createFailures.shift(); if (f) throw f;
    const h: HostnameState = { id: `cf${++this.n}`, hostname, certStatus: 'PENDING' }; this.hostnames.set(h.id, h); return { ...h };
  }
  async getCustomHostname(id: string) { this.calls.push(`get:${id}`); const f = this.getFailures.shift(); if (f) throw f; const h = this.hostnames.get(id); if (!h) throw new CloudflareError('NOT_FOUND', false); return { ...h }; }
  async deleteCustomHostname(id: string) { this.calls.push(`delete:${id}`); this.hostnames.delete(id); }
  async setRedirect(from: string, to: string) { this.calls.push(`redirect:${from}->${to}`); this.redirects.set(from, to); }
  async removeRedirect(from: string) { this.calls.push(`unredirect:${from}`); this.redirects.delete(from); }
  setCert(id: string, certStatus: HostnameState['certStatus'], reason?: string) { const h = this.hostnames.get(id)!; h.certStatus = certStatus; h.reason = reason; }
}

export interface ConnectionWorld { svc: DomainConnectionService; store: MemoryConnectionStore; cf: FakeCloudflare; switched: string[]; events: ActivityEvent[]; clock: { t: Date }; settings: { v: AutomationSettings }; pro: { on: boolean } }

export function connectionWorld(over: Partial<AutomationSettings> = { customHostnameTarget: 'edge.get4domain.test' }): ConnectionWorld {
  const store = new MemoryConnectionStore(); const cf = new FakeCloudflare(); const clock = { t: new Date('2026-11-12T10:00:00Z') }; const settings = { v: { ...DEFAULT_AUTOMATION_SETTINGS, ...over } };
  const pro = { on: true }; const ents = { resolve: async () => ({ features: { 'site.custom_domain': { state: pro.on ? 'ACTIVE' : 'LOCKED_PREVIEW' } } }) };
  const switched: string[] = []; const events: ActivityEvent[] = [];
  const bus = new ActivityBus(); bus.on('*', (e) => { events.push(e); });
  const canonical = { switchFor: async (vendorId: string) => { switched.push(vendorId); return { changed: true, from: null, to: null }; } };
  const svc = new DomainConnectionService(store, cf, { get: async () => settings.v } as never, { get: async () => ({ verificationTxtPrefix: '_g4d-verify' }) } as never, canonical as never, { invalidate: () => undefined } as never, ents as never, bus);
  svc.clock = () => clock.t;
  store.domains.push(
    { id: 'd1', vendorId: 'v1', hostname: 'example.in', kind: 'CUSTOM', status: 'ACTIVE' }, { id: 'd2', vendorId: 'v1', hostname: 'shop.example.com', kind: 'CUSTOM', status: 'PENDING' },
    { id: 'd3', vendorId: 'v2', hostname: 'other.in', kind: 'CUSTOM', status: 'ACTIVE' }, { id: 'ds1', vendorId: 'v1', hostname: 'acme.g4d.test', kind: 'SUBDOMAIN', status: 'ACTIVE' },
  );
  store.subdomains.set('v1', 'acme.g4d.test'); store.subdomains.set('v2', 'other.g4d.test'); store.txt.set('d1', 'g4d-verify=abc'); store.txt.set('d2', 'g4d-verify=def'); store.txt.set('d3', 'g4d-verify=ghi');
  return { svc, store, cf, switched, events, clock, settings, pro };
}
