import { HttpException } from '@nestjs/common';
import { THEME_MARKET_ERROR_CODES } from '../src/v3-theme-market/theme-market.errors';
import { ThemeChangeNotifier, ThemeMarketService } from '../src/v3-theme-market/theme-market.service';
import { goodZip, scriptZip, unsafeZip } from './support/theme-package-fixtures';
import { MemoryThemeMarketStore } from './support/memory-theme-market-store';

/**
 * The admin side of the theme marketplace over an in-memory store: upload, the all-problems refusal, idempotency, version and key rules, the DRAFT to ARCHIVED flow, the publish re-check, private themes,
 * filters, and an audit row for every change. The packages are real (a library theme repacked with a marketplace block) and checked by the real kit.
 */
jest.setTimeout(240_000);
const staff = { type: 'STAFF' as const, id: 'staff-1', ip: '127.0.0.1' };
const fail = async (p: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> => { try { await p; } catch (e) { if (e instanceof HttpException) return { status: e.getStatus(), body: e.getResponse() as Record<string, unknown> }; throw e; } throw new Error('expected a refusal'); };
const file = (buffer: Buffer) => ({ buffer, size: buffer.length });

function make() {
  const store = new MemoryThemeMarketStore(); const notifier = new ThemeChangeNotifier(); let told = 0; notifier.subscribe(() => { told += 1; });
  store.vendors.set('vendor-aaaa', { name: 'Acme', email: null, phone: null, subdomain: 'acme', customDomain: null, mediaHashes: [] });
  const svc = new ThemeMarketService(store, notifier); svc.clock = () => new Date('2026-12-03T10:00:00Z');
  return { store, svc, told: () => told };
}

describe('theme market service', () => {
  it('registers its error codes', () => { for (const c of ['THEME_PACKAGE_INVALID', 'THEME_VERSION_EXISTS', 'THEME_STATE_INVALID', 'THEME_PUBLISH_BLOCKED', 'THEME_NOT_FOUND']) expect(THEME_MARKET_ERROR_CODES).toContain(c); });

  describe('upload', () => {
    it('stores a good package as a DRAFT for the marketplace, with its metadata and one audit row; no bytes in the answer', async () => {
      const { svc, store } = make();
      const r = await svc.upload(staff, file(goodZip()));
      expect(r.replayed).toBe(false); expect(r.theme).toMatchObject({ key: 'tm1-test-hospitality', version: 1, status: 'DRAFT', visibility: 'PUBLIC', privateVendorId: null, tier: 'Standard', starter: true, packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], addons: ['ONLINE_ORDERING_DELIVERY'], tags: ['restaurant-plus-delivery'] });
      expect(JSON.stringify(r)).not.toMatch(/"bytes"/); expect(store.rows).toHaveLength(1); expect(store.rows[0].bytes.length).toBe(r.theme.sizeBytes);
      expect(store.audits).toEqual([expect.objectContaining({ action: 'theme.upload', after: expect.objectContaining({ key: 'tm1-test-hospitality', status: 'DRAFT', visibility: 'PUBLIC' }) })]);
    });
    it('the same bytes again are the same upload (nothing new, no second audit row)', async () => {
      const { svc, store } = make(); const z = goodZip();
      const a = await svc.upload(staff, file(z)); const b = await svc.upload(staff, file(z));
      expect(b.replayed).toBe(true); expect(b.theme.id).toBe(a.theme.id); expect(store.rows).toHaveLength(1); expect(store.audits).toHaveLength(1);
    });
    it('a refused package lists EVERY problem with its file and rule, stores nothing and writes no audit row', async () => {
      const { svc, store } = make();
      const f = await fail(svc.upload(staff, file(unsafeZip())));
      expect(f.status).toBe(422); expect(f.body.code).toBe('THEME_PACKAGE_INVALID');
      const problems = f.body.problems as Array<{ file: string; rule: string }>; expect(problems.some((p) => p.file === '../evil.html' && p.rule === 'path-traversal')).toBe(true);
      const s = await fail(svc.upload(staff, file(scriptZip()))); expect((s.body.problems as Array<{ file: string; rule: string }>).some((p) => p.rule === 'no-script-tag' && p.file === 'templates/home.html')).toBe(true);
      expect(store.rows).toHaveLength(0); expect(store.audits).toHaveLength(0);
    });
    it('a missing, empty or oversized file has its own code', async () => {
      const { svc } = make();
      expect((await fail(svc.upload(staff, undefined))).body.code).toBe('THEME_PACKAGE_MISSING');
      expect((await fail(svc.upload(staff, { buffer: Buffer.alloc(0) }))).body.code).toBe('THEME_PACKAGE_MISSING');
      const big = await fail(svc.upload(staff, { buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })); expect([big.status, big.body.code]).toEqual([413, 'THEME_PACKAGE_TOO_LARGE']);
    });
    it('a built-in library key is reserved (upload and the dry run both say so)', async () => {
      const { svc } = make(); const z = goodZip({}, 'free-practice');
      expect((await fail(svc.upload(staff, file(z)))).status).toBe(422);
      const v = await svc.validate(file(z)); expect(v.ok).toBe(false); expect(v.problems.some((p) => p.rule === 'key-reserved')).toBe(true);
    });
    it('versions only go up: the same version with other content and a lower version are refused; a higher one is a new row', async () => {
      const { svc, store } = make();
      await svc.upload(staff, file(goodZip({ version: 2 })));
      const same = await fail(svc.upload(staff, file(goodZip({ version: 2, description: 'changed text' })))); expect([same.status, same.body.code]).toEqual([409, 'THEME_VERSION_EXISTS']);
      const lower = await fail(svc.upload(staff, file(goodZip({ version: 1 })))); expect(lower.body.code).toBe('THEME_VERSION_EXISTS');
      const next = await svc.upload(staff, file(goodZip({ version: 3 }))); expect(next.theme.version).toBe(3); expect(store.rows).toHaveLength(2);
    });
    it('the dry run reports the same problems and stores nothing', async () => {
      const { svc, store } = make();
      const ok = await svc.validate(file(goodZip())); expect(ok).toMatchObject({ ok: true, problemCount: 0, manifest: { key: 'tm1-test-hospitality', version: 1 } });
      const bad = await svc.validate(file(scriptZip())); expect(bad.ok).toBe(false); expect(bad.problems.length).toBeGreaterThan(0);
      expect(store.rows).toHaveLength(0);
    });
  });

  describe('private themes (one business only)', () => {
    it('uploads PRIVATE to an existing business; an unknown business is 404; the key then belongs to that business', async () => {
      const { svc } = make();
      const nf = await fail(svc.upload(staff, file(goodZip({ marketplace: undefined })), { vendorId: 'vendor-zzzz' })); expect([nf.status, nf.body.code]).toEqual([404, 'THEME_VENDOR_NOT_FOUND']);
      const p = await svc.upload(staff, file(goodZip({ marketplace: { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'Made for one customer.', sourceVendorId: 'vendor-aaaa' } }, 'tm1-private')), { vendorId: 'vendor-aaaa' });
      expect(p.theme).toMatchObject({ visibility: 'PRIVATE', privateVendorId: 'vendor-aaaa', sourceVendorId: 'vendor-aaaa', status: 'DRAFT' });
      // the marketplace may not add a version of a key that belongs to one business, and another business may not either
      const m = await fail(svc.upload(staff, file(goodZip({ version: 2, marketplace: { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'Market.' } }, 'tm1-private')))); expect(m.body.code).toBe('THEME_KEY_RESERVED');
    });
    it('a package that names a different business than the upload is refused', async () => {
      const { svc } = make();
      const f = await fail(svc.upload(staff, file(goodZip({ marketplace: { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'Made for one customer.', sourceVendorId: 'someone-else' } }, 'tm1-private2')), { vendorId: 'vendor-aaaa' }));
      expect((f.body.problems as Array<{ rule: string }>).map((p) => p.rule)).toContain('marketplace-source-vendor');
    });
  });

  describe('the flow DRAFT, REVIEW, PUBLISHED, ARCHIVED', () => {
    it('moves in order, stamps each step, audits each step and tells the runtime on publish and archive only', async () => {
      const { svc, store, told } = make(); const { theme } = await svc.upload(staff, file(goodZip()));
      const sub = await svc.submit(theme.id, staff); expect(sub.status).toBe('REVIEW'); expect(sub.submittedAt).not.toBeNull(); expect(told()).toBe(0);
      const pub = await svc.publish(theme.id, staff); expect(pub.status).toBe('PUBLISHED'); expect(pub.publishedAt).not.toBeNull(); expect(told()).toBe(1);
      const arc = await svc.archive(theme.id, staff); expect(arc.status).toBe('ARCHIVED'); expect(arc.archivedAt).not.toBeNull(); expect(told()).toBe(2);
      expect(store.audits.map((a) => a.action)).toEqual(['theme.upload', 'theme.submit', 'theme.publish', 'theme.archive']);
      expect(store.audits.every((a) => a.actor.id === 'staff-1')).toBe(true);
    });
    it('refuses a move the status does not allow, naming the status', async () => {
      const { svc } = make(); const { theme } = await svc.upload(staff, file(goodZip()));
      const a = await fail(svc.publish(theme.id, staff)); expect([a.status, a.body.code, a.body.status]).toEqual([409, 'THEME_STATE_INVALID', 'DRAFT']);   // DRAFT cannot skip review
      await svc.submit(theme.id, staff);
      expect((await fail(svc.submit(theme.id, staff))).body.code).toBe('THEME_STATE_INVALID');
      await svc.publish(theme.id, staff); await svc.archive(theme.id, staff);
      expect((await fail(svc.publish(theme.id, staff))).body.code).toBe('THEME_STATE_INVALID'); expect((await fail(svc.archive(theme.id, staff))).body.code).toBe('THEME_STATE_INVALID');
    });
    it('a reviewer can send a theme back to draft with a note, and the note is required', async () => {
      const { svc } = make(); const { theme } = await svc.upload(staff, file(goodZip())); await svc.submit(theme.id, staff);
      expect((await fail(svc.returnToDraft(theme.id, 'x', staff))).body.code).toBe('THEME_STATE_INVALID');
      const r = await svc.returnToDraft(theme.id, 'Please add a Tamil check', staff); expect([r.status, r.reviewNote, r.submittedAt]).toEqual(['DRAFT', 'Please add a Tamil check', null]);
    });
    it('publish checks the stored package again: a package that no longer passes is 409 THEME_PUBLISH_BLOCKED with the problems', async () => {
      const { svc, store } = make(); const { theme } = await svc.upload(staff, file(goodZip())); await svc.submit(theme.id, staff);
      store.rows[0].bytes = scriptZip();   // the stored bytes changed (or the rules grew): the re-check must catch it
      const f = await fail(svc.publish(theme.id, staff)); expect([f.status, f.body.code]).toEqual([409, 'THEME_PUBLISH_BLOCKED']);
      expect((f.body.problems as Array<{ rule: string }>).some((p) => p.rule === 'no-script-tag')).toBe(true); expect(store.rows[0].status).toBe('REVIEW');
    });
    it('publishing a newer version archives the older published version of the same key', async () => {
      const { svc, store } = make();
      const v1 = (await svc.upload(staff, file(goodZip({ version: 1 })))).theme; await svc.submit(v1.id, staff); await svc.publish(v1.id, staff);
      const v2 = (await svc.upload(staff, file(goodZip({ version: 2 })))).theme; await svc.submit(v2.id, staff); await svc.publish(v2.id, staff);
      expect(store.rows.map((r) => [r.version, r.status])).toEqual([[1, 'ARCHIVED'], [2, 'PUBLISHED']]);
    });
    it('an unknown or malformed id is a plain 404', async () => {
      const { svc } = make();
      for (const id of ['nope', 'x'.repeat(80), 'theme-id-9999']) expect((await fail(svc.get(id))).status).toBe(404);
    });
  });

  describe('list', () => {
    it('filters by status, pack, add-on, tag and visibility; a value that is not recognised is a plain 400, not an empty list', async () => {
      const { svc } = make();
      await svc.upload(staff, file(goodZip({}, 'tm1-one')));
      await svc.upload(staff, file(goodZip({ marketplace: { packs: ['HOSPITALITY_EVENTS'], licence: 'Built by the team.' } }, 'tm1-two')));
      expect((await svc.list({ pack: 'FOOD_SERVICE' })).items.map((t) => t.key)).toEqual(['tm1-one']);
      expect((await svc.list({ addon: 'ONLINE_ORDERING_DELIVERY' })).total).toBe(1);
      expect((await svc.list({ tag: 'restaurant-plus-delivery' })).total).toBe(1);
      expect((await svc.list({ status: 'DRAFT', visibility: 'PUBLIC' })).total).toBe(2); expect((await svc.list({ status: 'PUBLISHED' })).total).toBe(0);
      expect((await svc.list({ q: 'two' })).items.map((t) => t.key)).toEqual(['tm1-two']);
      for (const f of [{ status: 'LIVE' }, { pack: 'NOPE' }, { addon: 'NOPE' }, { tag: 'nope' }, { tier: 'Gold' }, { visibility: 'SECRET' }]) expect((await fail(svc.list(f as never))).body.code).toBe('THEME_FILTER_INVALID');
    });
    it('pages are capped at 100 and never carry bytes', async () => {
      const { svc } = make(); await svc.upload(staff, file(goodZip()));
      const r = await svc.list({}, 1, 1000); expect(r.pageSize).toBe(100); expect(JSON.stringify(r)).not.toContain('"bytes"');
    });
  });
});
