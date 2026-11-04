import * as fs from 'fs';
import * as path from 'path';
import { AccountSetupGrantService } from '../src/directory/grants/account-setup-grant.service';
import { PublishService } from '../src/site-publish/publish/publish.service';
import { TermsService } from '../src/terms/terms.service';
import { TERMS_KINDS, VENDOR_REQUIRED_KINDS } from '../src/terms/core/terms-core';
import { seedTermsDrafts } from '../src/terms/seed/terms-seed';
import { generateToken, hashToken } from '../src/provisioning/claims/token';
import { requestsWorld } from './support/requests-world';
import { REAL_TEXT, STAFF, termsWorld } from './support/terms-world';
import { entitlements } from './support/site-fixtures';

const status = async (p: Promise<unknown>): Promise<number> => { try { await p; return 200; } catch (e) { return (e as { status?: number; getStatus?: () => number }).getStatus?.() ?? (e as { status?: number }).status ?? 500; } };
const codeOf = async (p: Promise<unknown>): Promise<string | undefined> => { try { await p; return undefined; } catch (e) { return ((e as { getResponse?: () => { code?: string } }).getResponse?.() ?? {}).code; } };

describe('terms: the loader', () => {
  it('a dry run writes nothing; --apply creates one DRAFT per kind with the placeholder; a second run creates nothing; the loader cannot publish', async () => {
    const w = await termsWorld({ seed: false });
    const dry = await seedTermsDrafts(w.store, { apply: false });
    expect(dry.missing).toEqual([...TERMS_KINDS]); expect(dry.created).toEqual([]); expect(w.store.docs.size).toBe(0);
    const applied = await seedTermsDrafts(w.store, { apply: true });
    expect(applied.created).toEqual([...TERMS_KINDS]);
    const rows = await w.store.listDocuments({});
    expect(rows).toHaveLength(8); expect(rows.every((r) => r.status === 'DRAFT' && r.version === 1 && r.bodyMarkdown === 'To be supplied by counsel' && r.publishedAt === null)).toBe(true);
    const again = await seedTermsDrafts(w.store, { apply: true });
    expect(again.created).toEqual([]); expect(w.store.docs.size).toBe(8);
  });
  it('a kind that already has a row (even a published one) is left exactly as it is', async () => {
    const w = await termsWorld(); await w.publish('PRIVACY');
    const before = JSON.stringify(await w.store.listDocuments({ kind: 'PRIVACY' }));
    await seedTermsDrafts(w.store, { apply: true });
    expect(JSON.stringify(await w.store.listDocuments({ kind: 'PRIVACY' }))).toBe(before);
  });
  it('nothing is published after seeding: the public sees 404 for every kind', async () => {
    const w = await termsWorld();
    for (const k of TERMS_KINDS) expect(await status(w.svc.latest(k))).toBe(404);
  });
});

describe('terms: staff publishing', () => {
  it('the placeholder cannot be published, however it is dressed (TERMS_PLACEHOLDER, 422)', async () => {
    const w = await termsWorld(); const d = await w.draftOf('VENDOR_TERMS');
    expect([await status(w.svc.publish(d.id, 'First version', STAFF)), await codeOf(w.svc.publish(d.id, 'First version', STAFF))]).toEqual([422, 'TERMS_PLACEHOLDER']);
    await w.svc.updateDraft(d.id, { bodyMarkdown: '## Terms\n\n_To be supplied by counsel._' }, STAFF);
    expect(await status(w.svc.publish(d.id, 'First version', STAFF))).toBe(422);
    expect((await w.store.getDocument(d.id))!.status).toBe('DRAFT');
  });
  it('a change note is required; a published document cannot be changed or published again; the previous version is retired', async () => {
    const w = await termsWorld(); const d = await w.draftOf('VENDOR_TERMS');
    await w.svc.updateDraft(d.id, { bodyMarkdown: REAL_TEXT, title: 'Vendor terms' }, STAFF);
    expect(await status(w.svc.publish(d.id, '', STAFF))).toBe(400); expect(await status(w.svc.publish(d.id, 'ok', STAFF))).toBe(400); expect(await status(w.svc.publish(d.id, undefined, STAFF))).toBe(400);
    const pub = await w.svc.publish(d.id, 'First version', STAFF);
    expect(pub).toMatchObject({ status: 'PUBLISHED', version: 1, changeNote: 'First version', publishedBy: 'staff-super', placeholder: false });
    expect(await status(w.svc.updateDraft(d.id, { bodyMarkdown: 'Changed after the fact' }, STAFF))).toBe(409);
    expect(await status(w.svc.publish(d.id, 'First version', STAFF))).toBe(409);
    const v2 = await w.svc.createDraft('VENDOR_TERMS', { bodyMarkdown: REAL_TEXT + '\n\nA new clause.' }, STAFF);
    expect(v2.version).toBe(2);
    await w.svc.publish(v2.id, 'Added a clause', STAFF);
    expect((await w.store.getDocument(d.id))!.status).toBe('RETIRED'); expect((await w.svc.latest('VENDOR_TERMS')).version).toBe(2);
    const versions = await w.svc.versions('VENDOR_TERMS'); expect(versions.versions.map((v) => [v.version, v.status])).toEqual([[2, 'PUBLISHED'], [1, 'RETIRED']]);
    expect(JSON.stringify(versions)).not.toContain('bodyMarkdown');
  });
  it('a draft never shows on the public routes; an unknown kind is the same 404', async () => {
    const w = await termsWorld(); await w.svc.createDraft('GRIEVANCE', { bodyMarkdown: REAL_TEXT }, STAFF);
    expect(await status(w.svc.latest('GRIEVANCE'))).toBe(404); expect(await status(w.svc.versions('GRIEVANCE'))).toBe(404);
    expect(await codeOf(w.svc.latest('NOPE'))).toBe('TERMS_NOT_FOUND'); expect(await codeOf(w.svc.latest('GRIEVANCE'))).toBe('TERMS_NOT_FOUND');
  });
  it('input is validated: an unknown kind, an over-long text, a bad title and an empty change are 400s', async () => {
    const w = await termsWorld(); const d = await w.draftOf('COOKIE');
    expect(await status(w.svc.createDraft('NOPE', {}, STAFF))).toBe(400); expect(await status(w.svc.updateDraft(d.id, {}, STAFF))).toBe(400);
    expect(await status(w.svc.updateDraft(d.id, { bodyMarkdown: 'x'.repeat(200_001) }, STAFF))).toBe(400); expect(await status(w.svc.updateDraft(d.id, { title: 't'.repeat(201) }, STAFF))).toBe(400);
    expect(await status(w.svc.updateDraft(d.id, { bodyMarkdown: '   ' }, STAFF))).toBe(400);
    expect(await status(w.svc.get('missing'))).toBe(404); expect(await status(w.svc.updateDraft('missing', { title: 'x' }, STAFF))).toBe(404); expect(await status(w.svc.publish('missing', 'First version', STAFF))).toBe(404);
    expect(await status(w.svc.list({ kind: 'NOPE' }))).toBe(400); expect(await status(w.svc.list({ status: 'NOPE' }))).toBe(400);
  });
  it('every change is audited; the audit row has the change note and NEVER the legal text', async () => {
    const w = await termsWorld(); const d = await w.draftOf('PRIVACY');
    await w.svc.updateDraft(d.id, { bodyMarkdown: REAL_TEXT + ' SECRET-CLAUSE' }, STAFF); await w.svc.publish(d.id, 'Because the law changed', STAFF);
    expect(w.store.audits.map((a) => a.action)).toEqual(expect.arrayContaining(['terms.draft.update', 'terms.publish']));
    expect(JSON.stringify(w.store.audits)).toContain('Because the law changed'); expect(JSON.stringify(w.store.audits)).not.toContain('SECRET-CLAUSE');
  });
});

describe('terms: acceptance', () => {
  it('nothing published means nothing to accept and the guard lets everything through (the platform is not locked behind a document counsel has not supplied)', async () => {
    const w = await termsWorld();
    expect(await w.svc.acceptanceRequired('va')).toBe(false); await expect(w.svc.require('va', VENDOR_REQUIRED_KINDS)).resolves.toBeUndefined();
    expect((await w.svc.status('va')).documents.every((x) => x.published === false)).toBe(true);
  });
  it('once published, the guard blocks (403 TERMS_ACCEPTANCE_REQUIRED naming what waits) until the current versions are accepted', async () => {
    const w = await termsWorld(); await w.publishRequired();
    expect(await w.svc.acceptanceRequired('va')).toBe(true);
    const r = await w.svc.require('va', VENDOR_REQUIRED_KINDS).catch((e) => e);
    expect(r.getStatus()).toBe(403); expect(r.getResponse()).toMatchObject({ code: 'TERMS_ACCEPTANCE_REQUIRED', outstanding: [{ kind: 'VENDOR_TERMS', version: 1 }, { kind: 'ACCEPTABLE_USE', version: 1 }, { kind: 'DATA_PROCESSING', version: 1 }] });
    expect(await w.acceptAll('va')).toEqual({ accepted: 3, acceptanceRequired: false });
    await expect(w.svc.require('va', VENDOR_REQUIRED_KINDS)).resolves.toBeUndefined(); expect(await w.svc.acceptanceRequired('va')).toBe(false);
  });
  it('accepting again is harmless (idempotent) and a stale or partial acceptance is refused with nothing recorded', async () => {
    const w = await termsWorld(); await w.publishRequired();
    expect(await status(w.svc.accept('va', 'u1', [{ kind: 'VENDOR_TERMS', version: 1 }], { ip: null, userAgent: null }, STAFF))).toBe(409);   // the other two are waiting
    expect(await status(w.svc.accept('va', 'u1', [{ kind: 'VENDOR_TERMS', version: 9 }, { kind: 'ACCEPTABLE_USE', version: 1 }, { kind: 'DATA_PROCESSING', version: 1 }], { ip: null, userAgent: null }, STAFF))).toBe(409);
    expect(w.store.acceptances).toHaveLength(0);
    await w.acceptAll('va'); expect(await w.acceptAll('va')).toEqual({ accepted: 0, acceptanceRequired: false }); expect(w.store.acceptances).toHaveLength(3);
  });
  it('publishing a NEW version makes acceptance required again, and the sign-in flag says so', async () => {
    const w = await termsWorld(); await w.publishRequired(); await w.acceptAll('va');
    expect(await w.svc.acceptanceRequired('va')).toBe(false);
    const v2 = await w.svc.createDraft('DATA_PROCESSING', { bodyMarkdown: REAL_TEXT + '\n\nA new processor.' }, STAFF); await w.svc.publish(v2.id, 'New processor added', STAFF);
    expect(await w.svc.acceptanceRequired('va')).toBe(true);
    await expect(w.svc.require('va', ['DATA_PROCESSING'])).rejects.toMatchObject({ status: 403 });
    await expect(w.svc.require('va', ['VENDOR_TERMS'])).resolves.toBeUndefined();   // the others are still accepted
    const st = await w.svc.status('va'); expect(st.outstanding).toEqual([{ kind: 'DATA_PROCESSING', version: 2 }]);
    expect(await w.acceptAll('va')).toEqual({ accepted: 1, acceptanceRequired: false });
    expect(w.store.acceptances.map((a) => `${a.kind}:${a.version}`).sort()).toEqual(['ACCEPTABLE_USE:1', 'DATA_PROCESSING:1', 'DATA_PROCESSING:2', 'VENDOR_TERMS:1']);   // the old acceptance is kept
  });
  it('acceptances never leak across vendors', async () => {
    const w = await termsWorld(); await w.publishRequired(); await w.acceptAll('va');
    expect(await w.svc.acceptanceRequired('va')).toBe(false); expect(await w.svc.acceptanceRequired('vb')).toBe(true);
    await expect(w.svc.require('vb', VENDOR_REQUIRED_KINDS)).rejects.toMatchObject({ status: 403 });
    expect(await w.store.listAcceptances('vb')).toEqual([]);
  });
  it('the record has hashes of the address and agent, never the raw values; the audit row names versions only', async () => {
    const w = await termsWorld(); await w.publishRequired(); await w.acceptAll('va');
    const a = w.store.acceptances[0]; expect(a.ipHash).toMatch(/^[0-9a-f]{64}$/); expect(a.userAgentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(w.store.acceptances)).not.toContain('203.0.113.9'); expect(JSON.stringify(w.store.acceptances)).not.toContain('jest');
    expect(w.store.audits.find((x) => x.action === 'terms.accept')!.after).toEqual({ documents: [{ kind: 'VENDOR_TERMS', version: 1 }, { kind: 'ACCEPTABLE_USE', version: 1 }, { kind: 'DATA_PROCESSING', version: 1 }] });
  });
  it('acceptances are immutable at the API: the store port and the service have no way to change or remove one', () => {
    const port = fs.readFileSync(path.join(__dirname, '../src/terms/terms.store.ts'), 'utf8');
    const portMethods = [...port.matchAll(/abstract (\w+)\(/g)].map((m) => m[1]).filter((n) => /accept/i.test(n));
    expect(portMethods.sort()).toEqual(['acceptedDocumentIds', 'listAcceptances', 'recordAcceptances']);   // read, list, append: nothing else
    const serviceMethods = Object.getOwnPropertyNames(TermsService.prototype).filter((n) => /accept/i.test(n));
    expect(serviceMethods.sort()).toEqual(['accept', 'acceptAtClaim', 'acceptanceRequired', 'requireAcceptance']);
    expect([...portMethods, ...serviceMethods].filter((n) => /^(delete|remove|update|revoke|withdraw|edit)/i.test(n))).toEqual([]);
    for (const f of ['prisma-terms.store.ts', 'terms.service.ts']) {
      const src = fs.readFileSync(path.join(__dirname, '../src/terms', f), 'utf8');
      expect(src).not.toMatch(/v3TermsAcceptance\.(update|updateMany|delete|deleteMany|upsert)\b/);
    }
  });
  it('and at the database: the migration refuses every update and every delete except the cascade of a tenant row that is already gone', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261116100000_v3_terms/migration.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TRIGGER "g4d_terms_acceptances_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_terms_acceptances" FOR EACH ROW/);
    expect(sql).toMatch(/TG_OP = 'UPDATE' THEN\s+RAISE EXCEPTION/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/); expect(sql).toMatch(/CHECK \(\("vendorId" IS NOT NULL\) <> \("customerRequestId" IS NOT NULL\)\)/);
    expect(sql).not.toMatch(/\bDROP\b|\bTRUNCATE\b|ALTER TABLE "(?!g4d_terms)/i);
  });
});

describe('terms: the guards in the other modules', () => {
  it('(a) a Pro vendor cannot publish a site with calls to action until the terms are accepted; a Free vendor is never asked', async () => {
    const w = await termsWorld(); await w.publishRequired();
    const calls: string[] = []; const repo = { publish: async () => { calls.push('published'); return { id: 'p1' }; } };
    const ents: Record<string, unknown> = { pro: entitlements('PRO', 'ecommerce'), free: entitlements('FREE', 'ecommerce') };
    const publisher = new PublishService(repo as never, {} as never, {} as never, { resolve: async (v: string) => ents[v] } as never, { hook: () => undefined } as never, w.svc);
    expect(await codeOf(publisher.publish('pro', 'pub-1', STAFF))).toBe('TERMS_ACCEPTANCE_REQUIRED'); expect(calls).toEqual([]);
    expect(await status(publisher.publish('free', 'pub-1', STAFF))).toBe(200);
    await w.acceptAll('pro'); expect(await status(publisher.publish('pro', 'pub-1', STAFF))).toBe(200); expect(calls).toEqual(['published', 'published']);
  });
  it('(a) a build without the terms module publishes as before', async () => {
    const repo = { publish: async () => ({ id: 'p1' }) };
    const publisher = new PublishService(repo as never, {} as never, {} as never, { resolve: async () => entitlements('PRO', 'ecommerce') } as never, { hook: () => undefined } as never);
    expect(await status(publisher.publish('pro', 'pub-1', STAFF))).toBe(200);
  });
  it('(b) a payment method cannot be activated until the terms are accepted', async () => {
    const t = await termsWorld(); await t.publishRequired();
    const w = await requestsWorld({ acceptance: t.svc });
    const OWNER = { type: 'VENDOR' as const, id: 'va', ip: null };
    const m = await w.vendor.createMethod('va', { kind: 'PAY_ON_DELIVERY', label: 'Cash' }, OWNER);
    expect(await codeOf(w.vendor.updateMethod('va', m.id, { status: 'ACTIVE' }, OWNER))).toBe('TERMS_ACCEPTANCE_REQUIRED');
    await t.acceptAll('va');
    expect((await w.vendor.updateMethod('va', m.id, { status: 'ACTIVE' }, OWNER)).status).toBe('ACTIVE');
  });
  it('(c) claim completion: the vendor terms must be accepted before the grant is spent; a refusal leaves the grant usable', async () => {
    const t = await termsWorld(); await t.publishRequired();
    const raw = generateToken(); const grant = { id: 'g1', vendorId: 'va', status: 'ACTIVE' as string, expiresAt: new Date(Date.now() + 3_600_000) };
    const repo = { findGrantByHash: async (h: string) => (h === hashToken(raw) ? { ...grant } : null), consumeGrant: async () => { if (grant.status !== 'ACTIVE') return false; grant.status = 'USED'; return true; } };
    const svc = new AccountSetupGrantService(repo as never, { record: async () => undefined } as never, t.svc);
    expect(await codeOf(svc.consume(raw))).toBe('TERMS_ACCEPTANCE_REQUIRED'); expect(await codeOf(svc.consume(raw, { acceptTerms: false }))).toBe('TERMS_ACCEPTANCE_REQUIRED'); expect(grant.status).toBe('ACTIVE');
    expect(await svc.consume(raw, { acceptTerms: true, ip: '203.0.113.9', userAgent: 'jest' })).toEqual({ vendorId: 'va' }); expect(grant.status).toBe('USED');
    expect(t.store.acceptances.map((a) => a.kind)).toEqual(['VENDOR_TERMS']);   // the claim asks for the vendor terms only
    expect(await t.svc.acceptanceRequired('va')).toBe(true);                    // the other two come at the next sign-in
  });
  it('(c) with no vendor terms published the claim goes through as before', async () => {
    const t = await termsWorld(); const raw = generateToken(); const grant = { id: 'g1', vendorId: 'va', status: 'ACTIVE' as string, expiresAt: new Date(Date.now() + 3_600_000) };
    const repo = { findGrantByHash: async () => ({ ...grant }), consumeGrant: async () => true };
    expect(await new AccountSetupGrantService(repo as never, { record: async () => undefined } as never, t.svc).consume(raw)).toEqual({ vendorId: 'va' });
  });
});
