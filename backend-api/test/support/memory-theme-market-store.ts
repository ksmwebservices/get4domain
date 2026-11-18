import { Actor } from '../../src/plans/admin/audit.service';
import { AuditSpec, NewTheme, ThemeFilter, ThemeMarketStore, ThemePatch, ThemeRow, ThemeRowWithBytes, ThemeStatus } from '../../src/v3-theme-market/theme-market.store';

/** In-memory stand-in for the theme table: the same rules the database holds (unique key and version, conditional transition, audit with the change). */
export class MemoryThemeMarketStore extends ThemeMarketStore {
  rows: ThemeRowWithBytes[] = []; audits: Array<{ actor: Actor; action: string; before: unknown; after: unknown; entityId: string }> = [];
  vendors = new Map<string, { name: string; email: string | null; phone: string | null; subdomain: string | null; customDomain: string | null; mediaHashes: string[] }>();
  private n = 0;
  private strip(r: ThemeRowWithBytes): ThemeRow { const { bytes: _bytes, ...rest } = r; void _bytes; return { ...rest }; }

  async create(t: NewTheme, a: AuditSpec): Promise<ThemeRow | null> {
    if (this.rows.some((r) => r.key === t.key && r.version === t.version)) return null;
    const now = new Date('2026-12-01T00:00:00Z'); this.n += 1;
    const row: ThemeRowWithBytes = { ...t, id: `theme-id-${String(this.n).padStart(4, '0')}`, createdAt: now, updatedAt: now, submittedAt: null, publishedAt: null, publishedById: null, archivedAt: null, consentAt: null, consentById: null, reviewNote: null };
    this.rows.push(row); this.audits.push({ ...a, entityId: row.id }); return this.strip(row);
  }
  async find(id: string): Promise<ThemeRow | null> { const r = this.rows.find((x) => x.id === id); return r ? this.strip(r) : null; }
  async findWithBytes(id: string): Promise<ThemeRowWithBytes | null> { return this.rows.find((x) => x.id === id) ?? null; }
  async findByKeyVersion(key: string, version: number): Promise<ThemeRow | null> { const r = this.rows.find((x) => x.key === key && x.version === version); return r ? this.strip(r) : null; }
  async maxVersion(key: string): Promise<number> { return Math.max(0, ...this.rows.filter((r) => r.key === key).map((r) => r.version)); }
  async list(f: ThemeFilter, skip: number, take: number): Promise<{ items: ThemeRow[]; total: number }> {
    const m = this.rows.filter((r) => (!f.status || r.status === f.status) && (!f.visibility || r.visibility === f.visibility) && (!f.pack || r.packs.includes(f.pack)) && (!f.addon || r.addons.includes(f.addon)) && (!f.capability || r.capabilities.includes(f.capability))
      && (!f.tag || r.tags.includes(f.tag)) && (!f.category || r.catalogueCategories.includes(f.category)) && (!f.tier || r.tier === f.tier) && (!f.key || r.key === f.key) && (!f.privateVendorId || r.privateVendorId === f.privateVendorId)
      && (typeof f.starter !== 'boolean' || r.starter === f.starter) && (!f.q || r.name.toLowerCase().includes(f.q.toLowerCase()) || r.key.includes(f.q.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key) || b.version - a.version);
    return { items: m.slice(skip, skip + take).map((r) => this.strip(r)), total: m.length };
  }
  async transition(id: string, from: readonly ThemeStatus[], patch: ThemePatch, a: AuditSpec, older?: { key: string; below: number }): Promise<ThemeRow | null> {
    const r = this.rows.find((x) => x.id === id);
    if (!r || !from.includes(r.status)) return null;
    Object.assign(r, patch, { updatedAt: new Date('2026-12-02T00:00:00Z') });
    if (older) for (const x of this.rows) if (x.key === older.key && x.status === 'PUBLISHED' && x.version < older.below) { x.status = 'ARCHIVED'; x.archivedAt = new Date('2026-12-02T00:00:00Z'); this.audits.push({ actor: a.actor, action: 'theme.archive', before: { status: 'PUBLISHED' }, after: { status: 'ARCHIVED' }, entityId: x.id }); }
    this.audits.push({ ...a, entityId: id }); return this.strip(r);
  }
  async loadServable(): Promise<ThemeRowWithBytes[]> { return this.rows.filter((r) => r.status === 'PUBLISHED' || r.status === 'ARCHIVED'); }
  async vendorExists(vendorId: string): Promise<boolean> { return this.vendors.has(vendorId); }
  async vendorFacts(vendorId: string) { return this.vendors.get(vendorId) ?? null; }
}
