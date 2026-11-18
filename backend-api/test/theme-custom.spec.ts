import { HttpException } from '@nestjs/common';
import { createHash } from 'crypto';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';
import { contentProblems } from '../src/v3-theme-market/core/theme-package-core';
import { ThemeChangeNotifier, ThemeMarketService } from '../src/v3-theme-market/theme-market.service';
import { buf, themeFiles, zipOf } from './support/theme-package-fixtures';
import { MemoryThemeMarketStore } from './support/memory-theme-market-store';

/**
 * TM1 M4: a theme made for ONE customer, and releasing it to the marketplace. Private upload and use, the recorded consent (a yes and a note, audited), the refusal of any package that carries the business's
 * name, address, phone, e-mail or own media, the clean-version flow, and the moment the released theme becomes visible to every other business. Real packages and the real kit.
 */
jest.setTimeout(300_000);
const staff = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const file = (buffer: Buffer) => ({ buffer, size: buffer.length });
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 9)]);
const fail = async (p: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> => { try { await p; } catch (e) { if (e instanceof HttpException) return { status: e.getStatus(), body: e.getResponse() as Record<string, unknown> }; throw e; } throw new Error('expected a refusal'); };
const PRIVATE = { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'Made for one customer.', sourceVendorId: 'vendor-aaaa' };
const homeWith = (files: Record<string, Buffer>, extra: string): Record<string, Buffer> => ({ ...files, 'templates/home.html': buf(`${files['templates/home.html'].toString('utf8')}\n${extra}`) });

function world() {
  const store = new MemoryThemeMarketStore(); const notifier = new ThemeChangeNotifier(); const kit = loadKit();
  store.vendors.set('vendor-aaaa', { name: 'Sharma Plumbing Works', email: 'owner@sharma-plumbing.example', phone: '+91 98765 43210', subdomain: 'sharma', customDomain: 'sharmaplumbing.in', mediaHashes: [sha(PNG)] });
  const market = new ThemeMarketService(store, notifier, kit); const themes = new ThemeRenderService(kit, store, notifier);
  const upload = (files: Record<string, Buffer>, vendorId: string | null = 'vendor-aaaa') => market.upload(staff, file(zipOf(files)), { vendorId });
  const publishPrivately = async (files: Record<string, Buffer>) => { const t = (await upload(files)).theme; await market.submit(t.id, staff); return market.publish(t.id, staff); };
  return { store, market, themes, upload, publishPrivately };
}
const clean = (version: number) => themeFiles({ version, marketplace: PRIVATE }, 'tm1-custom-clinic');

describe('custom theme for one customer', () => {
  it('uploads PRIVATE for the business, publishes for it alone, and the business (only) can use it', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      const pub = await w.publishPrivately(clean(1));
      expect(pub).toMatchObject({ status: 'PUBLISHED', visibility: 'PRIVATE', privateVendorId: 'vendor-aaaa', sourceVendorId: 'vendor-aaaa' });
      expect(w.themes.listThemes('vendor-aaaa').map((t) => t.id)).toContain('tm1-custom-clinic');
      expect(w.themes.listThemes('vendor-bbbb').map((t) => t.id)).not.toContain('tm1-custom-clinic'); expect(w.themes.listThemes().map((t) => t.id)).not.toContain('tm1-custom-clinic');
    } finally { w.themes.onModuleDestroy(); }
  });

  describe('releasing it to the marketplace needs the customer\'s recorded consent', () => {
    it('refuses without a yes, without a note and for a theme that is not private and published; nothing changes', async () => {
      const w = world();
      const draft = (await w.upload(clean(1))).theme;
      expect((await fail(w.market.publishToMarketplace(draft.id, { consentObtained: true, consentNote: 'agreed by e-mail' }, staff))).body.code).toBe('THEME_STATE_INVALID');   // still a draft
      await w.market.submit(draft.id, staff); await w.market.publish(draft.id, staff);
      for (const c of [{}, { consentObtained: false, consentNote: 'agreed' }, { consentObtained: true }, { consentObtained: true, consentNote: 'x' }, { consentObtained: true, consentNote: 'y'.repeat(501) }]) {
        const f = await fail(w.market.publishToMarketplace(draft.id, c as never, staff)); expect([f.status, f.body.code]).toEqual([409, 'THEME_CONSENT_REQUIRED']);
      }
      expect(w.store.rows[0]).toMatchObject({ visibility: 'PRIVATE', privateVendorId: 'vendor-aaaa', consentObtained: null }); expect(w.store.audits.map((a) => a.action)).not.toContain('theme.publish_to_marketplace');
    });

    it('with the consent it becomes PUBLIC, keeps its key and version, records who and when and the note, and is audited with the note', async () => {
      const w = world(); await w.themes.onModuleInit();
      try {
        const pub = await w.publishPrivately(clean(1));
        expect(w.themes.listThemes('vendor-bbbb').map((t) => t.id)).not.toContain('tm1-custom-clinic');
        const out = await w.market.publishToMarketplace(pub.id, { consentObtained: true, consentNote: 'Owner agreed by e-mail on 2 Dec' }, staff);
        expect(out).toMatchObject({ key: 'tm1-custom-clinic', version: 1, status: 'PUBLISHED', visibility: 'PUBLIC', privateVendorId: null, sourceVendorId: 'vendor-aaaa', consent: { obtained: true, note: 'Owner agreed by e-mail on 2 Dec', byId: 'staff-1' } });
        expect(out.consent.at).not.toBeNull();
        const a = w.store.audits.find((x) => x.action === 'theme.publish_to_marketplace')!; expect(a.after).toMatchObject({ visibility: 'PUBLIC', consentObtained: true, consentNote: 'Owner agreed by e-mail on 2 Dec' }); expect(a.actor.id).toBe('staff-1');
        // the runtime knew at once: every business may now choose it, and the business that had it keeps it
        expect(w.themes.listThemes('vendor-bbbb').map((t) => t.id)).toContain('tm1-custom-clinic'); expect(w.themes.listThemes().map((t) => t.id)).toContain('tm1-custom-clinic'); expect(w.themes.listThemes('vendor-aaaa').map((t) => t.id)).toContain('tm1-custom-clinic');
        // it cannot be released twice, and a marketplace theme is not a private one
        expect((await fail(w.market.publishToMarketplace(pub.id, { consentObtained: true, consentNote: 'again please' }, staff))).body.code).toBe('THEME_STATE_INVALID');
      } finally { w.themes.onModuleDestroy(); }
    });
  });

  describe('a package that carries the business is refused, file by file', () => {
    const released = async (w: ReturnType<typeof world>, files: Record<string, Buffer>) => { const t = await w.publishPrivately(files); return fail(w.market.publishToMarketplace(t.id, { consentObtained: true, consentNote: 'agreed' }, staff)); };

    it.each([
      ['its name', 'Welcome to Sharma Plumbing Works'], ['its name in any case', 'WELCOME TO SHARMA PLUMBING WORKS'], ['its web address', 'Visit sharma.get4domain.com for more'], ['its own domain', 'Visit sharmaplumbing.in for more'],
    ])('refuses %s in a template and names the file and the rule', async (_label, text) => {
      const w = world(); const f = await released(w, homeWith(clean(1), `<p>${text}</p>`));
      expect([f.status, f.body.code]).toEqual([409, 'THEME_PRIVATE_CONTENT']);
      expect((f.body.problems as Array<{ file: string; rule: string }>).some((p) => p.file === 'templates/home.html' && p.rule === 'content-vendor-detail')).toBe(true);
      expect(w.store.rows[0].visibility).toBe('PRIVATE'); expect(JSON.stringify(f.body)).not.toContain('Sharma Plumbing Works');   // the refusal never repeats the detail it found
    });
    it('refuses a file from the business\'s own media (by hash) and names the file', async () => {
      const w = world(); const f = await released(w, { ...clean(1), 'assets/photo.png': PNG });
      expect(f.body.code).toBe('THEME_PRIVATE_CONTENT'); expect((f.body.problems as Array<{ file: string; rule: string }>).some((p) => p.file === 'assets/photo.png' && p.rule === 'content-vendor-media')).toBe(true);
    });
    it('the clean-version flow: v1 is refused, v2 without the detail is uploaded for the business, published for it, and then released', async () => {
      const w = world(); await w.themes.onModuleInit();
      try {
        const v1 = await w.publishPrivately(homeWith(clean(1), '<p>Sharma Plumbing Works</p>'));
        expect((await fail(w.market.publishToMarketplace(v1.id, { consentObtained: true, consentNote: 'agreed' }, staff))).body.code).toBe('THEME_PRIVATE_CONTENT');
        const v2 = await w.publishPrivately(clean(2));   // publishing v2 retires v1 for new choices; the business simply gets v2
        expect(w.store.rows.map((r) => [r.version, r.status])).toEqual([[1, 'ARCHIVED'], [2, 'PUBLISHED']]);
        const out = await w.market.publishToMarketplace(v2.id, { consentObtained: true, consentNote: 'agreed after the clean-up' }, staff);
        expect(out).toMatchObject({ version: 2, visibility: 'PUBLIC' }); expect(w.themes.getTheme('tm1-custom-clinic')).toMatchObject({ version: 2, visibility: 'PUBLIC' });
      } finally { w.themes.onModuleDestroy(); }
    });
  });

  describe('the vendor-detail check itself', () => {
    const phone = [{ label: 'phone', value: '+91 98765 43210' }];
    const html = (t: string) => ({ 'templates/home.html': buf(`<main><p>${t}</p></main>`) });
    it('finds a phone number however it is spaced, and not an unrelated number', () => {
      for (const t of ['9876543210', '98765 43210', '98765-43210', '+91 98765 43210', '(98765) 43210', '+91-9876543210']) expect(contentProblems(html(`Call ${t} now`), { forbiddenText: phone }).map((p) => p.rule)).toContain('content-vendor-detail');
      expect(contentProblems(html('Open 10:30 to 18:45, since 2009, 12345 6789'), { forbiddenText: phone })).toEqual([]);
      expect(contentProblems({ 'css/base.css': buf('.x{width:9876543210px}') }, { forbiddenText: phone })).toEqual([]);   // a stylesheet has numbers, not phones
    });
    it('finds the e-mail and a name, ignores a short value and a placeholder', () => {
      const f = [{ label: 'e-mail address', value: 'Owner@Sharma.example' }, { label: 'name', value: 'Sharma Plumbing Works' }, { label: 'name', value: 'AB' }];
      expect(contentProblems(html('Write to owner@sharma.example'), { forbiddenText: f }).map((p) => p.rule)).toEqual(expect.arrayContaining(['content-email', 'content-vendor-detail']));
      expect(contentProblems(html('{{site.name}} - {{contact.email}} ab AB'), { forbiddenText: f })).toEqual([]);
    });
  });

  it('a package made for one business cannot be uploaded for another, and an unknown business is refused', async () => {
    const w = world(); w.store.vendors.set('vendor-bbbb', { name: 'Other', email: null, phone: null, subdomain: null, customDomain: null, mediaHashes: [] });
    const f = await fail(w.upload(clean(1), 'vendor-bbbb')); expect((f.body.problems as Array<{ rule: string }>).map((p) => p.rule)).toContain('marketplace-source-vendor');
    expect((await fail(w.upload(clean(1), 'vendor-zzzz'))).body.code).toBe('THEME_VENDOR_NOT_FOUND');
  });
});
