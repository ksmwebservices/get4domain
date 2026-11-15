import { MediaRow, MediaUploadStore, NewMedia } from '../../src/v3-media-upload/media-upload.store';

/** An in-memory twin of the Prisma upload store: every method names the scope, and one scope never sees another's rows. */
export class MemoryMediaUploadStore extends MediaUploadStore {
  rows: MediaRow[] = []; listings = new Map<string, string>(); private n = 0;
  async findBySha(scopeKey: string, sha256: string) { return this.rows.find((r) => r.scopeKey === scopeKey && r.sha256 === sha256) ?? null; }
  async create(row: NewMedia): Promise<MediaRow> {
    if (this.rows.some((r) => r.scopeKey === row.scopeKey && r.sha256 === row.sha256)) throw new Error('unique violation');
    this.n += 1; const m: MediaRow = { ...row, id: `med_${String(this.n).padStart(6, '0')}`, ownerKind: row.ownerKind, kind: row.kind, status: 'ACTIVE', createdAt: new Date(1_700_000_000_000 + this.n * 1000), removedAt: null };
    this.rows.push(m); return m;
  }
  async revive(scopeKey: string, id: string, altText: string | null) { const r = this.rows.find((x) => x.id === id && x.scopeKey === scopeKey); if (!r) return null; r.status = 'ACTIVE'; r.removedAt = null; r.altText = altText; return r; }
  async list(scopeKey: string, skip: number, take: number) { const all = this.rows.filter((r) => r.scopeKey === scopeKey && r.status === 'ACTIVE').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); return { items: all.slice(skip, skip + take), total: all.length }; }
  async get(scopeKey: string, id: string) { return this.rows.find((r) => r.id === id && r.scopeKey === scopeKey) ?? null; }
  async softRemove(scopeKey: string, id: string, at: Date) { const r = this.rows.find((x) => x.id === id && x.scopeKey === scopeKey && x.status === 'ACTIVE'); if (!r) return false; r.status = 'REMOVED'; r.removedAt = at; return true; }
  async vendorOfListing(seededSiteId: string) { return this.listings.get(seededSiteId) ?? null; }
}
