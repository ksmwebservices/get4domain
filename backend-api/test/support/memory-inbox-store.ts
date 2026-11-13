import { InboxRow, InboxStore, InboxVendor, NewInbox } from '../../src/v3-mail/inbox.store';

export class MemoryInboxStore extends InboxStore {
  rows: InboxRow[] = []; vendors = new Map<string, InboxVendor>();
  async vendorBySubdomain(sub: string) { return this.vendors.get(sub) ?? null; }
  async insertIfNew(vendorId: string, d: NewInbox, at: Date) {
    const dup = d.messageIdHdr ? this.rows.find((r) => r.vendorId === vendorId && r.messageIdHdr === d.messageIdHdr) : undefined;
    if (dup) return { row: dup, created: false };
    const row: InboxRow = { id: `m${this.rows.length + 1}`, vendorId, ...d, forwardedAt: null, readAt: null, createdAt: at }; this.rows.push(row); return { row, created: true };
  }
  async countSince(vendorId: string, since: Date) { return this.rows.filter((r) => r.vendorId === vendorId && r.createdAt >= since).length; }
  async list(vendorId: string, f: { state?: string; excludeHeld?: boolean }, skip: number, take: number) {
    const all = this.rows.filter((r) => r.vendorId === vendorId && (f.state ? r.state === f.state : f.excludeHeld ? r.state !== 'HELD' : true)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: all.slice(skip, skip + take), total: all.length };
  }
  async get(vendorId: string, id: string) { return this.rows.find((r) => r.vendorId === vendorId && r.id === id) ?? null; }
  async setState(vendorId: string, id: string, state: string, at: Date) { const r = await this.get(vendorId, id); if (!r || r.state === 'HELD') return null; r.state = state; if (state === 'READ') r.readAt = at; return r; }
  async setForward(vendorId: string, id: string, status: string, at: Date | null) { const r = await this.get(vendorId, id); if (r) { r.forwardStatus = status; r.forwardedAt = at; } }
  async countHeld(vendorId: string) { return this.rows.filter((r) => r.vendorId === vendorId && r.state === 'HELD').length; }
}
