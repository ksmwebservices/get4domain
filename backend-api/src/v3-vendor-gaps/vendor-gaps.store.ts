import { PromoKind } from './core/gaps-core';

export interface MigrationRequestRow { id: string; vendorId: string; siteUrl: string; status: string; createdAt: Date; updatedAt: Date }
export interface PromoDraftRow { id: string; vendorId: string; kind: PromoKind; channel: string; title: string; body: string; status: string; createdAt: Date; updatedAt: Date; archivedAt: Date | null }
export interface TeamRow { id: string; vendorId: string; name: string; role: string; department: string | null; status: string; areas: string[]; createdAt: Date; lastLogin: Date | null }
export interface Who { type: string; id: string | null }

/** Tenant data of the Wave 2 Part B vendor routes. Every method names the vendor and puts it in every where clause. */
export abstract class VendorGapsStore {
  // migration requests (record only)
  abstract listMigrationRequests(vendorId: string): Promise<MigrationRequestRow[]>;
  /** null when the vendor already has an open request (the database key decides, so two clicks cannot both open one). */
  abstract openMigrationRequest(vendorId: string, siteUrl: string, by: Who): Promise<MigrationRequestRow | null>;

  // promotion and social drafts
  abstract listPromoDrafts(vendorId: string, kind: PromoKind, includeArchived: boolean, skip: number, take: number): Promise<{ items: PromoDraftRow[]; total: number }>;
  abstract createPromoDraft(vendorId: string, kind: PromoKind, row: { channel: string; title: string; body: string }, by: Who): Promise<PromoDraftRow>;
  abstract archivePromoDraft(vendorId: string, kind: PromoKind, id: string): Promise<PromoDraftRow | null>;

  // team (the vendor's own people; the same table the team login reads)
  abstract listTeam(vendorId: string): Promise<TeamRow[]>;
  abstract getTeamMember(vendorId: string, id: string): Promise<TeamRow | null>;
  /** null when a member with this email already exists for the vendor. */
  abstract createTeamInvite(vendorId: string, row: { name: string; email: string | null; phone: string | null; role: string; department: string | null; areas: string[] }): Promise<TeamRow | null>;
  abstract updateTeamMember(vendorId: string, id: string, patch: { role?: string; department?: string | null; areas?: string[] }): Promise<TeamRow | null>;
  /** Sets the status to deactivated (they can no longer sign in); the row and its history stay. */
  abstract setTeamStatus(vendorId: string, id: string, status: 'deactivated' | 'active'): Promise<TeamRow | null>;

}
