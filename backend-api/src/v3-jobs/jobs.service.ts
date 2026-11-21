import { Injectable } from '@nestjs/common';
import { KeyedQueue } from '../common/keyed-queue';
import { CustomerCapture } from '../v3-business/customer-capture';
import { TaxRateSource } from '../v3-business/tax-rate-source';
import { parseRange } from '../v3-accounts/core/accounts-core';
import { buildQuote, calendarDays, canJobMove, canQuoteMove, checkJobInput, isJobState, JobState, jobStateAfterQuote, QuoteState } from './core/jobs-core';
import { jobsError } from './jobs.errors';
import { JobRow, JobsStore, QuoteRow } from './jobs.store';

/** Whether a payment request of this business was confirmed paid (Stage 9), and for how much. Read only; this module never marks money received. */
export abstract class PaymentFacts { abstract confirmed(vendorId: string, payRequestId: string): Promise<{ amountPaise: number } | null> }
export { CustomerCapture };

export interface JobInput { title?: unknown; customerName?: unknown; customerPhone?: unknown; address?: unknown; notes?: unknown; assignedTo?: unknown; scheduledAt?: unknown; requestId?: unknown }
export interface QuoteInput { jobId?: string; title?: unknown; customerName?: unknown; customerPhone?: unknown; validUntil?: unknown; lines?: unknown }

const acceptQueue = new KeyedQueue();
const IST_MS = 330 * 60_000;
const notFound = (what: string) => jobsError(404, 'JOBS_NOT_FOUND', `That ${what} was not found.`);
const stateError = (m: string) => jobsError(409, 'JOBS_STATE', m);

const jobView = (j: JobRow) => ({ id: j.id, number: j.number, title: j.title, customerName: j.customerName, customerPhone: j.customerPhone, customerId: j.customerId, address: j.address, notes: j.notes, status: j.status, scheduledAt: j.scheduledAt, assignedTo: j.assignedTo, quoteId: j.quoteId, totalPaise: j.totalPaise, payRequestId: j.payRequestId, paidAt: j.paidAt, cancelReason: j.cancelReason, archived: j.archivedAt !== null, createdAt: j.createdAt });
const quoteView = (q: QuoteRow) => ({ id: q.id, number: q.number, jobId: q.jobId, title: q.title, customerName: q.customerName, customerPhone: q.customerPhone, status: q.status, validUntil: q.validUntil, lines: q.lines, taxablePaise: q.taxablePaise, taxPaise: q.taxPaise, totalPaise: q.totalPaise, sentAt: q.sentAt, decidedAt: q.decidedAt, createdAt: q.createdAt });
const dayOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && parseRange(v, v).ok;

/**
 * Jobs and quotes of a Handyman business (slice 5.24a): request, quote, booking, job, paid. The plan gate is the route's `@RequiresFeature('jobs.manage')`. Every status change is compare-and-set;
 * accepting a quote runs one at a time per quote, so it creates its job once. A job becomes PAID only from a payment the business confirmed (Stage 9) for the amount of the accepted quote.
 */
@Injectable()
export class JobsService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: JobsStore, private readonly rates: TaxRateSource, private readonly pay: PaymentFacts, private readonly customers: CustomerCapture) {}

  private today(): string { return new Date(this.clock().getTime() + IST_MS).toISOString().slice(0, 10); }
  private when(v: unknown): Date | null | undefined {
    if (v === undefined) return undefined; if (v === null || v === '') return null;
    const t = typeof v === 'string' ? Date.parse(v) : NaN; if (Number.isNaN(t)) throw jobsError(400, 'JOBS_INVALID', 'scheduledAt: a date and time, ISO 8601.'); return new Date(t);
  }

  // ── jobs ──
  async createJob(vendorId: string, i: JobInput) {
    const c = checkJobInput(i); if (!c.ok) throw jobsError(400, 'JOBS_INVALID', c.problems.join('; '));
    const scheduledAt = this.when(i.scheduledAt) ?? null; const assignedTo = typeof i.assignedTo === 'string' && i.assignedTo.trim() ? i.assignedTo.trim().slice(0, 80) : null;
    const requestId = typeof i.requestId === 'string' && i.requestId ? i.requestId.slice(0, 40) : null;
    let job = await this.store.createJob(vendorId, { ...c.value, customerId: null, requestId, scheduledAt, assignedTo });
    if (c.value.customerPhone) {
      const customerId = await this.customers.capture(vendorId, { name: c.value.customerName, phone: c.value.customerPhone, refType: 'job', refId: job.id });
      if (customerId) job = (await this.store.updateJob(vendorId, job.id, { customerId })) ?? job;
    }
    return jobView(job);
  }
  async listJobs(vendorId: string, q: { status?: string; q?: string; includeArchived?: boolean }, page: number, pageSize: number) {
    if (q.status !== undefined && !isJobState(q.status)) throw jobsError(400, 'JOBS_INVALID', 'status: not a job state.');
    const r = await this.store.listJobs(vendorId, { status: q.status, q: q.q?.slice(0, 80), includeArchived: q.includeArchived === true }, { skip: (page - 1) * pageSize, take: pageSize });
    return { items: r.items.map(jobView), total: r.total };
  }
  async getJob(vendorId: string, id: string) { const j = await this.store.getJob(vendorId, id); if (!j) throw notFound('job'); return jobView(j); }
  async updateJob(vendorId: string, id: string, p: JobInput) {
    const cur = await this.store.getJob(vendorId, id); if (!cur) throw notFound('job');
    const c = checkJobInput({ title: p.title ?? cur.title, customerName: p.customerName ?? cur.customerName, customerPhone: p.customerPhone === undefined ? cur.customerPhone : p.customerPhone, address: p.address === undefined ? cur.address : p.address, notes: p.notes === undefined ? cur.notes : p.notes });
    if (!c.ok) throw jobsError(400, 'JOBS_INVALID', c.problems.join('; '));
    const assignedTo = p.assignedTo === undefined ? undefined : typeof p.assignedTo === 'string' && p.assignedTo.trim() ? p.assignedTo.trim().slice(0, 80) : null;
    const row = await this.store.updateJob(vendorId, id, { ...c.value, assignedTo, scheduledAt: this.when(p.scheduledAt) }); if (!row) throw notFound('job');
    return jobView(row);
  }
  async archiveJob(vendorId: string, id: string, archived: boolean) { const row = await this.store.updateJob(vendorId, id, { archivedAt: archived ? this.clock() : null }); if (!row) throw notFound('job'); return jobView(row); }

  /** One step along the allowed path. PAID is refused here: it comes only from `markPaid`. */
  async moveJob(vendorId: string, id: string, to: JobState, reason?: string) {
    if (!isJobState(to)) throw jobsError(400, 'JOBS_INVALID', 'status: not a job state.');
    if (to === 'PAID') throw jobsError(409, 'JOBS_PAYMENT_ONLY', 'A job becomes paid only from a payment you have confirmed.');
    const cur = await this.store.getJob(vendorId, id); if (!cur) throw notFound('job');
    if (!canJobMove(cur.status, to)) throw stateError(`A job that is ${cur.status} cannot become ${to}.`);
    const row = await this.store.moveJob(vendorId, id, cur.status, to, to === 'CANCELLED' ? { cancelReason: reason?.trim().slice(0, 300) || null } : {});
    if (!row) throw stateError('That job changed while you were working on it. Open it again.');
    return jobView(row);
  }

  async markPaid(vendorId: string, id: string, payRequestId: string) {
    const cur = await this.store.getJob(vendorId, id); if (!cur) throw notFound('job');
    if (!canJobMove(cur.status, 'PAID')) throw stateError(`A job that is ${cur.status} cannot become PAID.`);
    const fact = await this.pay.confirmed(vendorId, payRequestId);
    if (!fact) throw jobsError(409, 'JOBS_NOT_PAID', 'That payment request is not a payment you have confirmed.');
    if (cur.totalPaise !== null && fact.amountPaise !== cur.totalPaise) throw jobsError(409, 'JOBS_NOT_PAID', 'The confirmed amount is not the amount of the accepted quote.');
    const row = await this.store.moveJob(vendorId, id, 'DONE', 'PAID', { payRequestId, paidAt: this.clock() });
    if (!row) throw stateError('That job changed while you were working on it. Open it again.');
    return jobView(row);
  }

  async calendar(vendorId: string, fromDay: string, toDay: string) {
    const r = parseRange(fromDay, toDay); if (!r.ok) throw jobsError(400, 'JOBS_INVALID', 'from and to: two days, YYYY-MM-DD, at most one year apart.');
    const jobs = await this.store.jobsScheduledBetween(vendorId, new Date(r.fromMs), new Date(r.toMs));
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return calendarDays(jobs.map((j) => ({ id: j.id, at: (j.scheduledAt as Date).getTime() }))).map((d) => ({ day: d.day, jobs: d.ids.map((x) => jobView(byId.get(x) as JobRow)) }));
  }

  // ── quotes ──
  async createQuote(vendorId: string, i: QuoteInput) {
    const job = i.jobId ? await this.store.getJob(vendorId, i.jobId) : null; if (i.jobId && !job) throw notFound('job');
    const title = typeof i.title === 'string' && i.title.trim() ? i.title.trim().replace(/\s+/g, ' ').slice(0, 120) : job?.title ?? '';
    const customerName = typeof i.customerName === 'string' && i.customerName.trim() ? i.customerName.trim().replace(/\s+/g, ' ').slice(0, 120) : job?.customerName ?? '';
    if (!title || !customerName) throw jobsError(400, 'JOBS_INVALID', 'title and customerName: 1 to 120 characters.');
    if (i.validUntil !== undefined && i.validUntil !== null && !dayOk(i.validUntil)) throw jobsError(400, 'JOBS_INVALID', 'validUntil: YYYY-MM-DD.');
    const built = buildQuote(i.lines, await this.rates.activeRates(this.clock())); if (!built.ok) throw jobsError(400, 'JOBS_INVALID', built.problems.join('; '));
    const customerPhone = typeof i.customerPhone === 'string' && i.customerPhone.trim() ? i.customerPhone.trim().slice(0, 20) : job?.customerPhone ?? null;
    return quoteView(await this.store.createQuote(vendorId, { jobId: job?.id ?? null, title, customerName, customerPhone, validUntil: (i.validUntil as string | null | undefined) ?? null, built: built.value }));
  }
  async listQuotes(vendorId: string, q: { jobId?: string; status?: string }, page: number, pageSize: number) {
    await this.store.expireQuotes(vendorId, this.today(), this.clock());
    const r = await this.store.listQuotes(vendorId, q, { skip: (page - 1) * pageSize, take: pageSize }); return { items: r.items.map(quoteView), total: r.total };
  }
  async getQuote(vendorId: string, id: string) { await this.store.expireQuotes(vendorId, this.today(), this.clock()); const q = await this.store.getQuote(vendorId, id); if (!q) throw notFound('quote'); return quoteView(q); }
  async editQuote(vendorId: string, id: string, p: QuoteInput) {
    const cur = await this.store.getQuote(vendorId, id); if (!cur) throw notFound('quote');
    if (cur.status !== 'DRAFT') throw stateError('Only a draft quote can be changed.');
    let built; if (p.lines !== undefined) { const b = buildQuote(p.lines, await this.rates.activeRates(this.clock())); if (!b.ok) throw jobsError(400, 'JOBS_INVALID', b.problems.join('; ')); built = b.value; }
    if (p.validUntil !== undefined && p.validUntil !== null && !dayOk(p.validUntil)) throw jobsError(400, 'JOBS_INVALID', 'validUntil: YYYY-MM-DD.');
    const row = await this.store.editDraftQuote(vendorId, id, {
      title: typeof p.title === 'string' && p.title.trim() ? p.title.trim().slice(0, 120) : undefined, customerName: typeof p.customerName === 'string' && p.customerName.trim() ? p.customerName.trim().slice(0, 120) : undefined,
      customerPhone: p.customerPhone === undefined ? undefined : typeof p.customerPhone === 'string' && p.customerPhone.trim() ? p.customerPhone.trim().slice(0, 20) : null, validUntil: p.validUntil as string | null | undefined, built,
    });
    if (!row) throw stateError('Only a draft quote can be changed.');
    return quoteView(row);
  }

  private async moveQuote(vendorId: string, id: string, to: QuoteState): Promise<QuoteRow> {
    await this.store.expireQuotes(vendorId, this.today(), this.clock());
    const cur = await this.store.getQuote(vendorId, id); if (!cur) throw notFound('quote');
    if (cur.status === 'EXPIRED' && to !== 'EXPIRED') throw jobsError(409, 'JOBS_QUOTE_EXPIRED', 'This quote has passed its last day.');
    if (!canQuoteMove(cur.status, to)) throw stateError(`A quote that is ${cur.status} cannot become ${to}.`);
    const row = await this.store.moveQuote(vendorId, id, cur.status, to, this.clock()); if (!row) throw stateError('That quote changed while you were working on it. Open it again.');
    return row;
  }
  /** Marking a quote sent records that the business gave it to the customer; this build sends nothing. */
  async sendQuote(vendorId: string, id: string) {
    const q = await this.moveQuote(vendorId, id, 'SENT');
    if (q.jobId) { const job = await this.store.getJob(vendorId, q.jobId); if (job) { const next = jobStateAfterQuote(job.status, 'SENT'); if (next !== job.status) await this.store.moveJob(vendorId, job.id, job.status, next, {}); } }
    return quoteView(q);
  }
  async declineQuote(vendorId: string, id: string) { return quoteView(await this.moveQuote(vendorId, id, 'DECLINED')); }

  /** Accepting books the job, creating it when the quote had none. Runs one at a time per quote, so ten taps make one job. */
  async acceptQuote(vendorId: string, id: string): Promise<{ quote: ReturnType<typeof quoteView>; job: ReturnType<typeof jobView> }> {
    return acceptQueue.run(`accept:${vendorId}:${id}`, async () => {
      await this.store.expireQuotes(vendorId, this.today(), this.clock());
      const cur = await this.store.getQuote(vendorId, id); if (!cur) throw notFound('quote');
      if (cur.status === 'ACCEPTED' && cur.jobId) { const j = await this.store.getJob(vendorId, cur.jobId); if (j) return { quote: quoteView(cur), job: jobView(j) }; }
      if (cur.status === 'EXPIRED') throw jobsError(409, 'JOBS_QUOTE_EXPIRED', 'This quote has passed its last day.');
      if (cur.status !== 'SENT') throw stateError(`A quote that is ${cur.status} cannot be accepted.`);
      let job = cur.jobId ? await this.store.getJob(vendorId, cur.jobId) : null;
      if (job && (job.status === 'DONE' || job.status === 'PAID' || job.status === 'CANCELLED')) throw stateError(`A job that is ${job.status} cannot take a new accepted quote.`);
      const quote = await this.store.moveQuote(vendorId, id, 'SENT', 'ACCEPTED', this.clock()); if (!quote) throw stateError('That quote changed while you were working on it. Open it again.');
      if (job) {
        const next = jobStateAfterQuote(job.status, 'ACCEPTED'); if (next !== job.status) job = (await this.store.moveJob(vendorId, job.id, job.status, next, {})) ?? job;
        job = (await this.store.updateJob(vendorId, job.id, { quoteId: quote.id, totalPaise: quote.totalPaise })) ?? job;
      } else {
        job = await this.store.createJob(vendorId, { title: quote.title, customerName: quote.customerName, customerPhone: quote.customerPhone, address: null, notes: null, customerId: null, requestId: null, scheduledAt: null, assignedTo: null, status: 'BOOKED', quoteId: quote.id, totalPaise: quote.totalPaise });
        await this.store.setQuoteJob(vendorId, quote.id, job.id);
        if (quote.customerPhone) { const customerId = await this.customers.capture(vendorId, { name: quote.customerName, phone: quote.customerPhone, refType: 'job', refId: job.id }); if (customerId) job = (await this.store.updateJob(vendorId, job.id, { customerId })) ?? job; }
      }
      return { quote: quoteView({ ...quote, jobId: job.id }), job: jobView(job) };
    });
  }
}
