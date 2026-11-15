import { Injectable, Optional } from '@nestjs/common';
import { ActivityService } from '../v3-activity/activity.service';
import { adminGapError } from './admin-gaps.errors';
import { AdminGapsStore } from './admin-gaps.store';
import { checkNote, checkVendorFilter, permissionMatrix, VendorListQuery } from './core/admin-gaps-core';

export interface StaffWho { id: string | null; email: string; ip: string | null }

/** The Wave 2 Part C staff reads (the permission matrix, the vendors list, a vendor's held count) and the staff notes. Every staff write leaves an activity row. */
@Injectable()
export class AdminGapsService {
  constructor(private readonly store: AdminGapsStore, @Optional() private readonly activity?: ActivityService) {}

  /** C1 */
  matrix() { return permissionMatrix(); }

  /** C3 */
  async vendors(q: VendorListQuery) {
    const f = checkVendorFilter(q);
    if (!f.ok) throw adminGapError(400, 'ADMIN_GAP_INVALID', 'Some filters need fixing.', { fields: f.errors });
    const r = await this.store.listVendors(f.value);
    return { items: r.items.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })), total: r.total, page: f.value.page, pageSize: f.value.pageSize };
  }

  private async mustExist(vendorId: string): Promise<void> {
    if (!(await this.store.vendorExists(String(vendorId).slice(0, 64)))) throw adminGapError(404, 'ADMIN_VENDOR_NOT_FOUND', 'That business was not found.');
  }

  /** C4: a count only, never a sender, a subject or a text. */
  async heldCount(vendorId: string): Promise<{ count: number }> { await this.mustExist(vendorId); return { count: await this.store.heldCount(vendorId) }; }

  /** C5 */
  async notes(vendorId: string, page: number, pageSize: number) {
    await this.mustExist(vendorId);
    const p = Math.max(1, Math.floor(Number(page)) || 1); const s = Math.min(100, Math.max(1, Math.floor(Number(pageSize)) || 25));
    const r = await this.store.listNotes(vendorId, (p - 1) * s, s);
    return { items: r.items.map((n) => ({ id: n.id, body: n.body, byStaffId: n.byStaffId, byName: n.byName, createdAt: n.createdAt.toISOString() })), total: r.total, page: p, pageSize: s };
  }
  async addNote(vendorId: string, body: unknown, who: StaffWho) {
    await this.mustExist(vendorId);
    const c = checkNote(body);
    if (!c.ok) throw adminGapError(400, 'ADMIN_GAP_INVALID', 'The note needs fixing.', { fields: { body: c.error } });
    const name = (who.id ? await this.store.staffName(who.id) : null) ?? who.email;
    const n = await this.store.addNote(vendorId, c.value, { id: who.id, name });
    await this.activity?.record({ vendorId, actor: { type: 'STAFF', id: who.id, ip: who.ip }, actionKey: 'vendor.note_added', entityType: 'vendor_note', entityId: n.id, summary: { length: c.value.length } });
    return { id: n.id, body: n.body, byStaffId: n.byStaffId, byName: n.byName, createdAt: n.createdAt.toISOString() };
  }
}
