import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { KeyedQueue } from '../common/keyed-queue';
import { PrismaService } from '../prisma/prisma.service';
import { JobState, QuoteBuilt, QuoteState } from './core/jobs-core';
import { JobPatch, JobRow, JobsStore, NewJob, NewQuote, Paging, QuoteRow } from './jobs.store';

type DbJob = Prisma.V3JobGetPayload<Record<string, never>>;
type DbQuote = Prisma.V3QuoteGetPayload<Record<string, never>>;
const job = (r: DbJob): JobRow => ({ id: r.id, vendorId: r.vendorId, number: r.number, title: r.title, customerName: r.customerName, customerPhone: r.customerPhone, customerId: r.customerId, address: r.address, notes: r.notes, status: r.status as JobState, scheduledAt: r.scheduledAt, assignedTo: r.assignedTo, requestId: r.requestId, quoteId: r.quoteId, totalPaise: r.totalPaise, payRequestId: r.payRequestId, paidAt: r.paidAt, cancelReason: r.cancelReason, archivedAt: r.archivedAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const quote = (r: DbQuote): QuoteRow => ({ id: r.id, vendorId: r.vendorId, number: r.number, jobId: r.jobId, title: r.title, customerName: r.customerName, customerPhone: r.customerPhone, status: r.status as QuoteState, validUntil: r.validUntil, lines: (Array.isArray(r.linesJson) ? r.linesJson : []) as unknown as QuoteBuilt['lines'], taxablePaise: r.taxablePaise, taxPaise: r.taxPaise, totalPaise: r.totalPaise, sentAt: r.sentAt, decidedAt: r.decidedAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
const ATTEMPTS = 6;
/** Taking the next number is serialised per business inside this process (before any query, never inside a transaction); the unique index and the retry cover a second instance. */
const numbering = new KeyedQueue();

@Injectable()
export class PrismaJobsStore extends JobsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  createJob(vendorId: string, j: NewJob): Promise<JobRow> { return numbering.run(`job:${vendorId}`, () => this.insertJob(vendorId, j)); }
  private async insertJob(vendorId: string, j: NewJob): Promise<JobRow> {
    for (let i = 0; i < ATTEMPTS; i++) {
      const last = await this.prisma.v3Job.findFirst({ where: { vendorId }, orderBy: { number: 'desc' }, select: { number: true } });
      try { return job(await this.prisma.v3Job.create({ data: { vendorId, number: (last?.number ?? 0) + 1, title: j.title, customerName: j.customerName, customerPhone: j.customerPhone, customerId: j.customerId, address: j.address, notes: j.notes, requestId: j.requestId, scheduledAt: j.scheduledAt, assignedTo: j.assignedTo, status: j.status ?? 'REQUESTED', quoteId: j.quoteId ?? null, totalPaise: j.totalPaise ?? null } })); }
      catch (e) { if (!isUnique(e) || i === ATTEMPTS - 1) throw e; }   // another job took this number a moment ago: read the last number again
    }
    throw new Error('unreachable');
  }
  async getJob(vendorId: string, id: string): Promise<JobRow | null> { const r = await this.prisma.v3Job.findFirst({ where: { id, vendorId } }); return r ? job(r) : null; }
  async listJobs(vendorId: string, q: { status?: string; q?: string; includeArchived: boolean }, p: Paging): Promise<{ items: JobRow[]; total: number }> {
    const rest: Prisma.V3JobWhereInput = { ...(q.includeArchived ? {} : { archivedAt: null }), ...(q.status ? { status: q.status } : {}), ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { customerName: { contains: q.q, mode: 'insensitive' } }] } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3Job.findMany({ where: { vendorId, ...rest }, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }), this.prisma.v3Job.count({ where: { vendorId, ...rest } })]);
    return { items: items.map(job), total };
  }
  async updateJob(vendorId: string, id: string, patch: JobPatch): Promise<JobRow | null> {
    const n = await this.prisma.v3Job.updateMany({ where: { id, vendorId }, data: defined(patch) });
    return n.count === 0 ? null : this.getJob(vendorId, id);
  }
  async moveJob(vendorId: string, id: string, from: JobState, to: JobState, extra: { cancelReason?: string | null; payRequestId?: string | null; paidAt?: Date | null }): Promise<JobRow | null> {
    const n = await this.prisma.v3Job.updateMany({ where: { id, vendorId, status: from }, data: { ...defined(extra), status: to } });   // one conditional statement: only one caller can win
    return n.count === 0 ? null : this.getJob(vendorId, id);
  }
  async jobsScheduledBetween(vendorId: string, from: Date, to: Date): Promise<JobRow[]> {
    const rows = await this.prisma.v3Job.findMany({ where: { vendorId, archivedAt: null, status: { not: 'CANCELLED' }, scheduledAt: { gte: from, lt: to } }, orderBy: { scheduledAt: 'asc' }, take: 1000 });
    return rows.map(job);
  }

  createQuote(vendorId: string, q: NewQuote): Promise<QuoteRow> { return numbering.run(`quote:${vendorId}`, () => this.insertQuote(vendorId, q)); }
  private async insertQuote(vendorId: string, q: NewQuote): Promise<QuoteRow> {
    for (let i = 0; i < ATTEMPTS; i++) {
      const last = await this.prisma.v3Quote.findFirst({ where: { vendorId }, orderBy: { number: 'desc' }, select: { number: true } });
      try { return quote(await this.prisma.v3Quote.create({ data: { vendorId, number: (last?.number ?? 0) + 1, jobId: q.jobId, title: q.title, customerName: q.customerName, customerPhone: q.customerPhone, validUntil: q.validUntil, linesJson: q.built.lines as unknown as Prisma.InputJsonValue, taxablePaise: q.built.taxablePaise, taxPaise: q.built.taxPaise, totalPaise: q.built.totalPaise } })); }
      catch (e) { if (!isUnique(e) || i === ATTEMPTS - 1) throw e; }
    }
    throw new Error('unreachable');
  }
  async getQuote(vendorId: string, id: string): Promise<QuoteRow | null> { const r = await this.prisma.v3Quote.findFirst({ where: { id, vendorId } }); return r ? quote(r) : null; }
  async listQuotes(vendorId: string, q: { jobId?: string; status?: string }, p: Paging): Promise<{ items: QuoteRow[]; total: number }> {
    const rest: Prisma.V3QuoteWhereInput = { ...(q.jobId ? { jobId: q.jobId } : {}), ...(q.status ? { status: q.status } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3Quote.findMany({ where: { vendorId, ...rest }, orderBy: { number: 'desc' }, skip: p.skip, take: p.take }), this.prisma.v3Quote.count({ where: { vendorId, ...rest } })]);
    return { items: items.map(quote), total };
  }
  async editDraftQuote(vendorId: string, id: string, patch: { title?: string; customerName?: string; customerPhone?: string | null; validUntil?: string | null; built?: QuoteBuilt }): Promise<QuoteRow | null> {
    const { built, ...rest } = patch;
    const n = await this.prisma.v3Quote.updateMany({ where: { id, vendorId, status: 'DRAFT' }, data: { ...defined(rest), ...(built ? { linesJson: built.lines as unknown as Prisma.InputJsonValue, taxablePaise: built.taxablePaise, taxPaise: built.taxPaise, totalPaise: built.totalPaise } : {}) } });
    return n.count === 0 ? null : this.getQuote(vendorId, id);
  }
  async moveQuote(vendorId: string, id: string, from: QuoteState, to: QuoteState, at: Date): Promise<QuoteRow | null> {
    const n = await this.prisma.v3Quote.updateMany({ where: { id, vendorId, status: from }, data: { status: to, ...(to === 'SENT' ? { sentAt: at } : { decidedAt: at }) } });
    return n.count === 0 ? null : this.getQuote(vendorId, id);
  }
  async setQuoteJob(vendorId: string, id: string, jobId: string): Promise<void> { await this.prisma.v3Quote.updateMany({ where: { id, vendorId }, data: { jobId } }); }
  async expireQuotes(vendorId: string, today: string, at: Date): Promise<number> {
    const n = await this.prisma.v3Quote.updateMany({ where: { vendorId, status: 'SENT', validUntil: { not: null, lt: today } }, data: { status: 'EXPIRED', decidedAt: at } });
    return n.count;
  }
}
