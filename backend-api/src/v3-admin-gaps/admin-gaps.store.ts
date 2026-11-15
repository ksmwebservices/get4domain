import { ListingStateWord, VendorFilter } from './core/admin-gaps-core';

export interface AdminVendorRow {
  id: string; name: string; businessName: string; email: string; phone: string | null; industry: string | null; status: string; subdomain: string | null; createdAt: Date;
  plan: { key: string; name: string; level: string; track: string; status: string } | null;
  listingState: ListingStateWord | null;
}
export interface NoteRow { id: string; vendorId: string; body: string; byStaffId: string | null; byName: string; createdAt: Date }

/** Staff-side reads and the one staff-side write (notes) of the Wave 2 Part C routes. Notes are append only. */
export abstract class AdminGapsStore {
  abstract listVendors(f: VendorFilter): Promise<{ items: AdminVendorRow[]; total: number }>;
  abstract vendorExists(vendorId: string): Promise<boolean>;
  /** Enquiries held while the vendor's plan is not active. A count only. */
  abstract heldCount(vendorId: string): Promise<number>;
  abstract listNotes(vendorId: string, skip: number, take: number): Promise<{ items: NoteRow[]; total: number }>;
  abstract addNote(vendorId: string, body: string, by: { id: string | null; name: string }): Promise<NoteRow>;
  /** The staff member's name as written in the staff list (or the bootstrap admin's), else null. */
  abstract staffName(staffId: string): Promise<string | null>;
}
