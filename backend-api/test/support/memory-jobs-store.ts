import { JobState, QuoteState } from '../../src/v3-jobs/core/jobs-core';
import { JobPatch, JobRow, JobsStore, NewJob, NewQuote, Paging, QuoteRow } from '../../src/v3-jobs/jobs.store';

const clean = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** In-memory twin of the jobs store: same vendor scoping, same compare-and-set moves, per-business numbers. Check and write happen with no await in between, like one conditional statement. */
export class MemoryJobsStore extends JobsStore {
  jobs: JobRow[] = []; quotes: QuoteRow[] = []; private n = 0;
  private next(rows: Array<{ vendorId: string; number: number }>, vendorId: string): number { return rows.filter((r) => r.vendorId === vendorId).reduce((a, r) => Math.max(a, r.number), 0) + 1; }
  async createJob(vendorId: string, j: NewJob) {
    const row: JobRow = { ...j, id: `j${++this.n}`, vendorId, number: this.next(this.jobs, vendorId), status: j.status ?? 'REQUESTED', quoteId: j.quoteId ?? null, totalPaise: j.totalPaise ?? null, payRequestId: null, paidAt: null, cancelReason: null, archivedAt: null, createdAt: new Date(2026, 10, 12, 0, 0, this.n), updatedAt: new Date() };
    this.jobs.push(row); return { ...row };
  }
  async getJob(vendorId: string, id: string) { const r = this.jobs.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; }
  async listJobs(vendorId: string, q: { status?: string; q?: string; includeArchived: boolean }, p: Paging) {
    const all = this.jobs.filter((x) => x.vendorId === vendorId && (q.includeArchived || !x.archivedAt) && (!q.status || x.status === q.status) && (!q.q || `${x.title} ${x.customerName}`.toLowerCase().includes(q.q.toLowerCase()))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: all.slice(p.skip, p.skip + p.take).map((r) => ({ ...r })), total: all.length };
  }
  async updateJob(vendorId: string, id: string, patch: JobPatch) { const r = this.jobs.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null; Object.assign(r, clean(patch), { updatedAt: new Date() }); return { ...r }; }
  async moveJob(vendorId: string, id: string, from: JobState, to: JobState, extra: { cancelReason?: string | null; payRequestId?: string | null; paidAt?: Date | null }) {
    const r = this.jobs.find((x) => x.id === id && x.vendorId === vendorId && x.status === from); if (!r) return null; Object.assign(r, clean(extra), { status: to, updatedAt: new Date() }); return { ...r };
  }
  async jobsScheduledBetween(vendorId: string, from: Date, to: Date) { return this.jobs.filter((x) => x.vendorId === vendorId && !x.archivedAt && x.status !== 'CANCELLED' && x.scheduledAt && x.scheduledAt >= from && x.scheduledAt < to).map((r) => ({ ...r })); }
  async createQuote(vendorId: string, q: NewQuote) {
    const row: QuoteRow = { id: `q${++this.n}`, vendorId, number: this.next(this.quotes, vendorId), jobId: q.jobId, title: q.title, customerName: q.customerName, customerPhone: q.customerPhone, status: 'DRAFT', validUntil: q.validUntil, lines: q.built.lines, taxablePaise: q.built.taxablePaise, taxPaise: q.built.taxPaise, totalPaise: q.built.totalPaise, sentAt: null, decidedAt: null, createdAt: new Date(), updatedAt: new Date() };
    this.quotes.push(row); return { ...row };
  }
  async getQuote(vendorId: string, id: string) { const r = this.quotes.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; }
  async listQuotes(vendorId: string, q: { jobId?: string; status?: string }, p: Paging) {
    const all = this.quotes.filter((x) => x.vendorId === vendorId && (!q.jobId || x.jobId === q.jobId) && (!q.status || x.status === q.status)).sort((a, b) => b.number - a.number);
    return { items: all.slice(p.skip, p.skip + p.take).map((r) => ({ ...r })), total: all.length };
  }
  async editDraftQuote(vendorId: string, id: string, patch: { title?: string; customerName?: string; customerPhone?: string | null; validUntil?: string | null; built?: NewQuote['built'] }) {
    const r = this.quotes.find((x) => x.id === id && x.vendorId === vendorId && x.status === 'DRAFT'); if (!r) return null;
    const { built, ...rest } = patch; Object.assign(r, clean(rest), built ? { lines: built.lines, taxablePaise: built.taxablePaise, taxPaise: built.taxPaise, totalPaise: built.totalPaise } : {}, { updatedAt: new Date() }); return { ...r };
  }
  async moveQuote(vendorId: string, id: string, from: QuoteState, to: QuoteState, at: Date) {
    const r = this.quotes.find((x) => x.id === id && x.vendorId === vendorId && x.status === from); if (!r) return null;
    r.status = to; if (to === 'SENT') r.sentAt = at; else r.decidedAt = at; r.updatedAt = new Date(); return { ...r };
  }
  async setQuoteJob(vendorId: string, id: string, jobId: string) { const r = this.quotes.find((x) => x.id === id && x.vendorId === vendorId); if (r) r.jobId = jobId; }
  async expireQuotes(vendorId: string, today: string, at: Date) { let n = 0; for (const r of this.quotes) if (r.vendorId === vendorId && r.status === 'SENT' && r.validUntil !== null && r.validUntil < today) { r.status = 'EXPIRED'; r.decidedAt = at; n++; } return n; }
}
