import { LedgerStatus, Slab } from './core/referral-core';

export interface LinkRow { id: string; partnerId: string; code: string; active: boolean; createdById: string | null; disabledAt: Date | null; createdAt: Date }
export interface AttributionRow { id: string; vendorId: string; partnerId: string; linkId: string | null; source: 'REGISTER' | 'ON_BEHALF' | 'ADMIN_CHANGE'; setById: string | null; reason: string | null; createdAt: Date }
export interface SlabRow extends Slab { createdById: string | null }
export interface LedgerRow { id: string; partnerId: string; vendorId: string; month: string; orderId: string; qualifiedAt: Date; amountMinor: number | null; status: LedgerStatus; flagged: boolean; flagReason: string | null; approvedAt: Date | null; payoutId: string | null; createdAt: Date }
export interface PayoutRow { id: string; partnerId: string; month: string; totalMinor: number; status: string; reference: string; paidById: string | null; paidAt: Date; createdAt: Date }
export interface VendorFacts { id: string; email: string; phone: string | null; businessName: string; state: string | null }

/** Platform data (staff-only tables): links, attributions, slabs, the ledger and the payouts. Every method is a plain read or write; the rules are in the core and the service. */
export abstract class ReferralsStore {
  abstract createLink(partnerId: string, code: string, createdById: string | null): Promise<LinkRow | null>;   // null when the code already exists
  abstract getLinkByCode(code: string): Promise<LinkRow | null>;
  abstract getLink(id: string): Promise<LinkRow | null>;
  abstract listLinks(partnerId: string): Promise<LinkRow[]>;
  abstract setLinkActive(id: string, active: boolean, at: Date): Promise<LinkRow | null>;

  abstract getAttribution(vendorId: string): Promise<AttributionRow | null>;
  /** inserts, or returns the existing row (the first touch wins: vendorId is unique) */
  abstract createAttribution(r: Omit<AttributionRow, 'id' | 'createdAt'>): Promise<{ created: boolean; row: AttributionRow }>;
  abstract replaceAttribution(vendorId: string, patch: { partnerId: string; linkId: string | null; source: 'ADMIN_CHANGE'; setById: string | null; reason: string | null }): Promise<AttributionRow | null>;
  abstract attributionsOfPartner(partnerId: string, skip: number, take: number): Promise<{ items: Array<AttributionRow & { vendor: VendorFacts | null }>; total: number }>;
  abstract vendorFacts(vendorId: string): Promise<VendorFacts | null>;

  abstract listSlabs(): Promise<SlabRow[]>;
  abstract getSlab(id: string): Promise<SlabRow | null>;
  abstract createSlab(r: Omit<SlabRow, 'id'>): Promise<SlabRow>;
  abstract updateSlab(id: string, r: Partial<Omit<SlabRow, 'id'>>): Promise<SlabRow | null>;

  abstract getLineByVendor(vendorId: string): Promise<LedgerRow | null>;
  /** inserts, or returns the existing row (a vendor counts once: vendorId is unique) */
  abstract createLine(r: Omit<LedgerRow, 'id' | 'createdAt' | 'amountMinor' | 'status' | 'flagged' | 'flagReason' | 'approvedAt' | 'payoutId'>): Promise<{ created: boolean; row: LedgerRow }>;
  abstract linesOfMonth(month: string): Promise<LedgerRow[]>;
  abstract listLines(q: { month?: string; partnerId?: string; status?: LedgerStatus; skip: number; take: number }): Promise<{ items: LedgerRow[]; total: number }>;
  abstract linesOfPartnerMonth(partnerId: string, month: string): Promise<LedgerRow[]>;
  /** ACCRUED -> APPROVED with the amount, in one unit; only lines that are still ACCRUED change; returns how many */
  abstract approveLines(items: Array<{ id: string; amountMinor: number }>, at: Date): Promise<number>;
  abstract reverseLine(vendorId: string, reason: string): Promise<LedgerRow | null>;

  abstract getPayout(partnerId: string, month: string): Promise<PayoutRow | null>;
  /** one unit: the payout row and APPROVED -> PAID for exactly these lines; null when a payout for that partner and month already exists */
  abstract createPayout(p: { partnerId: string; month: string; totalMinor: number; reference: string; paidById: string | null; paidAt: Date }, lineIds: string[]): Promise<PayoutRow | null>;
  abstract listPayouts(q: { partnerId?: string; month?: string; skip: number; take: number }): Promise<{ items: PayoutRow[]; total: number }>;
}
