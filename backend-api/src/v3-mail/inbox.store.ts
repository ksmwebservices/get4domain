export interface InboxRow {
  id: string; vendorId: string; toAddress: string; fromAddress: string; fromName: string | null; subject: string; bodyText: string; messageIdHdr: string | null; sizeBytes: number;
  spamScore: number | null; spamVerdict: string; state: string; forwardStatus: string; forwardedAt: Date | null; readAt: Date | null; createdAt: Date;
}
export interface NewInbox { toAddress: string; fromAddress: string; fromName: string | null; subject: string; bodyText: string; messageIdHdr: string | null; sizeBytes: number; spamScore: number | null; spamVerdict: string; state: string; forwardStatus: string }
export interface InboxVendor { id: string; email: string; status: string }

/** Every query that takes a vendor names it. `vendorBySubdomain` is the one platform-wide lookup (the Worker's address check). */
export abstract class InboxStore {
  abstract vendorBySubdomain(subdomain: string): Promise<InboxVendor | null>;
  /** Serialised per vendor by the service (KeyedQueue) so the rate check and the insert cannot interleave. A repeated message id for the vendor returns the first row with created=false. */
  abstract insertIfNew(vendorId: string, d: NewInbox, at: Date): Promise<{ row: InboxRow; created: boolean }>;
  abstract countSince(vendorId: string, since: Date): Promise<number>;
  abstract list(vendorId: string, f: { state?: string; excludeHeld?: boolean }, skip: number, take: number): Promise<{ items: InboxRow[]; total: number }>;
  abstract get(vendorId: string, id: string): Promise<InboxRow | null>;
  abstract setState(vendorId: string, id: string, state: string, at: Date): Promise<InboxRow | null>;
  abstract setForward(vendorId: string, id: string, status: string, at: Date | null): Promise<void>;
  abstract countHeld(vendorId: string): Promise<number>;
}
