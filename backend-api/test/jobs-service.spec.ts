import { CustomerCapture, JobsService, PaymentFacts } from '../src/v3-jobs/jobs.service';
import { TaxRateSource } from '../src/v3-business/tax-rate-source';
import { MemoryJobsStore } from './support/memory-jobs-store';

const A = 'vendor-a'; const B = 'vendor-b';
class Rates extends TaxRateSource { rates = [18]; async activeRates() { return [...this.rates]; } }
class Pay extends PaymentFacts { paid = new Map<string, { vendorId: string; amountPaise: number }>(); async confirmed(vendorId: string, payRequestId: string) { const p = this.paid.get(payRequestId); return p && p.vendorId === vendorId ? { amountPaise: p.amountPaise } : null; } }
class Cust extends CustomerCapture { seen: Array<{ vendorId: string; phone: string }> = []; async capture(vendorId: string, i: { name: string; phone: string; refId: string }) { this.seen.push({ vendorId, phone: i.phone }); return `cust-${i.phone.replace(/\D/g, '')}`; } }
const make = () => { const store = new MemoryJobsStore(); const rates = new Rates(); const pay = new Pay(); const cust = new Cust(); const svc = new JobsService(store, rates, pay, cust); svc.clock = () => new Date('2026-11-12T06:00:00Z'); return { store, rates, pay, cust, svc }; };
const lines = [{ name: 'Visit', qty: 1, unitPaise: 50000, taxPercent: 18 }];
const newJob = { title: 'Fix tap', customerName: 'Ravi', customerPhone: '98765 43210' };
const code = (c: string) => ({ response: { code: c } });

describe('jobs', () => {
  it('start as requested, are numbered per business, and put the customer on the one customer list', async () => {
    const { svc, cust } = make(); const a1 = await svc.createJob(A, newJob); const a2 = await svc.createJob(A, newJob); const b1 = await svc.createJob(B, newJob);
    expect([a1.number, a2.number, b1.number, a1.status]).toEqual([1, 2, 1, 'REQUESTED']); expect(a1.customerId).toBe('cust-9876543210'); expect(cust.seen).toHaveLength(3);
  });
  it('a customer with no phone is kept on the job only', async () => { const { svc, cust } = make(); const j = await svc.createJob(A, { title: 'x', customerName: 'R' }); expect(j.customerId).toBeNull(); expect(cust.seen).toHaveLength(0); });
  it('refuses a bad job with the stable code', async () => { await expect(make().svc.createJob(A, { title: '', customerName: '' })).rejects.toMatchObject(code('JOBS_INVALID')); });
  it('walks the legal path one step at a time and refuses a jump', async () => {
    const { svc } = make(); const j = await svc.createJob(A, newJob);
    await expect(svc.moveJob(A, j.id, 'DONE')).rejects.toMatchObject(code('JOBS_STATE'));
    for (const s of ['BOOKED', 'IN_PROGRESS', 'DONE'] as const) expect((await svc.moveJob(A, j.id, s)).status).toBe(s);
  });
  it('PAID can never be set by hand', async () => {
    const { svc } = make(); const j = await svc.createJob(A, newJob); for (const s of ['BOOKED', 'IN_PROGRESS', 'DONE'] as const) await svc.moveJob(A, j.id, s);
    await expect(svc.moveJob(A, j.id, 'PAID')).rejects.toMatchObject(code('JOBS_PAYMENT_ONLY'));
  });
  it('cancel keeps the reason and the job; a finished job cannot be cancelled', async () => {
    const { svc, store } = make(); const j = await svc.createJob(A, newJob); const c = await svc.moveJob(A, j.id, 'CANCELLED', 'customer changed mind');
    expect([c.status, c.cancelReason]).toEqual(['CANCELLED', 'customer changed mind']); expect(store.jobs).toHaveLength(1);
    const k = await svc.createJob(A, newJob); for (const s of ['BOOKED', 'IN_PROGRESS', 'DONE'] as const) await svc.moveJob(A, k.id, s); await expect(svc.moveJob(A, k.id, 'CANCELLED')).rejects.toMatchObject(code('JOBS_STATE'));
  });
  it('updates details, assignment and schedule, and the calendar shows scheduled jobs by India day', async () => {
    const { svc } = make(); const j = await svc.createJob(A, newJob);
    const u = await svc.updateJob(A, j.id, { assignedTo: 'Suresh', scheduledAt: '2026-11-13T04:30:00Z' }); expect(u.assignedTo).toBe('Suresh');
    expect(await svc.calendar(A, '2026-11-13', '2026-11-13')).toEqual([{ day: '2026-11-13', jobs: [expect.objectContaining({ id: j.id, assignedTo: 'Suresh' })] }]);
    expect(await svc.calendar(A, '2026-11-14', '2026-11-14')).toEqual([]);
  });
  it('another business sees nothing and changes nothing', async () => {
    const { svc } = make(); const j = await svc.createJob(A, newJob); const q = await svc.createQuote(A, { title: 'Q', customerName: 'Ravi', lines });
    expect((await svc.listJobs(B, {}, 1, 20)).total).toBe(0); expect((await svc.listQuotes(B, {}, 1, 20)).total).toBe(0);
    for (const call of [() => svc.getJob(B, j.id), () => svc.updateJob(B, j.id, { title: 'x' }), () => svc.moveJob(B, j.id, 'BOOKED'), () => svc.getQuote(B, q.id), () => svc.sendQuote(B, q.id), () => svc.acceptQuote(B, q.id), () => svc.declineQuote(B, q.id), () => svc.archiveJob(B, j.id, true)]) await expect(call()).rejects.toMatchObject(code('JOBS_NOT_FOUND'));
    await expect(svc.createQuote(B, { jobId: j.id, title: 'Q', customerName: 'x', lines })).rejects.toMatchObject(code('JOBS_NOT_FOUND'));
  });
});

describe('quotes', () => {
  it('take their tax rate from the table only', async () => {
    const { svc, rates } = make(); rates.rates = [];
    await expect(svc.createQuote(A, { title: 'Q', customerName: 'R', lines })).rejects.toMatchObject(code('JOBS_INVALID'));
    expect((await svc.createQuote(A, { title: 'Q', customerName: 'R', lines: [{ name: 'Visit', qty: 1, unitPaise: 100 }] })).totalPaise).toBe(100);
  });
  it('are DRAFT, then sent; only a draft can be edited', async () => {
    const { svc } = make(); const q = await svc.createQuote(A, { title: 'Q', customerName: 'R', lines }); expect([q.status, q.totalPaise, q.number]).toEqual(['DRAFT', 59000, 1]);
    expect((await svc.editQuote(A, q.id, { lines: [{ name: 'Visit', qty: 2, unitPaise: 50000, taxPercent: 18 }] })).totalPaise).toBe(118000);
    await svc.sendQuote(A, q.id); await expect(svc.editQuote(A, q.id, { title: 'x' })).rejects.toMatchObject(code('JOBS_STATE')); await expect(svc.sendQuote(A, q.id)).rejects.toMatchObject(code('JOBS_STATE'));
  });
  it('sending a quote moves a requested job to quoted; accepting books it and sets its total', async () => {
    const { svc } = make(); const j = await svc.createJob(A, newJob); const q = await svc.createQuote(A, { jobId: j.id, title: 'Q', customerName: 'Ravi', lines });
    await svc.sendQuote(A, q.id); expect((await svc.getJob(A, j.id)).status).toBe('QUOTED');
    const r = await svc.acceptQuote(A, q.id); expect(r.quote.status).toBe('ACCEPTED'); expect(r.job).toMatchObject({ id: j.id, status: 'BOOKED', totalPaise: 59000, quoteId: q.id });
  });
  it('accepting a quote with no job creates exactly one, even when ten accepts arrive together', async () => {
    const { svc, store } = make(); const q = await svc.createQuote(A, { title: 'Roof', customerName: 'Ravi', customerPhone: '9876543210', lines }); await svc.sendQuote(A, q.id);
    const r = await Promise.all(Array.from({ length: 10 }, () => svc.acceptQuote(A, q.id)));
    expect(store.jobs).toHaveLength(1); expect(new Set(r.map((x) => x.job.id)).size).toBe(1); expect(store.jobs[0]).toMatchObject({ status: 'BOOKED', quoteId: q.id, totalPaise: 59000, title: 'Roof' });
  });
  it('a draft cannot be accepted (the customer has not been sent anything)', async () => { const { svc } = make(); const q = await svc.createQuote(A, { title: 'Q', customerName: 'R', lines }); await expect(svc.acceptQuote(A, q.id)).rejects.toMatchObject(code('JOBS_STATE')); });
  it('a declined quote stays declined and makes no job', async () => { const { svc, store } = make(); const q = await svc.createQuote(A, { title: 'Q', customerName: 'R', lines }); await svc.sendQuote(A, q.id); expect((await svc.declineQuote(A, q.id)).status).toBe('DECLINED'); expect(store.jobs).toHaveLength(0); await expect(svc.acceptQuote(A, q.id)).rejects.toMatchObject(code('JOBS_STATE')); });
  it('a quote past its last day expires instead of being accepted', async () => {
    const { svc, store } = make(); const q = await svc.createQuote(A, { title: 'Q', customerName: 'R', validUntil: '2026-11-11', lines }); await svc.sendQuote(A, q.id);
    await expect(svc.acceptQuote(A, q.id)).rejects.toMatchObject(code('JOBS_QUOTE_EXPIRED')); expect(store.quotes[0].status).toBe('EXPIRED'); expect(store.jobs).toHaveLength(0);
  });
  it('listing marks the overdue ones expired first', async () => { const { svc } = make(); const q = await svc.createQuote(A, { title: 'Q', customerName: 'R', validUntil: '2026-11-01', lines }); await svc.sendQuote(A, q.id); expect((await svc.listQuotes(A, { status: 'EXPIRED' }, 1, 20)).total).toBe(1); });
});

describe('paid', () => {
  const done = async (ctx: ReturnType<typeof make>) => { const j = await ctx.svc.createJob(A, newJob); const q = await ctx.svc.createQuote(A, { jobId: j.id, title: 'Q', customerName: 'R', lines }); await ctx.svc.sendQuote(A, q.id); await ctx.svc.acceptQuote(A, q.id); for (const s of ['IN_PROGRESS', 'DONE'] as const) await ctx.svc.moveJob(A, j.id, s); return j; };
  it('only a payment the business confirmed (for the right amount, its own) makes a job paid', async () => {
    const ctx = make(); const j = await done(ctx);
    await expect(ctx.svc.markPaid(A, j.id, 'pr-1')).rejects.toMatchObject(code('JOBS_NOT_PAID'));
    ctx.pay.paid.set('pr-1', { vendorId: B, amountPaise: 59000 }); await expect(ctx.svc.markPaid(A, j.id, 'pr-1')).rejects.toMatchObject(code('JOBS_NOT_PAID'));
    ctx.pay.paid.set('pr-2', { vendorId: A, amountPaise: 100 }); await expect(ctx.svc.markPaid(A, j.id, 'pr-2')).rejects.toMatchObject(code('JOBS_NOT_PAID'));
    ctx.pay.paid.set('pr-3', { vendorId: A, amountPaise: 59000 }); const p = await ctx.svc.markPaid(A, j.id, 'pr-3'); expect([p.status, p.payRequestId]).toEqual(['PAID', 'pr-3']); expect(p.paidAt).not.toBeNull();
  });
  it('a job that is not done cannot be marked paid, and a paid job cannot be paid twice', async () => {
    const ctx = make(); const j = await ctx.svc.createJob(A, newJob); ctx.pay.paid.set('pr-1', { vendorId: A, amountPaise: 1 });
    await expect(ctx.svc.markPaid(A, j.id, 'pr-1')).rejects.toMatchObject(code('JOBS_STATE'));
    const k = await done(ctx); ctx.pay.paid.set('pr-9', { vendorId: A, amountPaise: 59000 }); await ctx.svc.markPaid(A, k.id, 'pr-9'); await expect(ctx.svc.markPaid(A, k.id, 'pr-9')).rejects.toMatchObject(code('JOBS_STATE'));
  });
});
