import { hashPhone } from '../src/directory/core/otp';
import { validateExtraSetting } from '../src/plans/admin/extra-settings';
import { csvOf, csvRow, mkt, ops, row, seededWorld, sup } from './support/seeded-world';

/** Slice 5.13a: the seeded-sites service with memory twins and fakes for the provisioner, publisher, claim handover and facts. */
type World = ReturnType<typeof seededWorld>;
let w: World;
beforeEach(() => { w = seededWorld(); });
const code = async (p: Promise<unknown>): Promise<string | undefined> => { try { await p; return undefined; } catch (e) { return (e as { response?: { code?: string } }).response?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const phoneHash = (p: string) => hashPhone(p, w.pepper.value());

describe('create', () => {
  it('creates a SEEDED site: provisioned in SEEDED mode, a row stored, published listing-only, audited; nothing is sent', async () => {
    const v = await w.svc.create(row(), ops);
    expect(v).toMatchObject({ lifecycle: 'SEEDED', outreachStatus: 'NOT_CONTACTED', sourceKind: 'FIELD_VISIT', publicFactsConfirmed: true, ownerAgreedToContact: false, business: { name: 'Sri Ganesh Plumbing', city: 'Chennai', area: 'T Nagar' } });
    expect(w.provisioner.calls).toHaveLength(1); expect(w.provisioner.calls[0].input.phone).toBe('+919876543210'); expect(w.provisioner.calls[0].placeholderEmail).toMatch(/^site\+seed-[0-9a-f]{24}@sites\.get4domain\.invalid$/);
    expect(w.publisher.published).toEqual([w.provisioner.calls.length ? [...w.store.rows.values()][0].vendorId : '']);
    expect(w.store.audits.map((a) => a.action)).toContain('seeded.create'); expect(w.handover.issued).toEqual([]);
    expect(v.quality).toEqual({ pass: true, missing: [] });
  });
  it('the phone is stored only as a keyed hash on the row; the public email only as a hash', async () => {
    await w.svc.create(row(), ops);
    const r = [...w.store.rows.values()][0];
    expect(r.phoneHash).toBe(phoneHash('+919876543210')); expect(r.emailHash).toMatch(/^[0-9a-f]{64}$/); expect(JSON.stringify(r)).not.toMatch(/9876543210|ganesh@example/);
  });
  it('the staff checkbox, the required fields and the category are enforced (400 with every problem listed); nothing is created', async () => {
    expect(await code(w.svc.create(row({ publicFactsOnly: false }), ops))).toBe('SEEDED_INVALID');
    expect(await code(w.svc.create(row({ area: '' }), ops))).toBe('SEEDED_INVALID');
    expect(await code(w.svc.create(row({ category: 'spaceship' }), ops))).toBe('SEEDED_INVALID');
    expect(await code(w.svc.create(row({ phone: '123' }), ops))).toBe('SEEDED_INVALID');
    expect(w.provisioner.calls).toHaveLength(0); expect(w.store.rows.size).toBe(0);
  });
  it('a duplicate (same phone, same email, same name and city) is refused 409 and can NOT be overridden', async () => {
    await w.svc.create(row(), ops);
    expect(await code(w.svc.create(row({ businessName: 'Other', email: '' }), ops))).toBe('SEEDED_DUPLICATE');                                 // same phone
    expect(await code(w.svc.create(row({ phone: '9000000001', businessName: 'Other' }), ops))).toBe('SEEDED_DUPLICATE');                         // same email
    expect(await code(w.svc.create(row({ phone: '9000000002', email: '' }), ops))).toBe('SEEDED_DUPLICATE');                                    // same name and city
    expect(await code(w.svc.create(row({ overrideReason: 'trying' } as never), sup))).toBe('SEEDED_DUPLICATE');
    expect(w.store.rows.size).toBe(1);
  });
  it('a phone on the do-not-contact register blocks creation; only a SUPER_ADMIN with a reason can override, and it is audited', async () => {
    await w.svc.addToRegister('98765 43210', 'asked not to be listed', ops);
    expect(await code(w.svc.create(row(), ops))).toBe('SEEDED_DNC');
    expect(await code(w.svc.create(row(), ops, ))).toBe('SEEDED_DNC');
    expect(await code(w.svc.create(row(), ops, { overrideReason: 'owner asked again in writing' } as never))).toBe('SEEDED_OVERRIDE_FORBIDDEN');   // not a SUPER_ADMIN
    expect(await code(w.svc.create(row(), sup, { overrideReason: 'abc' }))).toBe('LIFECYCLE_REASON_REQUIRED');
    const v = await w.svc.create(row(), sup, { overrideReason: 'owner asked again in writing' });
    expect(v.lifecycle).toBe('SEEDED'); expect(w.store.audits.map((a) => a.action)).toContain('seeded.override_create');
  });
});

describe('batches', () => {
  const csv = csvOf([csvRow(), csvRow({ businessName: 'Beta Plumbing', phone: '9822222222' }), csvRow({ businessName: 'Gamma', category: 'spaceship', phone: '9833333333' }), csvRow({ businessName: 'Delta', phone: '9811111111' })]);
  it('a DRY RUN validates and reports duplicates and creates NOTHING (no vendor, no site, no seeded row, nothing published); the batch is recorded as DRY_RUN', async () => {
    const r = await w.svc.batch(csv, 'a.csv', 'DRY_RUN', ops);
    expect(r.counts).toEqual({ total: 4, ok: 2, rejected: 1, duplicates: 1, onRegister: 0, created: 0 });
    expect(r.lines.map((l) => [l.line, l.status])).toEqual([[2, 'OK'], [3, 'OK'], [4, 'REJECTED'], [5, 'DUPLICATE']]);
    expect(r.lines[3].duplicates).toEqual([{ kind: 'PHONE', with: 'BATCH_ROW', line: 2 }]); expect(r.lines[2].errors?.join()).toContain('spaceship');
    expect(w.provisioner.calls).toHaveLength(0); expect(w.store.rows.size).toBe(0); expect(w.publisher.published).toEqual([]);
    expect([...w.store.batches.values()]).toEqual([expect.objectContaining({ mode: 'DRY_RUN', rowsTotal: 4, rowsCreated: 0, fileName: 'a.csv' })]);
  });
  it('APPLY creates the rows that passed, records the batch, skips duplicates, and one failing row does not stop the rest', async () => {
    w.provisioner.failFor.add('Beta Plumbing');
    const r = await w.svc.batch(csv, 'a.csv', 'APPLIED', ops);
    expect(r.lines.find((l) => l.line === 2)).toMatchObject({ status: 'OK', created: true }); expect(r.lines.find((l) => l.line === 3)).toMatchObject({ status: 'OK', created: false, failure: 'SEEDED_INVALID' });
    expect(r.counts.created).toBe(1); expect(w.store.rows.size).toBe(1); expect([...w.store.rows.values()][0].batchId).toBe(r.batchId);
    expect([...w.store.batches.values()][0]).toMatchObject({ mode: 'APPLIED', rowsCreated: 1, rowsRejected: 3 });
  });
  it('running the same file again creates nothing new: every row is now a duplicate', async () => {
    await w.svc.batch(csv, 'a.csv', 'APPLIED', ops);
    const again = await w.svc.batch(csv, 'a.csv', 'APPLIED', ops);
    expect(again.counts.created).toBe(0); expect(again.lines.filter((l) => l.status === 'DUPLICATE')).toHaveLength(3); expect(w.store.rows.size).toBe(2);
  });
  it('rows with a phone on the register are skipped (reported ON_REGISTER); a SUPER_ADMIN override with a reason creates them', async () => {
    await w.svc.addToRegister('9822222222', 'asked not to be listed', ops);
    const r = await w.svc.batch(csv, 'a.csv', 'DRY_RUN', ops);
    expect(r.lines.find((l) => l.line === 3)?.status).toBe('ON_REGISTER'); expect(r.counts.onRegister).toBe(1);
    expect(await code(w.svc.batch(csv, 'a.csv', 'APPLIED', ops, 'owner asked again'))).toBe('SEEDED_OVERRIDE_FORBIDDEN');
    const ov = await w.svc.batch(csv, 'a.csv', 'APPLIED', sup, 'owner asked again in writing');
    expect(ov.lines.find((l) => l.line === 3)).toMatchObject({ status: 'OK', created: true });
  });
  it('the row limit comes from the setting; a bad file is a 400; an empty file is a 400', async () => {
    w.b3.over = { seededBatchMaxRows: 2 };
    expect(await code(w.svc.batch(csv, 'a.csv', 'DRY_RUN', ops))).toBe('SEEDED_INVALID');
    w.b3.over = {};
    expect(await code(w.svc.batch('businessName,city\nA,B\n', 'a.csv', 'DRY_RUN', ops))).toBe('SEEDED_INVALID');
    expect(await code(w.svc.batch('', 'a.csv', 'DRY_RUN', ops))).toBe('SEEDED_INVALID');
  });
});

describe('outreach, consent and claim links', () => {
  const made = async () => { const v = await w.svc.create(row(), ops); return v.id; };
  it('a claim link needs the consent flag; with it, one is issued once, the site becomes INVITED and the status CLAIM_LINK_SENT', async () => {
    const id = await made();
    expect(await code(w.svc.issueClaimLink(id, ops))).toBe('SEEDED_CONSENT_REQUIRED');
    await w.svc.setConsent(id, true, ops);
    const r = await w.svc.issueClaimLink(id, ops);
    expect(r.claimUrl).toContain('/claim/RAW-'); expect(r.note).toMatch(/nothing was emailed/);
    const v = await w.svc.get(id, 'OPERATIONS'); expect(v).toMatchObject({ lifecycle: 'INVITED', outreachStatus: 'CLAIM_LINK_SENT', ownerAgreedToContact: true, ownerAgreedBy: 'staff-1' });
    expect(JSON.stringify([...w.store.audits, ...w.store.logs])).not.toContain('RAW-');   // the link itself is never logged
  });
  it('withdrawing the consent blocks the next link; revoking returns an INVITED site to SEEDED', async () => {
    const id = await made(); await w.svc.setConsent(id, true, ops); await w.svc.issueClaimLink(id, ops);
    expect((await w.svc.revokeClaimLink(id, ops)).revoked).toBe(1); expect(await w.svc.get(id, 'OPERATIONS')).toMatchObject({ lifecycle: 'SEEDED' });
    await w.svc.setConsent(id, false, ops); expect(await code(w.svc.issueClaimLink(id, ops))).toBe('SEEDED_CONSENT_REQUIRED');
  });
  it('a phone that joined the register after consent blocks the link', async () => {
    const id = await made(); await w.svc.setConsent(id, true, ops); await w.svc.addToRegister('98765 43210', 'asked not to be contacted', ops);
    expect(await code(w.svc.issueClaimLink(id, ops))).toBe('SEEDED_DNC');
  });
  it('once the owner claims the page the lifecycle follows (CLAIMED_FREE, then PRO when a paid plan runs); a claimed site gets no new link', async () => {
    const id = await made(); const vendorId = [...w.store.rows.values()][0].vendorId; await w.svc.setConsent(id, true, ops);
    w.facts.facts.get(vendorId)!.businessStatus = 'CLAIMED';
    expect(await w.svc.get(id, 'OPERATIONS')).toMatchObject({ lifecycle: 'CLAIMED_FREE' });
    expect([...w.store.rows.values()][0].lifecycle).toBe('CLAIMED_FREE');   // written through
    expect(await code(w.svc.issueClaimLink(id, ops))).toBe('SEEDED_DNC');
    w.facts.facts.get(vendorId)!.proActive = true; expect(await w.svc.get(id, 'OPERATIONS')).toMatchObject({ lifecycle: 'PRO' });
  });
  it('calls and notes are logged; the first call moves NOT_CONTACTED to CALLED; follow-up dates are validated', async () => {
    const id = await made();
    const v = await w.svc.logCall(id, { outcome: 'ANSWERED', note: 'asked to call back', nextFollowUpAt: '2026-11-08T10:00:00Z' }, ops);
    expect(v).toMatchObject({ outreachStatus: 'CALLED' }); expect(v.log).toHaveLength(1);
    await w.svc.updateOutreach(id, { status: 'INTERESTED', ownerStaffId: 'staff-9', note: 'wants it' }, ops);
    expect(await w.svc.get(id, 'OPERATIONS')).toMatchObject({ outreachStatus: 'INTERESTED', outreachOwnerStaffId: 'staff-9' });
    expect(await code(w.svc.updateOutreach(id, { nextFollowUpAt: 'not a date' }, ops))).toBe('SEEDED_INVALID');
  });
});

describe('removal is permanent', () => {
  it('"Do not contact" removes the site: REMOVED, the phone joins the register, the vendor is recorded as removed (410 / uniform 404 / noindex follow), the audit row is kept', async () => {
    const id = (await w.svc.create(row(), ops)).id; const vendorId = [...w.store.rows.values()][0].vendorId;
    const v = await w.svc.updateOutreach(id, { status: 'DO_NOT_CONTACT' }, ops);
    expect(v).toMatchObject({ lifecycle: 'REMOVED', outreachStatus: 'DO_NOT_CONTACT', removed: true });
    expect(w.store.register.has(phoneHash('+919876543210'))).toBe(true);
    expect(w.lifecycle.removals.get(vendorId)).toMatchObject({ kind: 'SEEDED_REMOVAL' }); expect(w.lifecycle.directoryRemoved.has(vendorId)).toBe(true);
    expect(w.store.audits.length).toBeGreaterThan(0); expect([...w.store.rows.values()]).toHaveLength(1);   // nothing deleted
  });
  it('an explicit removal needs a reason, is idempotent, and nothing can move a removed site again (status, consent, calls, claim links)', async () => {
    const id = (await w.svc.create(row(), ops)).id;
    expect(await code(w.svc.remove(id, '', ops))).toBe('LIFECYCLE_REASON_REQUIRED');
    await w.svc.remove(id, 'the owner phoned to ask', ops); await w.svc.remove(id, 'the owner phoned to ask', ops);
    expect(w.store.register.size).toBe(1); expect(w.lifecycle.audits.filter((a) => a.action === 'seeded.remove')).toHaveLength(1);
    for (const f of [() => w.svc.updateOutreach(id, { status: 'CALLED' }, ops), () => w.svc.setConsent(id, true, ops), () => w.svc.logCall(id, { outcome: 'x1' }, ops), () => w.svc.issueClaimLink(id, ops)]) expect(await code(f())).toBe('SEEDED_REMOVED');
  });
  it('a removed business is never recreated from a batch; only a SUPER_ADMIN override with a reason can, and the register still blocks claim links', async () => {
    const id = (await w.svc.create(row(), ops)).id; await w.svc.remove(id, 'the owner phoned to ask', ops);
    const csv = csvOf([csvRow({ businessName: 'Sri Ganesh Plumbing', phone: '98765 43210', area: 'T Nagar' })]);
    expect((await w.svc.batch(csv, 'again.csv', 'APPLIED', ops)).counts.created).toBe(0);
    const csv2 = csvOf([csvRow({ businessName: 'Re-listed Plumbing', phone: '98765 43210', area: 'T Nagar' })]);
    expect((await w.svc.batch(csv2, 'again.csv', 'APPLIED', ops)).lines[0].status).toBe('DUPLICATE');   // the removed row still holds the phone key: never recreated
    expect(await code(w.svc.create(row(), ops))).toBe('SEEDED_DUPLICATE');
  });
});

describe('roles, the register and the indexing setting', () => {
  it('MARKETING sees only non-personal fields: no vendor id, no consent, no notes, no quality, no source note; OPERATIONS sees everything', async () => {
    await w.svc.create(row(), ops);
    const list = await w.svc.list({ skip: 0, take: 10 }, 'MARKETING');
    expect(Object.keys(list.items[0]).sort()).toEqual(['batchId', 'business', 'createdAt', 'id', 'lifecycle', 'outreachStatus', 'removed', 'sourceKind']);
    expect(JSON.stringify(list)).not.toMatch(/phone|ownerAgreed|sourceNote|vendorId|Seen on the shop board/);
    const full = await w.svc.get(list.items[0].id, 'OPERATIONS'); expect(full).toHaveProperty('vendorId'); expect(full).toHaveProperty('ownerAgreedToContact');
    expect(Object.keys(await w.svc.get(list.items[0].id, mkt.role))).not.toContain('log');
  });
  it('the register stores hashes only, shows a prefix, never overwrites; a bad phone is a 400; a reason is required', async () => {
    expect(await w.svc.addToRegister('98765 43210', 'asked not to be contacted', ops)).toEqual({ added: true });
    expect(await w.svc.addToRegister('+91 98765-43210', 'asked again', ops)).toEqual({ added: false });
    const r = await w.svc.readRegister(0, 10); expect(r.items).toHaveLength(1); expect(r.items[0].phoneHash).toHaveLength(12); expect(JSON.stringify(r)).not.toContain('9876543210');
    expect(await code(w.svc.addToRegister('123', 'asked not to be contacted', ops))).toBe('SEEDED_INVALID'); expect(await code(w.svc.addToRegister('98765 43210', '', ops))).toBe('LIFECYCLE_REASON_REQUIRED');
  });
  it('seededSiteIndexingMode is not editable through the generic settings route (its own SUPER_ADMIN route needs a reason)', () => {
    expect(() => validateExtraSetting('seededSiteIndexingMode', 'QUALITY')).toThrow(/not a known plan setting/);
    expect(() => validateExtraSetting('seededBatchMaxRows', 50)).not.toThrow();
  });
  it('unknown ids are 404 everywhere', async () => {
    for (const f of [() => w.svc.get('nope', 'OPERATIONS'), () => w.svc.setConsent('nope', true, ops), () => w.svc.remove('nope', 'a reason here', ops), () => w.svc.issueClaimLink('nope', ops)]) expect(await code(f())).toBe('SEEDED_NOT_FOUND');
  });
});
