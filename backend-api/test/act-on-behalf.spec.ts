import { AobWorld, aobWorld, OWNER1, STAFF1, STAFF2, SUPER } from './support/act-on-behalf-world';

/** Slice 5.13b: act on behalf of a vendor. A session needs a reason, tells the vendor, ends by itself after a staff setting, refuses what must never be done for a vendor, and every action inside shows in the vendor's own activity. */
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const S1 = { id: 'staff-1', role: 'OPERATIONS' }; const S2 = { id: 'staff-2', role: 'OPERATIONS' }; const SUP = { id: 'staff-9', role: 'SUPER_ADMIN' };
const REASON = 'The owner asked us by phone to set up the banner.';
let w: AobWorld;
beforeEach(async () => { w = await aobWorld(30); });
const req = (route: string, params: Record<string, unknown>, user: Record<string, unknown>, session?: string, method = 'POST', body: unknown = {}) => ({ method, route: { path: route }, params, body, user, ip: '10.0.0.1', headers: session ? { 'x-act-on-behalf-session': session } : {} });

describe('starting a session', () => {
  it('is refused until staff set the session length (no default), without a reason, and for a vendor that does not exist', async () => {
    const off = await aobWorld(null); expect(await code(off.svc.start(S1, 'v1', REASON))).toBe('ACT_ON_BEHALF_NOT_CONFIGURED'); expect(off.store.rows).toEqual([]);
    for (const bad of ['', '  ', 'ab', 'x'.repeat(501), '<b>x</b>']) expect(await code(w.svc.start(S1, 'v1', bad))).toBe('REASON_REQUIRED');
    expect(await code(w.svc.start(S1, 'nope', REASON))).toBe('ACT_ON_BEHALF_VENDOR_NOT_FOUND'); expect(w.store.rows).toEqual([]);
  });
  it('records who, for which vendor, why and until when; tells the vendor; writes the activity row against that vendor', async () => {
    const s = await w.svc.start(S1, 'v1', REASON);
    expect(s).toMatchObject({ vendorId: 'v1', reason: REASON, state: 'ACTIVE', expiresAt: '2026-11-11T10:30:00.000Z' }); expect(w.store.rows[0]).toMatchObject({ staffId: 'staff-1', vendorNotifiedAt: w.clock.t });
    expect(w.notices).toContainEqual({ userId: 'v1', role: null, kind: 'ACT_ON_BEHALF_STARTED', refId: s.id });
    expect(w.aw.store.activity.find((a) => a.actionKey === 'act_on_behalf.started')).toMatchObject({ vendorId: 'v1', actorType: 'STAFF', actorId: 'staff-1', entityId: s.id });
  });
  it('a staff member has one live session at a time; another staff member may start their own', async () => {
    await w.svc.start(S1, 'v1', REASON); expect(await code(w.svc.start(S1, 'v2', REASON))).toBe('SESSION_ACTIVE'); expect(await code(w.svc.start(S2, 'v1', REASON))).toBe('OK');
  });
});

describe('using a session', () => {
  const route = '/v3/admin/vendors/:id/site/banner';
  it('a request with a live session for that vendor goes through, and shows in the VENDOR\'s own activity with the session id and the staff member as the actor', async () => {
    const s = await w.svc.start(S1, 'v1', REASON);
    const r = await w.run(req(route, { id: 'v1' }, STAFF1, s.id)); expect(r.handled).toBe(1);
    const mine = await w.aw.activity.myActivity('v1', 1, 50); const row = mine.items.find((i) => i.actionKey === 'vendors.site_banner');
    expect(row).toMatchObject({ vendorId: 'v1', actorType: 'STAFF', actorId: 'staff-1' }); expect(row?.summary).toMatchObject({ actOnBehalfSessionId: s.id });
  });
  it('without the header nothing changes: no session id in the log', async () => {
    await w.run(req(route, { id: 'v1' }, STAFF1)); const row = w.aw.store.activity.find((a) => a.actionKey === 'vendors.site_banner'); expect(row).toBeDefined(); expect(JSON.stringify(row?.summary)).not.toContain('actOnBehalfSessionId');
  });
  it('refuses what must never be done for a vendor: payment methods, bank details, UPI ids, passwords. The handler does not run and the refused attempt is logged for the vendor', async () => {
    const s = await w.svc.start(S1, 'v1', REASON);
    for (const [m, r] of [['PUT', '/v3/admin/vendors/:vendorId/payment-methods/:id'], ['POST', '/v3/admin/vendors/:id/upi'], ['POST', '/v3/admin/vendors/:id/bank-details'], ['POST', '/v3/admin/vendors/:id/password-reset']] as const) {
      let out = 'OK'; let handled = 0;
      try { handled = (await w.run(req(r, { id: 'v1', vendorId: 'v1' }, STAFF1, s.id, m))).handled; } catch (e) { out = (e as { response?: { code?: string } }).response?.code ?? 'ERR'; }
      expect([m, r, out, handled]).toEqual([m, r, 'ACT_ON_BEHALF_FORBIDDEN', 0]);
    }
    const refused = w.aw.store.activity.filter((a) => a.actionKey === 'act_on_behalf.refused'); expect(refused).toHaveLength(4); expect(refused.every((a) => a.vendorId === 'v1' && a.actorId === 'staff-1')).toBe(true);
    expect(w.aw.store.activity.some((a) => a.actionKey.includes('payment_method'))).toBe(false);
  });
  it('reading a vendor\'s masked payment methods is not a change and is allowed', async () => {
    const s = await w.svc.start(S1, 'v1', REASON); expect((await w.run(req('/v3/admin/vendors/:vendorId/payment-methods', { vendorId: 'v1' }, STAFF1, s.id, 'GET'))).handled).toBe(1);
  });
  it('refuses a session for another vendor, another staff member\'s session, an unknown session, and a non-vendor route', async () => {
    const s = await w.svc.start(S1, 'v1', REASON); const bad = async (r: Record<string, unknown>) => { try { await w.run(r); return 'OK'; } catch (e) { return (e as { response?: { code?: string } }).response?.code ?? 'ERR'; } };
    expect(await bad(req(route, { id: 'v2' }, STAFF1, s.id))).toBe('ACT_ON_BEHALF_WRONG_VENDOR'); expect(await bad(req(route, { id: 'v1' }, STAFF2, s.id))).toBe('ACT_ON_BEHALF_INVALID');
    expect(await bad(req(route, { id: 'v1' }, STAFF1, 'nope'))).toBe('ACT_ON_BEHALF_INVALID'); expect(await bad(req('/v3/admin/alerts/:id', { id: 'a1' }, STAFF1, s.id, 'PUT'))).toBe('ACT_ON_BEHALF_WRONG_ROUTE');
  });
  it('a vendor sending the header changes nothing: only staff can hold a session', async () => {
    const s = await w.svc.start(S1, 'v1', REASON); const r = await w.run(req('/v3/me/site/draft/field', {}, OWNER1, s.id, 'PUT', { key: 'hero.title', value: 'x' })); expect(r.handled).toBe(1);
    expect(JSON.stringify(w.aw.store.activity.at(-1)?.summary)).not.toContain('actOnBehalfSessionId');
  });
});

describe('ending a session', () => {
  it('ends by itself when the staff setting runs out: the next use is refused, the session is closed as AUTO, the vendor is told', async () => {
    const s = await w.svc.start(S1, 'v1', REASON); w.clock.t = new Date('2026-11-11T10:29:59Z'); expect((await w.run(req('/v3/admin/vendors/:id/site/banner', { id: 'v1' }, STAFF1, s.id))).handled).toBe(1);
    w.clock.t = new Date('2026-11-11T10:30:00Z'); expect(await code(w.run(req('/v3/admin/vendors/:id/site/banner', { id: 'v1' }, STAFF1, s.id)))).toBe('ACT_ON_BEHALF_EXPIRED');
    expect(w.store.rows[0]).toMatchObject({ endedBy: 'AUTO' }); expect(w.notices.filter((n) => n.kind === 'ACT_ON_BEHALF_ENDED')).toHaveLength(1);
    expect(w.aw.store.activity.some((a) => a.actionKey === 'act_on_behalf.ended' && a.vendorId === 'v1')).toBe(true);
  });
  it('the sweep closes every session past its time and is safe to repeat; a new session can then be started', async () => {
    await w.svc.start(S1, 'v1', REASON); await w.svc.start(S2, 'v2', REASON); w.clock.t = new Date('2026-11-11T11:00:00Z');
    expect(await w.svc.expireDue()).toBe(2); expect(await w.svc.expireDue()).toBe(0); expect(w.notices.filter((n) => n.kind === 'ACT_ON_BEHALF_ENDED')).toHaveLength(2); expect(await code(w.svc.start(S1, 'v1', REASON))).toBe('OK');
  });
  it('the staff member ends their own session; SUPER_ADMIN may end anyone\'s; nobody else; ending twice is harmless', async () => {
    const a = await w.svc.start(S1, 'v1', REASON); expect(await code(w.svc.end(S2, a.id))).toBe('ACT_ON_BEHALF_INVALID');
    expect((await w.svc.end(S1, a.id)).state).toBe('ENDED'); expect(w.store.rows[0].endedBy).toBe('STAFF'); expect(await code(w.svc.end(S1, a.id))).toBe('OK'); expect(w.notices.filter((n) => n.kind === 'ACT_ON_BEHALF_ENDED')).toHaveLength(1);
    const b = await w.svc.start(S2, 'v2', REASON); expect((await w.svc.end(SUP, b.id)).state).toBe('ENDED'); expect(w.store.rows[1].endedBy).toBe('SUPER_ADMIN');
    expect(await code(w.svc.end(S1, 'nope'))).toBe('SESSION_NOT_FOUND');
  });
  it('an ended session is refused at once', async () => {
    const s = await w.svc.start(S1, 'v1', REASON); await w.svc.end(S1, s.id); expect(await code(w.run(req('/v3/admin/vendors/:id/site/banner', { id: 'v1' }, STAFF1, s.id)))).toBe('ACT_ON_BEHALF_EXPIRED');
  });
});

describe('who sees what', () => {
  it('the vendor sees its own sessions with the reason and times, never the staff id; another vendor sees nothing of them', async () => {
    const s = await w.svc.start(S1, 'v1', REASON); const mine = await w.svc.listForVendor('v1');
    expect(mine).toHaveLength(1); expect(mine[0]).toMatchObject({ id: s.id, reason: REASON, state: 'ACTIVE' }); expect(JSON.stringify(mine)).not.toContain('staff-1'); expect(await w.svc.listForVendor('v2')).toEqual([]);
  });
  it('staff list sessions with the staff member, filtered by vendor and by live or not', async () => {
    const a = await w.svc.start(S1, 'v1', REASON); await w.svc.start(S2, 'v2', REASON); await w.svc.end(S1, a.id);
    expect((await w.svc.listForStaff({ vendorId: 'v1', page: 1, pageSize: 20 })).items).toMatchObject([{ id: a.id, staffId: 'staff-1', state: 'ENDED' }]);
    expect((await w.svc.listForStaff({ active: true, page: 1, pageSize: 20 })).items.map((i) => i.vendorId)).toEqual(['v2']); expect((await w.svc.listForStaff({ page: 1, pageSize: 20 })).total).toBe(2);
  });
});

describe('role', () => {
  it('the stage file\'s Website Developer and Customer Support roles do not exist here: OPERATIONS and SUPER_ADMIN may act on behalf, MARKETING never (checked by the role matrix)', () => { expect(SUPER.adminRole).toBe('SUPER_ADMIN'); });
});
