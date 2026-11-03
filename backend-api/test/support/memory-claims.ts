import { ClaimStore, ClaimTokenRow, IssueArgs } from '../../src/provisioning/claims/claim-store';
import { InviteRow, InviteStore, NewInvite } from '../../src/provisioning/invites/invite-store';

/** In-memory twins of the Prisma claim and invite stores (same rules: one ACTIVE token per vendor, a revoked token's sandbox bodies are cleared). */
export class MemoryClaimStore extends ClaimStore {
  rows: ClaimTokenRow[] = [];
  vendors = new Map<string, string>();   // vendorId -> businessName (public name)
  invites?: MemoryInviteStore;
  private seq = 0;

  async issue(a: IssueArgs): Promise<{ id: string }> {
    for (const r of this.rows) if (r.vendorId === a.vendorId && r.status === 'ACTIVE') { r.status = 'REVOKED'; r.activeKey = null; this.invites?.clearBodies(r.id); }
    const row: ClaimTokenRow = {
      id: `ct${++this.seq}`, vendorId: a.vendorId, tokenHash: a.tokenHash, purpose: 'CLAIM', status: 'ACTIVE', expiresAt: a.expiresAt, usedAt: null,
      createdByType: a.actor.type === 'STAFF' ? 'STAFF' : 'SYSTEM', createdById: a.actor.id, activeKey: `${a.vendorId}:CLAIM`,
    };
    this.rows.push(row);
    return { id: row.id };
  }
  async findByHash(hash: string) {
    const r = this.rows.find((x) => x.tokenHash === hash);
    return r ? { ...r, businessName: this.vendors.get(r.vendorId) ?? 'Unknown' } : null;
  }
  async markUsed(id: string, now: Date): Promise<boolean> {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.status !== 'ACTIVE' || r.expiresAt <= now) return false;
    r.status = 'USED'; r.usedAt = now; r.activeKey = null; this.invites?.clearBodies(r.id);
    return true;
  }
  async revokeActive(vendorId: string): Promise<number> {
    let n = 0;
    for (const r of this.rows) if (r.vendorId === vendorId && r.status === 'ACTIVE') { r.status = 'REVOKED'; r.activeKey = null; this.invites?.clearBodies(r.id); n++; }
    return n;
  }
  async markExpired(id: string): Promise<void> { const r = this.rows.find((x) => x.id === id); if (r && r.status === 'ACTIVE') { r.status = 'EXPIRED'; r.activeKey = null; this.invites?.clearBodies(r.id); } }
  async hasUsedToken(vendorId: string): Promise<boolean> { return this.rows.some((r) => r.vendorId === vendorId && r.status === 'USED'); }
}

export class MemoryInviteStore extends InviteStore {
  rows: InviteRow[] = [];
  private seq = 0;
  async findByToken(claimTokenId: string) { const r = this.rows.find((x) => x.claimTokenId === claimTokenId); return r ? { ...r } : null; }
  async create(d: NewInvite) { const r: InviteRow = { id: `inv${++this.seq}`, ...d, status: 'QUEUED', providerMessageId: null, sentAt: null, createdAt: new Date() }; this.rows.push(r); return { ...r }; }
  async markSent(id: string, providerMessageId: string | null, now: Date) { const r = this.rows.find((x) => x.id === id)!; r.status = 'SENT'; r.providerMessageId = providerMessageId; r.sentAt = now; }
  async markFailed(id: string) { this.rows.find((x) => x.id === id)!.status = 'FAILED'; }
  clearBodies(claimTokenId: string): void { for (const r of this.rows) if (r.claimTokenId === claimTokenId) r.sandboxBody = null; }
  async list() { return { items: this.rows.map((r) => ({ ...r })), total: this.rows.length }; }
}
