import { PartnerFields } from './core/partner-core';

export interface PartnerRow extends PartnerFields { id: string; createdById: string | null; createdAt: Date; updatedAt: Date }
export interface StaffMemberRef { id: string; role: string; email: string; status: string }

/** Platform data (no vendor id): the referral partners and the admin-team member each one may sign in as. */
export abstract class PartnersStore {
  abstract list(i: { status?: string; type?: string; skip: number; take: number }): Promise<{ items: PartnerRow[]; total: number }>;
  abstract get(id: string): Promise<PartnerRow | null>;
  abstract getByStaffUser(staffUserId: string): Promise<PartnerRow | null>;
  abstract getByEmail(email: string): Promise<PartnerRow | null>;
  abstract create(f: PartnerFields, createdById: string | null): Promise<PartnerRow>;
  abstract update(id: string, patch: Partial<PartnerFields>): Promise<PartnerRow | null>;
  abstract staffMember(id: string): Promise<StaffMemberRef | null>;
}
