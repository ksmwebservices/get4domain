import {
  allowedNext, checkTransition, isAutoApprovable, isSlaBreached, moneyEffect, REQUEST_STATUSES, RequestStatus, TERMINAL_STATUSES, validateBrief,
} from '../src/v3-service-requests/core/request-core';

/**
 * Slice 5.16c: the pure state machine of a service request, what each step does to the money, and the brief. Nothing here knows a price, a clock or a database.
 */
const base = { hasDeliverable: true, serviceKey: 'POSTER_DESIGN', grantEndsAt: null as Date | null, revisionsUsed: 0, maxRevisions: 2 as number | null, reason: null as string | null };
const step = (from: RequestStatus, to: RequestStatus, by: 'VENDOR' | 'TEAM' | 'SYSTEM', over: Partial<typeof base> = {}) => checkTransition({ from, to, by, ...base, ...over });

describe('the state machine: every edge, and who may take it', () => {
  const EDGES: Array<[RequestStatus, RequestStatus, 'VENDOR' | 'TEAM' | 'SYSTEM']> = [
    ['REQUESTED', 'ACCEPTED', 'TEAM'], ['REQUESTED', 'REJECTED_BY_TEAM', 'TEAM'], ['REQUESTED', 'CANCELLED', 'VENDOR'],
    ['ACCEPTED', 'IN_PRODUCTION', 'TEAM'], ['ACCEPTED', 'REJECTED_BY_TEAM', 'TEAM'], ['ACCEPTED', 'CANCELLED', 'VENDOR'],
    ['IN_PRODUCTION', 'READY_FOR_REVIEW', 'TEAM'], ['IN_PRODUCTION', 'REJECTED_BY_TEAM', 'TEAM'],
    ['READY_FOR_REVIEW', 'APPROVED', 'VENDOR'], ['READY_FOR_REVIEW', 'APPROVED', 'SYSTEM'], ['READY_FOR_REVIEW', 'REVISION_REQUESTED', 'VENDOR'], ['READY_FOR_REVIEW', 'REJECTED_BY_TEAM', 'TEAM'],
    ['REVISION_REQUESTED', 'IN_PRODUCTION', 'TEAM'], ['REVISION_REQUESTED', 'REJECTED_BY_TEAM', 'TEAM'],
  ];
  it.each(EDGES)('%s to %s by %s is allowed', (from, to, by) => { expect(step(from, to, by, { reason: 'The brief cannot be met as written.' })).toEqual({ ok: true }); });

  it('every other combination of status, target and actor is refused', () => {
    const allowed = new Set(EDGES.map(([f, t, b]) => `${f}>${t}>${b}`));
    let refused = 0;
    for (const from of REQUEST_STATUSES) for (const to of REQUEST_STATUSES) for (const by of ['VENDOR', 'TEAM', 'SYSTEM'] as const) {
      if (allowed.has(`${from}>${to}>${by}`)) continue;
      const r = step(from, to, by, { reason: 'A reason that is long enough.' });
      expect([from, to, by, r.ok]).toEqual([from, to, by, false]); refused++;
    }
    expect(refused).toBe(REQUEST_STATUSES.length * REQUEST_STATUSES.length * 3 - EDGES.length);
  });
  it('terminal states have no way out for anyone', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['APPROVED', 'CANCELLED', 'REJECTED_BY_TEAM']);
    for (const t of TERMINAL_STATUSES) expect(allowedNext(t, 'TEAM')).toEqual([]);
  });
  it('a vendor can cancel only before production starts', () => {
    expect(step('IN_PRODUCTION', 'CANCELLED', 'VENDOR')).toMatchObject({ ok: false });
    expect(step('READY_FOR_REVIEW', 'CANCELLED', 'VENDOR')).toMatchObject({ ok: false });
    expect(allowedNext('REQUESTED', 'VENDOR')).toEqual(['CANCELLED']); expect(allowedNext('READY_FOR_REVIEW', 'VENDOR').sort()).toEqual(['APPROVED', 'REVISION_REQUESTED']);
  });
  it('only the vendor (or the auto-approval timer) approves; the team can never approve its own work', () => { expect(step('READY_FOR_REVIEW', 'APPROVED', 'TEAM')).toMatchObject({ ok: false }); });
});

describe('conditions on a step', () => {
  it('ready for review needs at least one deliverable', () => { expect(step('IN_PRODUCTION', 'READY_FOR_REVIEW', 'TEAM', { hasDeliverable: false })).toEqual({ ok: false, problem: 'DELIVERABLE_REQUIRED' }); });
  it('the custom domain promotion also needs the date the add-on ends, set by staff', () => {
    expect(step('IN_PRODUCTION', 'READY_FOR_REVIEW', 'TEAM', { serviceKey: 'CUSTOM_DOMAIN_PROMOTION' })).toEqual({ ok: false, problem: 'GRANT_DATE_REQUIRED' });
    expect(step('IN_PRODUCTION', 'READY_FOR_REVIEW', 'TEAM', { serviceKey: 'CUSTOM_DOMAIN_PROMOTION', grantEndsAt: new Date('2027-01-01T00:00:00Z') })).toEqual({ ok: true });
  });
  it('a revision is allowed while the count is under the limit staff set, and refused at the limit or when no limit is set', () => {
    expect(step('READY_FOR_REVIEW', 'REVISION_REQUESTED', 'VENDOR', { revisionsUsed: 1, maxRevisions: 2 })).toEqual({ ok: true });
    expect(step('READY_FOR_REVIEW', 'REVISION_REQUESTED', 'VENDOR', { revisionsUsed: 2, maxRevisions: 2 })).toEqual({ ok: false, problem: 'REVISION_LIMIT' });
    expect(step('READY_FOR_REVIEW', 'REVISION_REQUESTED', 'VENDOR', { revisionsUsed: 0, maxRevisions: 0 })).toEqual({ ok: false, problem: 'REVISION_LIMIT' });
    expect(step('READY_FOR_REVIEW', 'REVISION_REQUESTED', 'VENDOR', { maxRevisions: null })).toEqual({ ok: false, problem: 'REVISION_LIMIT' });
  });
  it('a rejection by the team needs a reason of at least five characters', () => {
    expect(step('REQUESTED', 'REJECTED_BY_TEAM', 'TEAM', { reason: null })).toEqual({ ok: false, problem: 'REASON_REQUIRED' });
    expect(step('REQUESTED', 'REJECTED_BY_TEAM', 'TEAM', { reason: 'no' })).toEqual({ ok: false, problem: 'REASON_REQUIRED' });
    expect(step('REQUESTED', 'REJECTED_BY_TEAM', 'TEAM', { reason: 'Outside what we do.' })).toEqual({ ok: true });
  });
});

describe('what each step does to the money (owner rule 1)', () => {
  it('approval charges a held wallet amount, uses one unit of a pack, and costs nothing for an allowance', () => {
    expect(moneyEffect('WALLET', 'APPROVED')).toBe('CHARGE_HOLD'); expect(moneyEffect('PACK', 'APPROVED')).toBe('CONSUME_PACK'); expect(moneyEffect('INCLUDED_ALLOWANCE', 'APPROVED')).toBe('NONE');
  });
  it('cancel and reject release a held wallet amount and charge nothing', () => {
    for (const to of ['CANCELLED', 'REJECTED_BY_TEAM'] as const) { expect(moneyEffect('WALLET', to)).toBe('RELEASE_HOLD'); expect(moneyEffect('PACK', to)).toBe('NONE'); expect(moneyEffect('INCLUDED_ALLOWANCE', to)).toBe('NONE'); }
  });
  it('no other step moves money', () => {
    for (const f of ['WALLET', 'PACK', 'INCLUDED_ALLOWANCE'] as const) for (const to of ['ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED', 'REQUESTED'] as const) expect(moneyEffect(f, to)).toBe('NONE');
  });
});

describe('the brief is checked per service', () => {
  const ok = { details: 'A poster for our Diwali offer with the shop name and phone number.' };
  it('needs details, a plain string of the right length', () => {
    expect(validateBrief('POSTER_DESIGN', ok)).toEqual([]);
    for (const bad of [{}, { details: '' }, { details: 'short' }, { details: 'x'.repeat(2001) }, { details: 5 }, { details: 'Use <script> here please.' }]) expect(validateBrief('POSTER_DESIGN', bad).length).toBeGreaterThan(0);
  });
  it('refuses anything that is not an object and any field the service does not use', () => {
    for (const bad of [null, 'text', [], 5]) expect(validateBrief('POSTER_DESIGN', bad as never).length).toBeGreaterThan(0);
    expect(validateBrief('POSTER_DESIGN', { ...ok, vendorId: 'v2' }).join(' ')).toMatch(/vendorId/);
    expect(validateBrief('POSTER_DESIGN', { ...ok, domain: 'a.example.com' }).join(' ')).toMatch(/domain/);
  });
  it('the domain services need a real host name', () => {
    for (const key of ['DOMAIN_CONNECT_HELP', 'CUSTOM_DOMAIN_PROMOTION']) {
      expect(validateBrief(key, { ...ok, domain: 'shop.example.com' })).toEqual([]);
      for (const bad of [undefined, '', 'not a domain', 'http://shop.example.com', 'shop', 'a..b.com']) expect(validateBrief(key, { ...ok, domain: bad } as never).length).toBeGreaterThan(0);
    }
  });
  it('the theme switch needs a theme key; a social request needs a platform', () => {
    expect(validateBrief('THEME_SWITCH', { ...ok, themeKey: 'free-studio' })).toEqual([]); expect(validateBrief('THEME_SWITCH', ok).length).toBeGreaterThan(0); expect(validateBrief('THEME_SWITCH', { ...ok, themeKey: 'Not A Key!' }).length).toBeGreaterThan(0);
    expect(validateBrief('SOCIAL_MANAGEMENT_REQUEST', { ...ok, platform: 'Instagram' })).toEqual([]); expect(validateBrief('SOCIAL_MANAGEMENT_REQUEST', ok).length).toBeGreaterThan(0);
  });
  it('allows a contact line and notes, with limits', () => {
    expect(validateBrief('POSTER_DESIGN', { ...ok, contact: 'Call after 5 pm', notes: 'Use our green.' })).toEqual([]);
    expect(validateBrief('POSTER_DESIGN', { ...ok, contact: 'x'.repeat(201) }).length).toBe(1);
  });
});

describe('timers', () => {
  const T = new Date('2026-11-05T10:00:00Z');
  it('auto-approval applies only when switched on with a number of days staff set, to work that has waited that long in review', () => {
    const ready = new Date('2026-11-01T10:00:00Z');
    expect(isAutoApprovable({ status: 'READY_FOR_REVIEW', readyAt: ready }, T, { enabled: true, afterDays: 4 })).toBe(true);
    expect(isAutoApprovable({ status: 'READY_FOR_REVIEW', readyAt: ready }, T, { enabled: true, afterDays: 5 })).toBe(false);
    expect(isAutoApprovable({ status: 'READY_FOR_REVIEW', readyAt: ready }, T, { enabled: false, afterDays: 4 })).toBe(false);
    expect(isAutoApprovable({ status: 'READY_FOR_REVIEW', readyAt: ready }, T, { enabled: true, afterDays: null })).toBe(false);
    expect(isAutoApprovable({ status: 'IN_PRODUCTION', readyAt: ready }, T, { enabled: true, afterDays: 1 })).toBe(false);
    expect(isAutoApprovable({ status: 'READY_FOR_REVIEW', readyAt: null }, T, { enabled: true, afterDays: 1 })).toBe(false);
  });
  it('a request is past its SLA when the due time has gone, it is still open and it has not been marked', () => {
    const due = new Date('2026-11-05T09:00:00Z');
    expect(isSlaBreached({ status: 'IN_PRODUCTION', slaDueAt: due, slaBreachedAt: null }, T)).toBe(true);
    expect(isSlaBreached({ status: 'IN_PRODUCTION', slaDueAt: due, slaBreachedAt: new Date() }, T)).toBe(false);
    expect(isSlaBreached({ status: 'APPROVED', slaDueAt: due, slaBreachedAt: null }, T)).toBe(false);
    expect(isSlaBreached({ status: 'READY_FOR_REVIEW', slaDueAt: due, slaBreachedAt: null }, T)).toBe(false);   // the ball is in the vendor's court
    expect(isSlaBreached({ status: 'REQUESTED', slaDueAt: null, slaBreachedAt: null }, T)).toBe(false);
    expect(isSlaBreached({ status: 'REQUESTED', slaDueAt: new Date('2026-11-05T10:00:00Z'), slaBreachedAt: null }, T)).toBe(false);
  });
});
