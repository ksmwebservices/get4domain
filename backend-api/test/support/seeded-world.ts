import { DEFAULT_B3_SETTINGS } from '../../src/b3-settings/b3-settings';
import { DupKeys } from '../../src/seeded-sites/core/seeded';
import { OtpPepper } from '../../src/directory/pepper';
import { Actor } from '../../src/plans/admin/audit.service';
import { SeedInput } from '../../src/seeded-sites/core/seeded';
import { BusinessFacts, ClaimHandover, SeedProvisioner, SeededFacts, SeededPublisher } from '../../src/seeded-sites/seeded-ports';
import { BatchRow, NewSeededRow, OutreachLogRow, RegisterRow, SeededListFilter, SeededPatch, SeededRow, SeededStore } from '../../src/seeded-sites/seeded.store';
import { SeededSitesService } from '../../src/seeded-sites/seeded-sites.service';
import { MemoryLifecycleStore } from './memory-lifecycle-store';

export const T0 = new Date('2026-11-05T10:00:00.000Z');
export const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
export const ops = { actor: STAFF, role: 'OPERATIONS' as const };
export const sup = { actor: { ...STAFF, id: 'staff-sup' }, role: 'SUPER_ADMIN' as const };
export const mkt = { actor: { ...STAFF, id: 'staff-mkt' }, role: 'MARKETING' as const };

/** In-memory twin of the Prisma seeded store: same shapes, the register is append-only (no delete or update exists). */
export class MemorySeededStore extends SeededStore {
  rows = new Map<string, SeededRow>(); batches = new Map<string, BatchRow>(); logs: OutreachLogRow[] = []; register = new Map<string, RegisterRow>(); audits: Array<{ action: string; entityId: string | null; after: unknown }> = [];
  clock: () => Date = () => new Date(T0); private n = 0;
  async create(r: NewSeededRow) { const row: SeededRow = { ...r, id: `ss-${++this.n}`, removedAt: null, createdAt: this.clock(), updatedAt: this.clock() }; this.rows.set(row.id, row); return { ...row }; }
  async get(id: string) { const r = this.rows.get(id); return r ? { ...r } : null; }
  async getByVendor(v: string) { const r = [...this.rows.values()].find((x) => x.vendorId === v); return r ? { ...r } : null; }
  async update(id: string, p: SeededPatch) { const r = this.rows.get(id)!; Object.assign(r, p, { updatedAt: this.clock() }); return { ...r }; }
  async list(f: SeededListFilter) {
    const all = [...this.rows.values()].filter((r) => (!f.lifecycle || r.lifecycle === f.lifecycle) && (!f.outreachStatus || r.outreachStatus === f.outreachStatus) && (!f.batchId || r.batchId === f.batchId)).reverse();
    return { items: all.slice(f.skip, f.skip + f.take).map((r) => ({ ...r })), total: all.length };
  }
  async findKeyMatches(k: { phoneHashes: string[]; emailHashes: string[]; nameKeys: string[] }): Promise<DupKeys[]> {
    return [...this.rows.values()].filter((r) => k.phoneHashes.includes(r.phoneHash) || (r.emailHash && k.emailHashes.includes(r.emailHash)) || k.nameKeys.includes(r.nameKey)).map((r) => ({ phoneHash: r.phoneHash, emailHash: r.emailHash, nameKey: r.nameKey }));
  }
  async createBatch(b: Omit<BatchRow, 'id' | 'createdAt'>) { const row: BatchRow = { ...b, id: `b-${++this.n}`, createdAt: this.clock() }; this.batches.set(row.id, row); return { ...row }; }
  async updateBatch(id: string, p: Partial<Pick<BatchRow, 'rowsCreated' | 'rowsRejected' | 'reportJson'>>) { Object.assign(this.batches.get(id)!, p); }
  async getBatch(id: string) { return this.batches.get(id) ?? null; }
  async addLog(l: Omit<OutreachLogRow, 'id' | 'at'>, at: Date) { const row: OutreachLogRow = { ...l, id: `l-${++this.n}`, at }; this.logs.push(row); return row; }
  async listLogs(id: string) { return this.logs.filter((l) => l.seededSiteId === id).reverse(); }
  async onRegister(h: string) { return this.register.has(h); }
  async addToRegister(h: string, reason: string, source: string, addedBy: string | null) { if (this.register.has(h)) return false; this.register.set(h, { id: `r-${++this.n}`, phoneHash: h, reason, source, addedBy, addedAt: this.clock() }); return true; }
  async listRegister(skip: number, take: number) { const all = [...this.register.values()]; return { items: all.slice(skip, skip + take), total: all.length }; }
  async registerHashesAmong(hs: string[]) { return new Set(hs.filter((h) => this.register.has(h))); }
  async recordAudit(_a: Actor, action: string, _t: string, entityId: string | null, _b: unknown, after: unknown) { this.audits.push({ action, entityId, after }); }
}

export class FakeProvisioner extends SeedProvisioner {
  calls: Array<{ input: SeedInput; key: string; placeholderEmail: string }> = []; failFor = new Set<string>(); private n = 0;
  constructor(private readonly onCreate: (vendorId: string, input: SeedInput) => void) { super(); }
  async provision(i: { input: SeedInput; placeholderEmail: string; idempotencyKey: string; actor: Actor }) {
    if (this.failFor.has(i.input.businessName)) throw Object.assign(new Error('x'), { response: { code: 'SEEDED_INVALID' } });
    this.calls.push({ input: i.input, key: i.idempotencyKey, placeholderEmail: i.placeholderEmail });
    const vendorId = `seed-v-${++this.n}`; this.onCreate(vendorId, i.input);
    return { vendorId, directoryBusinessId: `seed-b-${this.n}` };
  }
}
export class FakePublisher extends SeededPublisher { published: string[] = []; async publish(v: string) { this.published.push(v); return { published: true }; } }
export class FakeHandover extends ClaimHandover {
  issued: string[] = []; revoked: string[] = [];
  async issue(v: string) { this.issued.push(v); return { claimUrl: `https://app.example.test/claim/RAW-${v}`, expiresAt: '2026-11-15T10:00:00.000Z' }; }
  async revoke(v: string) { this.revoked.push(v); return 1; }
}
export class FakeFacts extends SeededFacts {
  facts = new Map<string, BusinessFacts>(); categories = new Set(['plumber', 'dentist', 'jewellery']);
  categoryExists(id: string) { return this.categories.has(id); }
  trackOf(id: string) { return id === 'jewellery' ? 'ecommerce' : id === 'dentist' ? 'professional' : 'handyman'; }
  async factsOf(v: string) { return this.facts.get(v) ?? null; }
}

export function seededWorld() {
  const store = new MemorySeededStore(); const lifecycle = new MemoryLifecycleStore(); const facts = new FakeFacts();
  const provisioner = new FakeProvisioner((vendorId, input) => {
    lifecycle.addVendor({ id: vendorId, phone: input.phone, businessName: input.businessName });
    facts.facts.set(vendorId, { name: input.businessName, categoryKnown: true, city: input.city, area: input.area, phoneE164: input.phone, businessStatus: 'UNCLAIMED', proActive: false });
  });
  const publisher = new FakePublisher(); const handover = new FakeHandover();
  const b3 = { over: {} as Partial<typeof DEFAULT_B3_SETTINGS> };
  const pepper = new OtpPepper(); pepper.env = {};
  const svc = new SeededSitesService(store, provisioner, publisher, handover, facts, lifecycle, { get: async () => ({ ...DEFAULT_B3_SETTINGS, ...b3.over }) }, pepper);
  svc.clock = () => new Date(T0);
  return { store, lifecycle, facts, provisioner, publisher, handover, svc, b3, pepper };
}
export const row = (over: Record<string, unknown> = {}) => ({ businessName: 'Sri Ganesh Plumbing', category: 'plumber', city: 'Chennai', area: 'T Nagar', phone: '98765 43210', email: 'ganesh@example.in', sourceKind: 'FIELD_VISIT', sourceNote: 'Seen on the shop board', publicFactsOnly: true, ...over });
export const csvOf = (rows: Array<Record<string, string>>): string => {
  const cols = ['businessName', 'category', 'city', 'area', 'phone', 'email', 'sourceKind', 'sourceNote', 'publicFactsOnly'];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => `"${(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n') + '\n';
};
export const csvRow = (over: Record<string, string> = {}): Record<string, string> => ({ businessName: 'Acme Plumbing', category: 'plumber', city: 'Chennai', area: 'Adyar', phone: '9811111111', email: '', sourceKind: 'PUBLIC_LISTING', sourceNote: '', publicFactsOnly: 'yes', ...over });
