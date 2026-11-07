import { trustWorld, TrustWorld } from './support/memory-trust-store';

/** Slice 5.21: the trust services over in-memory stores. Phrases and names below are INVENTED test data. */
const SUPER = { id: 'staff-1', ip: '203.0.113.5', role: 'SUPER_ADMIN' };
const OPS = { id: 'staff-2', ip: '203.0.113.6', role: 'OPERATIONS' };
const code = async (p: Promise<unknown>): Promise<string | undefined> => { try { await p; return undefined; } catch (e) { return (e as { getResponse?: () => { code?: string } }).getResponse?.().code ?? 'NO_CODE'; } };

let w: TrustWorld;
beforeEach(() => { w = trustWorld(); });

describe('legal takedown', () => {
  it('only SUPER_ADMIN can create one, and a written reason is always required', async () => {
    expect(await code(w.takedowns.create(OPS, { vendorId: 'v1', reason: 'court order' }))).toBe('TAKEDOWN_FORBIDDEN');
    expect(await code(w.takedowns.create({ id: null, ip: null, role: 'SUPER_ADMIN' }, { vendorId: 'v1', reason: 'x' }))).toBe('TAKEDOWN_FORBIDDEN');
    expect(await code(w.takedowns.create(SUPER, { vendorId: 'v1', reason: '   ' }))).toBe('TAKEDOWN_REASON_REQUIRED');
    expect(await code(w.takedowns.create(SUPER, { vendorId: 'v1', reason: '' }))).toBe('TAKEDOWN_REASON_REQUIRED');
    expect(w.trust.takedowns).toHaveLength(0); expect(w.trust.listings.find((l) => l.id === 'l1')!.status).toBe('CLAIMED');   // nothing happened
  });
  it('it takes the listing out of the directory in the same unit, and the vendor and the site see it at once', async () => {
    const t = await w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'order dated by the court', documentRef: 'doc-9' });
    expect(t).toMatchObject({ vendorId: 'v1', listingId: 'l1', status: 'ACTIVE', decidedBy: 'staff-1', priorListingStatus: 'CLAIMED' });
    expect(w.trust.listings.find((l) => l.id === 'l1')).toMatchObject({ status: 'REMOVED', indexable: false });
    expect(await w.takedowns.activeForVendor('v1')).toBe(true); expect(await w.takedowns.activeForVendor('v2')).toBe(false);
    expect(await w.takedowns.mine('v1')).toMatchObject({ active: true, reason: 'order dated by the court' });
    expect(await w.takedowns.mine('v2')).toEqual({ active: false, reason: null, at: null });   // another vendor sees nothing of it
  });
  it('a listing alone can be taken down; one that belongs to a vendor takes the vendor with it', async () => {
    const a = await w.takedowns.create(SUPER, { listingId: 'l3', reason: 'unlawful content' }); expect(a).toMatchObject({ vendorId: null, listingId: 'l3' });
    const b = await w.takedowns.create(SUPER, { listingId: 'l2', reason: 'unlawful content' }); expect(b).toMatchObject({ vendorId: 'v2', listingId: 'l2' });
    expect(await w.takedowns.activeForVendor('v2')).toBe(true);
  });
  it('one in force at a time; an unknown business or listing and an empty request are refused', async () => {
    await w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'first' });
    expect(await code(w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'again' }))).toBe('TAKEDOWN_ALREADY_ACTIVE');
    expect(await code(w.takedowns.create(SUPER, { listingId: 'l1', reason: 'again' }))).toBe('TAKEDOWN_ALREADY_ACTIVE');
    expect(await code(w.takedowns.create(SUPER, { vendorId: 'nobody', reason: 'x' }))).toBe('TAKEDOWN_TARGET_UNKNOWN');
    expect(await code(w.takedowns.create(SUPER, { listingId: 'nope', reason: 'x' }))).toBe('TAKEDOWN_TARGET_UNKNOWN');
    expect(await code(w.takedowns.create(SUPER, { reason: 'x' }))).toBe('TRUST_INVALID');
  });
  it('two takedowns at the same moment make exactly one', async () => {
    const r = await Promise.all([w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'a' }).then(() => 'ok', (e) => e.getResponse().code), w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'b' }).then(() => 'ok', (e) => e.getResponse().code)]);
    expect(r.sort()).toEqual(['TAKEDOWN_ALREADY_ACTIVE', 'ok']); expect(w.trust.takedowns.filter((t) => t.status === 'ACTIVE')).toHaveLength(1);
  });
  it('reversal is SUPER_ADMIN only, needs its own written reason, puts the listing back as it was, and can happen once', async () => {
    const t = await w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'first' });
    expect(await code(w.takedowns.reverse(t.id, OPS, { reason: 'mistake' }))).toBe('TAKEDOWN_FORBIDDEN');
    expect(await code(w.takedowns.reverse(t.id, SUPER, { reason: '  ' }))).toBe('TAKEDOWN_REASON_REQUIRED');
    expect(await code(w.takedowns.reverse('nope', SUPER, { reason: 'x' }))).toBe('TRUST_NOT_FOUND');
    expect(w.trust.listings.find((l) => l.id === 'l1')!.status).toBe('REMOVED');   // the refused attempts changed nothing
    const done = await w.takedowns.reverse(t.id, SUPER, { reason: 'the order was withdrawn' });
    expect(done).toMatchObject({ status: 'REVERSED', reversedBy: 'staff-1', reverseReason: 'the order was withdrawn' });
    expect(w.trust.listings.find((l) => l.id === 'l1')).toMatchObject({ status: 'CLAIMED', indexable: true, removedAt: null });
    expect(await w.takedowns.activeForVendor('v1')).toBe(false);
    expect(await code(w.takedowns.reverse(t.id, SUPER, { reason: 'again' }))).toBe('TAKEDOWN_NOT_ACTIVE');
    expect(await w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'a new decision' })).toMatchObject({ status: 'ACTIVE' });   // a later decision is a new record
  });
  it('a business that was already removed stays removed when its takedown is reversed (a removed business is never listed again)', async () => {
    w.trust.listings.find((l) => l.id === 'l1')!.status = 'REMOVED';
    const t = await w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'x' });
    await w.takedowns.reverse(t.id, SUPER, { reason: 'y' });
    expect(w.trust.listings.find((l) => l.id === 'l1')!.status).toBe('REMOVED');
  });
  it('it is written to the vendor\'s own history without the reason, and the staff list shows it', async () => {
    const t = await w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'private legal wording', documentRef: 'doc-1' });
    await w.takedowns.reverse(t.id, SUPER, { reason: 'private reversal wording' });
    const rows = (await w.activity.vendorActivity('v1', 1, 50)).items.filter((r) => r.actionKey.startsWith('takedown.'));
    expect(rows.map((r) => r.actionKey).sort()).toEqual(['takedown.created', 'takedown.reversed']);
    expect(JSON.stringify(rows)).not.toMatch(/private legal wording|private reversal wording|doc-1/);
    expect((await w.takedowns.list({ vendorId: 'v1' }, 1, 25)).total).toBe(1);
  });
});

describe('the prohibited-phrase scan', () => {
  const enable = async (): Promise<void> => { await w.seedRules({ PROHIBITED_TEXT: { enabled: true } }); };
  it('ships empty: with no phrase in the table nothing matches', async () => {
    await enable(); await w.scan.scan('v1', 'PUBLISH', ['anything at all']); expect(w.store.alerts).toHaveLength(0); expect(w.store.activity).toHaveLength(0);
  });
  it('a match raises a PROHIBITED_TEXT alert for that vendor, tells the roles, and stores the phrases but never the text', async () => {
    await enable(); await w.terms.create(SUPER, { term: 'Zeta Powder', category: 'TEST_A' });
    await w.scan.scan('v1', 'REQUEST', ['I want zeta   powder, call 9876543210']);
    expect(w.store.alerts).toHaveLength(1); expect(w.store.alerts[0]).toMatchObject({ vendorId: 'v1', ruleKey: 'PROHIBITED_TEXT', level: 'HIGH', status: 'NEW' });
    expect(w.store.notifications.map((n) => n.role).sort()).toEqual(['OPERATIONS', 'SUPER_ADMIN']);
    const row = w.store.activity[0]; expect(row).toMatchObject({ actionKey: 'prohibited_text.matched', actorType: 'SYSTEM' });
    expect(row.summary).toMatchObject({ source: 'REQUEST', count: 1, matches: [{ term: 'zeta powder', category: 'TEST_A' }] }); expect(JSON.stringify(row)).not.toMatch(/9876543210|I want/);
  });
  it('it never blocks and never throws: the caller just carries on, even when the store is down; a disabled phrase and a disabled rule do nothing', async () => {
    await enable(); const t = await w.terms.create(SUPER, { term: 'quick cash', category: 'TEST_B', enabled: false });
    await expect(w.scan.scan('v1', 'PUBLISH', ['quick cash'])).resolves.toBeUndefined(); expect(w.store.alerts).toHaveLength(0);
    await w.terms.update(t.id, SUPER, { enabled: true });
    w.trust.listTerms = async () => { throw new Error('database down'); };
    await expect(w.scan.scan('v1', 'PUBLISH', ['quick cash'])).resolves.toBeUndefined();
  });
  it('with the alert rule off the match is still written to the activity log, and no alert is made', async () => {
    await w.seedRules(); await w.terms.create(SUPER, { term: 'zeta powder', category: 'TEST_A' }); await w.scan.scan('v1', 'PUBLISH', ['zeta powder']);
    expect(w.store.activity.map((r) => r.actionKey)).toEqual(['prohibited_text.matched']); expect(w.store.alerts).toHaveLength(0);
  });
  it('the table: phrases are folded, a duplicate is refused, edits and removal work, short ones are refused', async () => {
    const a = await w.terms.create(SUPER, { term: '  Zeta,  POWDER ', category: 'TEST_A' }); expect(a.term).toBe('zeta powder');
    expect(await code(w.terms.create(SUPER, { term: 'ZETA powder', category: 'TEST_B' }))).toBe('TERM_EXISTS');
    expect(await code(w.terms.create(SUPER, { term: 'a', category: 'TEST_B' }))).toBe('TRUST_INVALID');
    expect(await code(w.terms.create(SUPER, { term: 'fine phrase', category: 'x' }))).toBe('TRUST_INVALID');
    const b = await w.terms.create(SUPER, { term: 'other phrase', category: 'TEST_B' });
    expect(await code(w.terms.update(b.id, SUPER, { term: 'zeta POWDER' }))).toBe('TERM_EXISTS');
    expect((await w.terms.update(b.id, SUPER, { enabled: false })).enabled).toBe(false);
    await w.terms.remove(a.id); expect(await code(w.terms.remove(a.id))).toBe('TRUST_NOT_FOUND'); expect(await w.terms.list()).toHaveLength(1);
  });
});

describe('the payee name check (fake port for the payment slice)', () => {
  it('a match or an unknown name raises nothing; a mismatch is written and raises an alert, and nothing is blocked', async () => {
    await w.seedRules({ PAYEE_NAME_MISMATCH: { enabled: true } });
    expect(await w.payee.check('v1', 'Murugan Stores')).toBe('MATCH'); expect(await w.payee.check('v1', 'K. Raman')).toBe('MATCH'); expect(await w.payee.check('v1', '')).toBe('UNKNOWN');
    expect(w.store.alerts).toHaveLength(0);
    expect(await w.payee.check('v1', 'Someone Unrelated')).toBe('MISMATCH');
    expect(w.store.alerts).toHaveLength(1); expect(w.store.alerts[0]).toMatchObject({ vendorId: 'v1', ruleKey: 'PAYEE_NAME_MISMATCH', level: 'HIGH' });
  });
  it('it compares only with the asking vendor\'s own names, and a fault gives UNKNOWN', async () => {
    expect(await w.payee.check('v2', 'Murugan Stores')).toBe('MISMATCH');   // v1's name is not v2's
    w.trust.namesOfVendor = async () => { throw new Error('down'); }; expect(await w.payee.check('v1', 'x y')).toBe('UNKNOWN');
  });
});

describe('business proofs', () => {
  it('a vendor offers a proof; sending the same kind again replaces it and starts again at SUBMITTED', async () => {
    const a = await w.proofs.submit('v1', { kind: 'GST', number: '33AAAAA0000A1Z5', documentRef: 'doc-1' }); expect(a.status).toBe('SUBMITTED');
    const rev = await w.proofs.review(a.id, SUPER, { expectedStatus: 'SUBMITTED', status: 'CHECKED' }); expect(rev).toMatchObject({ status: 'CHECKED', checkedBy: 'staff-1' });
    const b = await w.proofs.submit('v1', { kind: 'GST', number: '33BBBBB0000B1Z5' }); expect(b).toMatchObject({ id: a.id, status: 'SUBMITTED', checkedBy: null, number: '33BBBBB0000B1Z5' });
    expect(await w.proofs.mine('v1')).toHaveLength(1);
  });
  it('a vendor sees only their own proofs; a proof is optional (nothing is refused for lacking one)', async () => {
    await w.proofs.submit('v1', { kind: 'UDYAM', number: 'UDYAM-XX-00-0000001' });
    expect(await w.proofs.mine('v2')).toEqual([]); expect(await code(w.proofs.submit('v1', { kind: 'OTHER', number: 'ab' }))).toBe('TRUST_INVALID');
  });
  it('staff review is compare-and-set: a change made meanwhile is refused, and a mismatch blocks nothing', async () => {
    const a = await w.proofs.submit('v1', { kind: 'SHOP_LICENCE', number: 'SL-000123' });
    expect(await code(w.proofs.review(a.id, SUPER, { expectedStatus: 'CHECKED', status: 'MISMATCH' }))).toBe('TRUST_STALE');
    expect(await code(w.proofs.review(a.id, SUPER, { expectedStatus: 'SUBMITTED', status: 'SUBMITTED' }))).toBe('TRUST_INVALID');
    expect(await code(w.proofs.review('nope', SUPER, { expectedStatus: 'SUBMITTED', status: 'CHECKED' }))).toBe('TRUST_NOT_FOUND');
    expect(await w.proofs.review(a.id, OPS, { expectedStatus: 'SUBMITTED', status: 'MISMATCH', note: 'name differs' })).toMatchObject({ status: 'MISMATCH', note: 'name differs' });
    expect((await w.proofs.list({ status: 'MISMATCH' }, 1, 25)).total).toBe(1); expect((await w.proofs.list({ vendorId: 'v2' }, 1, 25)).total).toBe(0);
  });
  it('the attention board counts a Pro vendor with no proof as a Medium item and never as an alert', async () => {
    w.store.queues = { serviceRequestsOpen: 0, reportsNew: 2, proofsToCheck: 3, proofsMissing: 5 };
    const a = await w.alerts.attention();
    expect(a.items).toEqual([{ key: 'BUSINESS_PROOF_MISSING', level: 'MEDIUM', count: 5 }]); expect(a.queues).toMatchObject({ reportsNew: 2, proofsToCheck: 3, proofsMissing: 5 });
    expect(a.roles.OPERATIONS.alertsNew).toEqual({ HIGH: 0, MEDIUM: 0, LOW: 0 });
  });
});

describe('the trust block list', () => {
  it('values are normalised before they are hashed: another spelling of the same value is a duplicate; the value is never returned', async () => {
    const a = await w.blocks.add(SUPER, { kind: 'PHONE', value: '+91 98765 43210', reason: 'fraud report' });
    expect(JSON.stringify(a)).not.toMatch(/98765|valueHash/);
    expect(await code(w.blocks.add(OPS, { kind: 'PHONE', value: '098765-43210', reason: 'again' }))).toBe('BLOCK_EXISTS');
    await w.blocks.add(OPS, { kind: 'DOMAIN', value: 'https://www.Bad-Shop.in/x', reason: 'phishing' });
    expect(await w.blocks.isBlocked('PHONE', '9876543210')).toBe(true); expect(await w.blocks.isBlocked('DOMAIN', 'bad-shop.in')).toBe(true); expect(await w.blocks.isBlocked('EMAIL', 'a@b.co')).toBe(false);
    expect(await w.blocks.isBlocked('DOMAIN', '9876543210')).toBe(false);   // the kind is part of the key
    expect(w.trust.blocks.every((b) => /^[0-9a-f]{64}$/.test(b.valueHash))).toBe(true);
  });
  it('unusable values and missing reasons are refused; a list can be filtered; an entry can be removed', async () => {
    expect(await code(w.blocks.add(SUPER, { kind: 'PHONE', value: '123', reason: 'x y z' }))).toBe('TRUST_INVALID');
    expect(await code(w.blocks.add(SUPER, { kind: 'EMAIL', value: 'a@b.co', reason: ' ' }))).toBe('TRUST_INVALID');
    const a = await w.blocks.add(SUPER, { kind: 'NAME', value: 'Bad Actor Traders', reason: 'known' }); await w.blocks.add(SUPER, { kind: 'UPI', value: 'bad@okbank', reason: 'known' });
    expect((await w.blocks.list({ kind: 'NAME' }, 1, 25)).total).toBe(1); expect((await w.blocks.list({}, 1, 25)).total).toBe(2);
    await w.blocks.remove(a.id); expect(await w.blocks.isBlocked('NAME', 'bad actor traders')).toBe(false); expect(await code(w.blocks.remove(a.id))).toBe('TRUST_NOT_FOUND');
  });
});

describe('reports from the public', () => {
  it('a report needs no personal data; a bad one is dropped quietly (the answer never tells)', async () => {
    await w.reports.submit({ subjectType: 'LISTING', subject: 'Some-Business', reason: 'sells things that look unlawful' }, '203.0.113.9');
    await w.reports.submit({ subjectType: 'SITE', subject: '', reason: 'no subject at all' }, null); await w.reports.submit({ subjectType: 'SITE', subject: 'a.example.in', reason: 'no' }, null);
    expect(w.trust.reports).toHaveLength(1); expect(w.trust.reports[0]).toMatchObject({ subject: 'some-business', reporterContact: null, status: 'NEW' }); expect(w.trust.reports[0].ipHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('the staff list masks a contact and never shows the address hash; a status move needs the status the reader saw', async () => {
    await w.reports.submit({ subjectType: 'SITE', subject: 'a.example.in', reason: 'looks like a copy of another shop', contact: 'person@example.com' }, '203.0.113.9');
    await w.reports.submit({ subjectType: 'SITE', subject: 'b.example.in', reason: 'a second one here', contact: '+91 98765 43210' }, null);
    const l = await w.reports.list({}, 1, 25); const text = JSON.stringify(l);
    expect(text).not.toMatch(/person@example|98765|ipHash/); expect(l.items.map((r) => r.reporterContact).sort()).toEqual(['**********10', 'p***@example.com'].sort());
    const id = l.items[0].id;
    expect(await code(w.reports.update(id, OPS, { expectedStatus: 'LOOKING', status: 'CLOSED' }))).toBe('TRUST_STALE');
    expect(await w.reports.update(id, OPS, { expectedStatus: 'NEW', status: 'LOOKING', note: 'asked the owner' })).toMatchObject({ status: 'LOOKING', note: 'asked the owner', handledByStaffId: 'staff-2' });
    await w.reports.update(id, OPS, { expectedStatus: 'LOOKING', status: 'CLOSED' });
    expect(await code(w.reports.update(id, OPS, { expectedStatus: 'CLOSED', status: 'NEW' }))).toBe('TRUST_INVALID');
    expect((await w.reports.list({ status: 'CLOSED' }, 1, 25)).total).toBe(1);
  });
});
