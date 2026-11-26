import { Injectable, Optional } from '@nestjs/common';
import { PARTNER_ROLE } from '../auth/guards/admin-role-matrix';
import { ActivityService } from '../v3-activity/activity.service';
import { checkPartnerInput, PartnerInput } from './core/partner-core';
import { partnerError } from './partners.errors';
import { PartnerRow, PartnersStore } from './partners.store';

export interface PartnerActor { id: string | null; ip?: string | null }

/** What the admin app sees of a partner. */
export const partnerView = (p: PartnerRow) => ({ id: p.id, type: p.type, name: p.name, email: p.email, phone: p.phone, status: p.status, staffUserId: p.staffUserId, pan: p.pan, createdAt: p.createdAt, updatedAt: p.updatedAt });

/**
 * Referral partners (Wave 3 Part A): create, list, edit, disable, and link the admin-team login a partner signs in with. Staff writes are audited. A partner is never deleted (it is DISABLED), so
 * its history of referred businesses and commission stays readable.
 */
@Injectable()
export class PartnersService {
  constructor(private readonly store: PartnersStore, @Optional() private readonly activity?: ActivityService) {}

  async list(q: { status?: string; type?: string; skip: number; take: number }) {
    const r = await this.store.list(q);
    return { items: r.items.map(partnerView), total: r.total };
  }

  async get(id: string) {
    const p = await this.store.get(id);
    if (!p) throw partnerError(404, 'PARTNER_NOT_FOUND', 'That partner does not exist.');
    return partnerView(p);
  }

  async create(input: PartnerInput, actor: PartnerActor) {
    const c = checkPartnerInput(input, 'create');
    if (!c.ok) throw partnerError(400, 'PARTNER_INVALID', 'Some details need fixing.', { fields: c.problems });
    const v = c.value as Required<NonNullable<typeof c.value>>;
    if (await this.store.getByEmail(v.email)) throw partnerError(409, 'PARTNER_EMAIL_TAKEN', 'A partner with that email already exists.');
    if (v.staffUserId) await this.assertLinkable(v.staffUserId, null);
    const row = await this.store.create({ type: v.type, name: v.name, email: v.email, phone: v.phone ?? null, status: v.status ?? 'ACTIVE', staffUserId: v.staffUserId ?? null, pan: v.pan ?? null }, actor.id);
    await this.record('partner.created', row.id, actor, { type: row.type, status: row.status });
    return partnerView(row);
  }

  async update(id: string, input: PartnerInput, actor: PartnerActor) {
    const c = checkPartnerInput(input, 'edit');
    if (!c.ok) throw partnerError(400, 'PARTNER_INVALID', 'Some details need fixing.', { fields: c.problems });
    const before = await this.store.get(id);
    if (!before) throw partnerError(404, 'PARTNER_NOT_FOUND', 'That partner does not exist.');
    const patch = c.value;
    if (patch.email && patch.email !== before.email && (await this.store.getByEmail(patch.email))) throw partnerError(409, 'PARTNER_EMAIL_TAKEN', 'A partner with that email already exists.');
    if (patch.staffUserId) await this.assertLinkable(patch.staffUserId, id);
    const changed = (Object.keys(patch) as Array<keyof typeof patch>).filter((k) => patch[k] !== before[k]);
    if (changed.length === 0) return partnerView(before);
    const row = await this.store.update(id, Object.fromEntries(changed.map((k) => [k, patch[k]])));
    if (!row) throw partnerError(404, 'PARTNER_NOT_FOUND', 'That partner does not exist.');
    await this.record('partner.updated', id, actor, { fields: changed });
    return partnerView(row);
  }

  /** The partner behind a signed-in referral-partner login (its admin-team member id), or null when it is not linked or the partner is disabled. */
  async forLogin(staffUserId: string): Promise<PartnerRow | null> {
    const p = await this.store.getByStaffUser(staffUserId);
    return p && p.status === 'ACTIVE' ? p : null;
  }

  /** The login a partner uses must be an existing, active admin-team member whose role is REFERRAL_PARTNER, linked to no other partner. */
  private async assertLinkable(staffUserId: string, selfId: string | null): Promise<void> {
    const m = await this.store.staffMember(staffUserId);
    // a referral partner login, or an employee with the TELECALLER label (E6): both may carry the commission of the businesses they bring in
    if (!m || (m.role !== PARTNER_ROLE && m.role !== 'TELECALLER') || m.status === 'removed') throw partnerError(400, 'PARTNER_STAFF_LINK_INVALID', 'That login does not exist or is not a referral partner or telecaller login.');
    const other = await this.store.getByStaffUser(staffUserId);
    if (other && other.id !== selfId) throw partnerError(409, 'PARTNER_STAFF_LINK_INVALID', 'That login is already linked to another partner.');
  }

  private async record(actionKey: string, entityId: string, actor: PartnerActor, summary: Record<string, unknown>): Promise<void> {
    await this.activity?.record({ vendorId: null, actor: { type: 'STAFF', id: actor.id, ip: actor.ip ?? null }, actionKey, entityType: 'ReferralPartner', entityId, summary });
  }
}
