import { JobFields, JobState, QuoteBuilt, QuoteState } from './core/jobs-core';

export interface JobRow extends JobFields {
  id: string; vendorId: string; number: number; customerId: string | null; status: JobState; scheduledAt: Date | null; assignedTo: string | null; requestId: string | null; quoteId: string | null;
  totalPaise: number | null; payRequestId: string | null; paidAt: Date | null; cancelReason: string | null; archivedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface QuoteRow {
  id: string; vendorId: string; number: number; jobId: string | null; title: string; customerName: string; customerPhone: string | null; status: QuoteState; validUntil: string | null;
  lines: QuoteBuilt['lines']; taxablePaise: number; taxPaise: number; totalPaise: number; sentAt: Date | null; decidedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface NewJob extends JobFields { customerId: string | null; requestId: string | null; scheduledAt: Date | null; assignedTo: string | null; status?: JobState; quoteId?: string | null; totalPaise?: number | null }
export interface JobPatch { title?: string; customerName?: string; customerPhone?: string | null; address?: string | null; notes?: string | null; customerId?: string | null; scheduledAt?: Date | null; assignedTo?: string | null; quoteId?: string | null; totalPaise?: number | null; archivedAt?: Date | null }
export interface NewQuote { jobId: string | null; title: string; customerName: string; customerPhone: string | null; validUntil: string | null; built: QuoteBuilt }
export interface Paging { skip: number; take: number }

/**
 * Everything jobs and quotes store, behind one port (Prisma implementation and an in-memory twin). Every read and write carries the vendor id in its WHERE. Status changes are compare-and-set
 * (`from` must still be the current state), so two taps or two requests can never both win. Numbers are per business and never reused.
 */
export abstract class JobsStore {
  abstract createJob(vendorId: string, j: NewJob): Promise<JobRow>;
  abstract getJob(vendorId: string, id: string): Promise<JobRow | null>;
  abstract listJobs(vendorId: string, q: { status?: string; q?: string; includeArchived: boolean }, p: Paging): Promise<{ items: JobRow[]; total: number }>;
  abstract updateJob(vendorId: string, id: string, patch: JobPatch): Promise<JobRow | null>;
  /** Moves a job from `from` to `to` only if it is still in `from`. Null when it is not (or is not this business's). */
  abstract moveJob(vendorId: string, id: string, from: JobState, to: JobState, extra: { cancelReason?: string | null; payRequestId?: string | null; paidAt?: Date | null }): Promise<JobRow | null>;
  abstract jobsScheduledBetween(vendorId: string, from: Date, to: Date): Promise<JobRow[]>;
  abstract createQuote(vendorId: string, q: NewQuote): Promise<QuoteRow>;
  abstract getQuote(vendorId: string, id: string): Promise<QuoteRow | null>;
  abstract listQuotes(vendorId: string, q: { jobId?: string; status?: string }, p: Paging): Promise<{ items: QuoteRow[]; total: number }>;
  /** Replaces the lines and header of a quote that is still DRAFT. Null when it is not DRAFT any more. */
  abstract editDraftQuote(vendorId: string, id: string, patch: { title?: string; customerName?: string; customerPhone?: string | null; validUntil?: string | null; built?: QuoteBuilt }): Promise<QuoteRow | null>;
  abstract moveQuote(vendorId: string, id: string, from: QuoteState, to: QuoteState, at: Date): Promise<QuoteRow | null>;
  /** Links a quote to the job its acceptance created. */
  abstract setQuoteJob(vendorId: string, id: string, jobId: string): Promise<void>;
  /** SENT quotes whose last day is before `today` (YYYY-MM-DD) become EXPIRED. Returns how many. */
  abstract expireQuotes(vendorId: string, today: string, at: Date): Promise<number>;
}
