import { buildQuote, calendarDays, canJobMove, canQuoteMove, checkJobInput, JOB_STATES, jobStateAfterQuote, QUOTE_STATES } from '../src/v3-jobs/core/jobs-core';

describe('quote lines and totals (integer paise, rates only from the table)', () => {
  const ok = (lines: unknown, rates: number[] = [18]) => { const r = buildQuote(lines, rates); if (!r.ok) throw new Error(r.problems.join(';')); return r.value; };
  it('adds taxable value and tax per line and the total is exactly their sum', () => {
    const q = ok([{ name: 'Visit', qty: 1, unitPaise: 50000, taxPercent: 18 }, { name: 'Pipe', qty: 3, unitPaise: 12050, taxPercent: 18 }]);
    expect(q.lines.map((l) => [l.taxablePaise, l.taxPaise])).toEqual([[50000, 9000], [36150, 6507]]);
    expect([q.taxablePaise, q.taxPaise, q.totalPaise]).toEqual([86150, 15507, 101657]);
  });
  it('rounds the tax of a line to the nearest paisa, half up, and never leaves a fraction', () => { expect(ok([{ name: 'x', qty: 1, unitPaise: 5, taxPercent: 18 }]).taxPaise).toBe(1); });
  it('a line with no rate carries tax 0; a rate that is not in the table is refused (empty table: only no rate)', () => {
    expect(ok([{ name: 'x', qty: 1, unitPaise: 100 }], []).taxPaise).toBe(0);
    expect(buildQuote([{ name: 'x', qty: 1, unitPaise: 100, taxPercent: 12 }], [18]).ok).toBe(false);
    expect(buildQuote([{ name: 'x', qty: 1, unitPaise: 100, taxPercent: 18 }], []).ok).toBe(false);
  });
  it.each([[[]], [[{ name: '', qty: 1, unitPaise: 1 }]], [[{ name: 'x', qty: 0, unitPaise: 1 }]], [[{ name: 'x', qty: 1.5, unitPaise: 1 }]], [[{ name: 'x', qty: 1, unitPaise: -1 }]], ['nope'], [Array.from({ length: 51 }, () => ({ name: 'x', qty: 1, unitPaise: 1 }))]])('refuses %j', (bad) => { expect(buildQuote(bad, [18]).ok).toBe(false); });
});

describe('quote states', () => {
  it.each([['DRAFT', 'SENT', true], ['DRAFT', 'ACCEPTED', false], ['SENT', 'ACCEPTED', true], ['SENT', 'DECLINED', true], ['SENT', 'EXPIRED', true], ['SENT', 'DRAFT', false], ['ACCEPTED', 'DECLINED', false], ['DECLINED', 'SENT', false], ['EXPIRED', 'ACCEPTED', false]] as const)('%s to %s is %s', (a, b, ok) => { expect(canQuoteMove(a, b)).toBe(ok); });
  it('every state is covered by the table', () => { for (const s of QUOTE_STATES) expect(typeof canQuoteMove(s, s)).toBe('boolean'); });
});

describe('job states', () => {
  it.each([
    ['REQUESTED', 'QUOTED', true], ['REQUESTED', 'BOOKED', true], ['QUOTED', 'BOOKED', true], ['BOOKED', 'IN_PROGRESS', true], ['IN_PROGRESS', 'DONE', true], ['DONE', 'PAID', true],
    ['REQUESTED', 'DONE', false], ['BOOKED', 'DONE', false], ['BOOKED', 'PAID', false], ['IN_PROGRESS', 'BOOKED', false], ['PAID', 'CANCELLED', false], ['CANCELLED', 'BOOKED', false], ['DONE', 'CANCELLED', false],
    ['REQUESTED', 'CANCELLED', true], ['BOOKED', 'CANCELLED', true], ['IN_PROGRESS', 'CANCELLED', true],
  ] as const)('%s to %s is %s', (a, b, ok) => { expect(canJobMove(a, b)).toBe(ok); });
  it('PAID is reachable only from DONE, and only through the payment path', () => { for (const s of JOB_STATES) expect(canJobMove(s, 'PAID')).toBe(s === 'DONE'); });
  it('a quote that is sent moves a requested job to quoted and leaves any later job alone', () => {
    expect(jobStateAfterQuote('REQUESTED', 'SENT')).toBe('QUOTED'); expect(jobStateAfterQuote('BOOKED', 'SENT')).toBe('BOOKED');
    expect(jobStateAfterQuote('REQUESTED', 'ACCEPTED')).toBe('BOOKED'); expect(jobStateAfterQuote('QUOTED', 'ACCEPTED')).toBe('BOOKED'); expect(jobStateAfterQuote('IN_PROGRESS', 'ACCEPTED')).toBe('IN_PROGRESS');
  });
});

describe('job input', () => {
  it('needs a title and a way to know the customer', () => {
    expect(checkJobInput({ title: 'Fix tap', customerName: 'Ravi', customerPhone: '98765 43210' })).toMatchObject({ ok: true });
    expect(checkJobInput({ title: '', customerName: 'Ravi' }).ok).toBe(false); expect(checkJobInput({ title: 'x', customerName: '' }).ok).toBe(false);
    expect(checkJobInput({ title: 'x', customerName: 'R', customerPhone: 'abc' }).ok).toBe(false);
  });
});

describe('calendar', () => {
  it('groups jobs by India day, in time order', () => {
    const d = calendarDays([{ id: 'a', at: '2026-11-10T20:00:00Z' }, { id: 'b', at: '2026-11-10T05:00:00Z' }, { id: 'c', at: '2026-11-11T05:00:00Z' }].map((x) => ({ id: x.id, at: Date.parse(x.at) })));
    expect(d).toEqual([{ day: '2026-11-10', ids: ['b'] }, { day: '2026-11-11', ids: ['a', 'c'] }]);   // 20:00Z on the 10th is 01:30 India time on the 11th
  });
});
