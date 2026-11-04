import { advance, BASE, domainWorld, DomainWorld, OWNER, pro, STAFF } from './support/domain-world';

/** Slice 5.6 service rules over the in-memory repository (the same unique rules as the database). */
const code = async (p: Promise<unknown>): Promise<{ code?: string; message?: string; status?: number }> => {
  try { await p; return {}; } catch (e) { const r = (e as { getResponse?: () => unknown; getStatus?: () => number }); const b = (r.getResponse?.() ?? {}) as { code?: string; message?: string }; return { code: b.code, message: b.message, status: r.getStatus?.() }; }
};
const A = 'vendor-a'; const B = 'vendor-b';
let w: DomainWorld;
beforeEach(() => { w = domainWorld(); w.repo.addVendor(A); w.repo.addVendor(B); });

describe('free subdomain', () => {
  it('first reservation: an ACTIVE SUBDOMAIN row, primary, the vendor column follows, one audit row, the resolver cache is cleared', async () => {
    const r = await w.svc.setSubdomain(A, 'Sri-Ganesh', OWNER(A));
    expect(r).toMatchObject({ hostname: `sri-ganesh.${BASE}`, kind: 'SUBDOMAIN', status: 'ACTIVE', isPrimary: true });
    expect((await w.repo.vendorInfo(A))!.subdomain).toBe('sri-ganesh');
    expect(w.repo.audits.map((a) => a.action)).toEqual(['domain.subdomain.set']);
    expect(w.invalidated.count).toBeGreaterThan(0);
    expect(w.repo.redirects).toEqual([]);
  });
  it('the same slug again changes nothing (idempotent)', async () => {
    await w.svc.setSubdomain(A, 'shop', OWNER(A)); const n = w.repo.rows.size;
    await w.svc.setSubdomain(A, 'SHOP', OWNER(A));
    expect(w.repo.rows.size).toBe(n); expect(w.repo.audits).toHaveLength(1);
  });
  it('a change retires the old host (kept as REMOVED), redirects it 301 to the new one, and the new one is primary', async () => {
    await w.svc.setSubdomain(A, 'old-name', OWNER(A));
    await w.svc.setSubdomain(A, 'new-name', OWNER(A));
    const rows = await w.repo.listForVendor(A);
    expect(rows.map((r) => [r.hostname, r.status, r.isPrimary])).toEqual([[`old-name.${BASE}`, 'REMOVED', false], [`new-name.${BASE}`, 'ACTIVE', true]]);
    expect(w.repo.redirects).toEqual([expect.objectContaining({ vendorId: A, fromHost: `old-name.${BASE}`, fromPath: '/', toHost: `new-name.${BASE}`, status: 301, source: 'SYSTEM', active: true })]);
    expect((await w.repo.vendorInfo(A))!.subdomain).toBe('new-name');
  });
  it('a legacy vendor (a subdomain column, no domain rows) is brought into the table on first change and its old address redirects', async () => {
    w.repo.addVendor('legacy', 'oldlegacy');
    await w.svc.setSubdomain('legacy', 'brand-new', OWNER('legacy'));
    const rows = await w.repo.listForVendor('legacy');
    expect(rows.map((r) => [r.hostname, r.status])).toEqual([[`oldlegacy.${BASE}`, 'REMOVED'], [`brand-new.${BASE}`, 'ACTIVE']]);
    expect(w.repo.redirects[0]).toMatchObject({ fromHost: `oldlegacy.${BASE}`, toHost: `brand-new.${BASE}` });
  });
  it('rules: too short, bad characters and reserved names are refused with their own codes; a blocked word is the uniform "not available"', async () => {
    w.settings.over = { blockedSubdomainWords: ['scam'] };
    expect(await code(w.svc.setSubdomain(A, 'ab', OWNER(A)))).toMatchObject({ code: 'SUBDOMAIN_INVALID', status: 400 });
    expect(await code(w.svc.setSubdomain(A, 'a_b_c', OWNER(A)))).toMatchObject({ code: 'SUBDOMAIN_INVALID' });
    expect(await code(w.svc.setSubdomain(A, 'admin', OWNER(A)))).toMatchObject({ code: 'SUBDOMAIN_RESERVED' });
    expect(await code(w.svc.setSubdomain(A, 'adm1n', OWNER(A)))).toMatchObject({ code: 'SUBDOMAIN_RESERVED' });
    expect(await code(w.svc.setSubdomain(A, 'big-scam-shop', OWNER(A)))).toMatchObject({ code: 'HOST_UNAVAILABLE' });
    expect(w.repo.rows.size).toBe(0);
  });
  it('taken by another vendor, taken through the legacy column, and released by another vendor all give the SAME refusal', async () => {
    await w.svc.setSubdomain(B, 'taken-one', OWNER(B));
    w.repo.addVendor('legacy', 'legacyname');
    await w.svc.setSubdomain('c', 'to-release', OWNER('c')).catch(() => undefined);
    w.repo.addVendor('c'); await w.svc.setSubdomain('c', 'to-release', OWNER('c')); await w.svc.setSubdomain('c', 'released', OWNER('c'));
    const a = await code(w.svc.setSubdomain(A, 'taken-one', OWNER(A)));
    const b = await code(w.svc.setSubdomain(A, 'legacyname', OWNER(A)));
    const c = await code(w.svc.setSubdomain(A, 'to-release', OWNER(A)));
    expect([a.code, b.code, c.code]).toEqual(['HOST_UNAVAILABLE', 'HOST_UNAVAILABLE', 'HOST_UNAVAILABLE']);
    expect(new Set([a.message, b.message, c.message]).size).toBe(1);
    expect(a.status).toBe(409);
  });
  it('the vendor that released a subdomain may take it back', async () => {
    await w.svc.setSubdomain(A, 'first', OWNER(A)); await w.svc.setSubdomain(A, 'second', OWNER(A));
    await w.svc.setSubdomain(A, 'first', OWNER(A));
    const rows = await w.repo.listForVendor(A);
    expect(rows.filter((r) => r.status === 'ACTIVE').map((r) => r.hostname)).toEqual([`first.${BASE}`]);
    expect(rows.filter((r) => r.isPrimary)).toHaveLength(1);
  });
  it('change limit: the third change inside the period is refused for the owner, allowed for staff, and allowed again after the period', async () => {
    await w.svc.setSubdomain(A, 'name-one', OWNER(A));
    await w.svc.setSubdomain(A, 'name-two', OWNER(A)); await w.svc.setSubdomain(A, 'name-three', OWNER(A));   // two changes (limit 2)
    expect(await code(w.svc.setSubdomain(A, 'name-four', OWNER(A)))).toMatchObject({ code: 'SUBDOMAIN_CHANGE_LIMIT', status: 429 });
    await w.svc.staffSetSubdomain(A, 'name-four', 'owner asked on the phone', STAFF);
    expect((await w.repo.vendorInfo(A))!.subdomain).toBe('name-four');
    advance(w, 366 * 86_400);
    await expect(w.svc.setSubdomain(A, 'name-five', OWNER(A))).resolves.toBeDefined();
  });
  it('staff change needs a reason and is audited with the staff actor', async () => {
    expect(await code(w.svc.staffSetSubdomain(A, 'abc', '', STAFF))).toMatchObject({ status: 400 });
    await w.svc.staffSetSubdomain(A, 'abc', 'fixing a typo', STAFF);
    expect(w.repo.audits.at(-1)).toMatchObject({ actor: STAFF, action: 'domain.subdomain.set' });
  });
  it('two vendors asking for the same name at the same moment: exactly one wins, the other gets the uniform refusal', async () => {
    const [x, y] = await Promise.all([code(w.svc.setSubdomain(A, 'same-name', OWNER(A))), code(w.svc.setSubdomain(B, 'same-name', OWNER(B)))]);
    expect([x.code, y.code].sort()).toEqual([undefined, 'HOST_UNAVAILABLE'].sort());
    expect([...w.repo.rows.values()].filter((r) => r.hostname === `same-name.${BASE}`)).toHaveLength(1);
  });
  it('a failed write leaves nothing behind (no half change)', async () => {
    await w.svc.setSubdomain(A, 'stable', OWNER(A));
    w.repo.failNextCreate = true;
    expect(await code(w.svc.setSubdomain(A, 'wanted', OWNER(A)))).toMatchObject({ code: 'HOST_UNAVAILABLE' });
    const rows = await w.repo.listForVendor(A);
    expect(rows.map((r) => [r.hostname, r.status, r.isPrimary])).toEqual([[`stable.${BASE}`, 'ACTIVE', true]]);
    expect((await w.repo.vendorInfo(A))!.subdomain).toBe('stable');
  });
});

describe('custom domain request', () => {
  it('Free: refused with FEATURE_LOCKED and the plan\'s upsell text; nothing is created', async () => {
    const e = await code(w.svc.requestCustom(A, 'shop.example.in', OWNER(A)));
    expect(e).toMatchObject({ code: 'FEATURE_LOCKED', status: 403 });
    expect(w.repo.rows.size).toBe(0);
  });
  it('Pro: a PENDING CUSTOM row and the TXT instructions (the value is public by design)', async () => {
    w.ents.set(A, pro());
    const r = await w.svc.requestCustom(A, 'Shop.Example.IN', OWNER(A));
    expect(r).toMatchObject({ hostname: 'shop.example.in', kind: 'CUSTOM', status: 'PENDING', isPrimary: false });
    expect(r.instructions).toEqual({ type: 'TXT', name: '_g4d-verify.shop.example.in', value: expect.stringMatching(/^g4d-verify=\S{20,}$/) });
    expect(w.repo.audits.map((a) => a.action)).toEqual(['domain.custom.request']);
  });
  it('refuses hosts that are not public domain names, or that sit under the platform domain', async () => {
    w.ents.set(A, pro());
    for (const h of ['localhost', '10.0.0.1', 'a b.com', `evil.${BASE}`, BASE, `www.${BASE}`]) expect(await code(w.svc.requestCustom(A, h, OWNER(A)))).toMatchObject({ code: 'DOMAIN_INVALID' });
  });
  it('the same host asked twice by the same vendor returns the same row; another vendor gets the uniform refusal while it is in use', async () => {
    w.ents.set(A, pro()); w.ents.set(B, pro());
    const one = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A)); const two = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    expect(two.id).toBe(one.id);
    const e = await code(w.svc.requestCustom(B, 'shop.example.in', OWNER(B)));
    expect(e).toMatchObject({ code: 'HOST_UNAVAILABLE', status: 409 });
  });
  it('after the first vendor removes it, another vendor may request it, but must prove ownership with a new TXT value', async () => {
    w.ents.set(A, pro()); w.ents.set(B, pro());
    const first = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    await w.svc.remove(A, first.id, OWNER(A));
    const second = await w.svc.requestCustom(B, 'shop.example.in', OWNER(B));
    expect(second).toMatchObject({ status: 'PENDING' });
    expect(second.instructions!.value).not.toBe(first.instructions!.value);
    expect((await w.repo.findByHostname('shop.example.in'))!.vendorId).toBe(B);
  });
  it('a vendor may hold only domainMaxPerVendor custom domains at once', async () => {
    w.ents.set(A, pro()); w.settings.over = { domainMaxPerVendor: 2 };
    await w.svc.requestCustom(A, 'a.example.in', OWNER(A)); await w.svc.requestCustom(A, 'b.example.in', OWNER(A));
    expect(await code(w.svc.requestCustom(A, 'c.example.in', OWNER(A)))).toMatchObject({ code: 'DOMAIN_LIMIT_REACHED' });
  });
});

describe('verification', () => {
  const request = async (): Promise<string> => { w.ents.set(A, pro()); await w.svc.setSubdomain(A, 'mine', OWNER(A)); const r = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A)); return r.id; };
  const live = (): void => { w.settings.over = { ...w.settings.over, domainDnsLiveChecks: true }; };

  it('with live checks OFF (the default) no DNS query is made; the answer says so and the domain waits as VERIFYING', async () => {
    const id = await request(); w.gate.dns = null;
    const r = await w.svc.verify(A, id, OWNER(A));
    expect(r).toMatchObject({ result: 'DISABLED', domain: { status: 'VERIFYING' } });
    expect((await w.repo.getVerification(id))!.attempts).toBe(0);
  });
  it('MATCHED: the domain becomes ACTIVE with a verified date and, being the first, primary; the subdomain stays as an ACTIVE alias', async () => {
    const id = await request(); live();
    const exp = (await w.repo.getVerification(id))!.expectedValue;
    w.txt.answers = [[exp]];
    const r = await w.svc.verify(A, id, OWNER(A));
    expect(r).toMatchObject({ result: 'MATCHED', domain: { status: 'ACTIVE', isPrimary: true } });
    const rows = await w.repo.listForVendor(A);
    expect(rows.filter((x) => x.isPrimary).map((x) => x.hostname)).toEqual(['shop.example.in']);
    expect(rows.find((x) => x.hostname === 'shop.example.in')!.verifiedAt).toEqual(w.now.t);
    expect(w.repo.audits.map((a) => a.action)).toContain('domain.custom.verified');
  });
  it('NOT_FOUND and MISMATCH keep it VERIFYING and count the attempt; after domainVerifyMaxAttempts it is FAILED', async () => {
    const id = await request(); live(); w.settings.over = { ...w.settings.over, domainVerifyMaxAttempts: 3, domainVerifyMinIntervalSeconds: 0 };
    w.txt.answers = [];
    expect(await w.svc.verify(A, id, OWNER(A))).toMatchObject({ result: 'NOT_FOUND', domain: { status: 'VERIFYING' } });
    w.txt.answers = [['g4d-verify=wrong']];
    expect(await w.svc.verify(A, id, OWNER(A))).toMatchObject({ result: 'MISMATCH', domain: { status: 'VERIFYING' } });
    expect(await w.svc.verify(A, id, OWNER(A))).toMatchObject({ domain: { status: 'FAILED' } });
    expect((await w.repo.getVerification(id))!.attempts).toBe(3);
  });
  it('a FAILED domain can be tried again and succeed', async () => {
    const id = await request(); live(); w.settings.over = { ...w.settings.over, domainVerifyMaxAttempts: 1, domainVerifyMinIntervalSeconds: 0 };
    w.txt.answers = []; await w.svc.verify(A, id, OWNER(A));
    expect((await w.repo.findById(id))!.status).toBe('FAILED');
    w.settings.over = { ...w.settings.over, domainVerifyMaxAttempts: 5 };
    w.txt.answers = [[(await w.repo.getVerification(id))!.expectedValue]];
    expect(await w.svc.verify(A, id, OWNER(A))).toMatchObject({ domain: { status: 'ACTIVE' } });
  });
  it('rate limit: a second check inside the minimum interval is refused before any DNS query', async () => {
    const id = await request(); live(); w.txt.answers = [];
    await w.svc.verify(A, id, OWNER(A)); const calls = w.gate.calls;
    expect(await code(w.svc.verify(A, id, OWNER(A)))).toMatchObject({ code: 'VERIFY_TOO_SOON', status: 429 });
    expect(w.gate.calls).toBe(calls);
    advance(w, 31);
    await expect(w.svc.verify(A, id, OWNER(A))).resolves.toBeDefined();
  });
  it('a DNS error is recorded as ERROR and never activates', async () => {
    const id = await request(); live(); w.txt.answers = Object.assign(new Error('boom'), { code: 'ETIMEOUT' });
    expect(await w.svc.verify(A, id, OWNER(A))).toMatchObject({ result: 'ERROR', domain: { status: 'VERIFYING' } });
  });
  it('vendor B cannot verify, read, make primary or remove vendor A\'s domain: the answer is the same as for an id that does not exist', async () => {
    const id = await request(); live();
    const nope = await code(w.svc.verify(B, 'does-not-exist', OWNER(B)));
    for (const p of [w.svc.verify(B, id, OWNER(B)), w.svc.get(B, id), w.svc.makePrimary(B, id, OWNER(B)), w.svc.remove(B, id, OWNER(B))]) expect(await code(p)).toEqual(nope);
    expect(nope).toMatchObject({ code: 'DOMAIN_NOT_FOUND', status: 404 });
  });
  it('the free subdomain is not verified by TXT', async () => {
    await request(); const sub = [...w.repo.rows.values()].find((r) => r.kind === 'SUBDOMAIN')!;
    expect(await code(w.svc.verify(A, sub.id, OWNER(A)))).toMatchObject({ code: 'DOMAIN_STATE_INVALID' });
  });
});

describe('primary, removal and downgrade', () => {
  const active = async (): Promise<string> => {
    w.ents.set(A, pro()); w.settings.over = { domainDnsLiveChecks: true };
    await w.svc.setSubdomain(A, 'mine', OWNER(A)); const r = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    w.txt.answers = [[(await w.repo.getVerification(r.id))!.expectedValue]]; await w.svc.verify(A, r.id, OWNER(A)); return r.id;
  };
  it('makePrimary: only an ACTIVE host; the database keeps exactly one primary', async () => {
    const id = await active();
    const sub = [...w.repo.rows.values()].find((r) => r.kind === 'SUBDOMAIN')!;
    await w.svc.makePrimary(A, sub.id, OWNER(A));
    expect((await w.repo.listForVendor(A)).filter((r) => r.isPrimary).map((r) => r.id)).toEqual([sub.id]);
    await w.svc.makePrimary(A, id, OWNER(A));
    expect((await w.repo.listForVendor(A)).filter((r) => r.isPrimary).map((r) => r.id)).toEqual([id]);
    w.ents.set(A, pro()); const pending = await w.svc.requestCustom(A, 'other.example.in', OWNER(A));
    expect(await code(w.svc.makePrimary(A, pending.id, OWNER(A)))).toMatchObject({ code: 'DOMAIN_STATE_INVALID' });
  });
  it('removing the primary custom domain hands primary back to the free subdomain; the free subdomain itself cannot be removed', async () => {
    const id = await active();
    await w.svc.remove(A, id, OWNER(A));
    const rows = await w.repo.listForVendor(A);
    expect(rows.find((r) => r.id === id)).toMatchObject({ status: 'REMOVED', isPrimary: false });
    expect(rows.filter((r) => r.isPrimary).map((r) => r.kind)).toEqual(['SUBDOMAIN']);
    const sub = rows.find((r) => r.kind === 'SUBDOMAIN')!;
    expect(await code(w.svc.remove(A, sub.id, OWNER(A)))).toMatchObject({ code: 'DOMAIN_STATE_INVALID' });
  });
  it('plan downgrade: the overview says the subdomain is primary and the custom domain is not served as primary, yet the custom row is neither deleted nor changed', async () => {
    const id = await active();
    expect((await w.svc.overview(A)).primaryHost).toBe('shop.example.in');
    w.ents.set(A, { ...pro(), plan: 'handyman_free', level: 'FREE', features: { ...pro().features, 'site.custom_domain': { state: 'LOCKED_PREVIEW', limit: null, enumValue: null, upsellText: 'Use your own web address with Pro.', overLimit: false, source: 'PLAN' } } });
    w.dir.invalidate();
    const o = await w.svc.overview(A);
    expect(o.primaryHost).toBe(`mine.${BASE}`);
    expect(o.customDomain).toMatchObject({ allowed: false, upsellText: 'Use your own web address with Pro.' });
    expect(await w.repo.findById(id)).toMatchObject({ status: 'ACTIVE', isPrimary: true });
  });
});

describe('staff', () => {
  it('forceState needs a reason, can activate a pending custom domain (ssl status is only recorded), is audited, and cannot revive a REMOVED one', async () => {
    w.ents.set(A, pro()); await w.svc.setSubdomain(A, 'mine', OWNER(A));
    const r = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    expect(await code(w.svc.forceState(r.id, { status: 'ACTIVE', reason: '' }, STAFF))).toMatchObject({ status: 400 });
    const done = await w.svc.forceState(r.id, { status: 'ACTIVE', sslStatus: 'PENDING', reason: 'DNS confirmed by phone' }, STAFF);
    expect(done).toMatchObject({ status: 'ACTIVE', sslStatus: 'PENDING', isPrimary: true });
    expect(w.repo.audits.at(-1)).toMatchObject({ actor: STAFF, action: 'domain.custom.force_state' });
    await w.svc.forceState(r.id, { status: 'REMOVED', reason: 'owner left' }, STAFF);
    expect(await code(w.svc.forceState(r.id, { status: 'ACTIVE', reason: 'oops' }, STAFF))).toMatchObject({ code: 'DOMAIN_STATE_INVALID' });
    expect(await code(w.svc.forceState('missing', { status: 'FAILED', reason: 'x y z' }, STAFF))).toMatchObject({ code: 'DOMAIN_NOT_FOUND' });
  });
  it('staff list filters by vendor, status, kind and host text', async () => {
    w.ents.set(A, pro()); await w.svc.setSubdomain(A, 'alpha', OWNER(A)); await w.svc.setSubdomain(B, 'bravo', OWNER(B)); await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    expect((await w.svc.listAll({ vendorId: A, skip: 0, take: 50 })).total).toBe(2);
    expect((await w.svc.listAll({ kind: 'CUSTOM', skip: 0, take: 50 })).items.map((i) => i.hostname)).toEqual(['shop.example.in']);
    expect((await w.svc.listAll({ q: 'brav', skip: 0, take: 50 })).total).toBe(1);
  });
});
