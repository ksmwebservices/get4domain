import { HttpException } from '@nestjs/common';
import { Kit, loadKit, RenderInput } from '../src/site-publish/renderer/renderer-loader';
import { DYNAMIC_THEME_TTL_MS, ThemeRenderError, ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';
import { ThemeChangeNotifier, ThemeMarketService } from '../src/v3-theme-market/theme-market.service';
import { goodZip, scriptZip } from './support/theme-package-fixtures';
import { MemoryThemeMarketStore } from './support/memory-theme-market-store';
import { doc } from './support/site-fixtures';
import { OWNER, siteWorld, STAFF } from './support/site-world';

/**
 * TM1 M3, automatic integration: a theme published in the marketplace is drawn by the renderer and offered to vendors with no rebuild and no restart; a private theme is visible to its own business only;
 * an archived theme keeps working for the business that uses it and is not offered to anyone else; a marketplace theme that fails while drawing makes the build fall back to the previous or the default
 * theme and never fail. Real packages, the real kit, the real build and publish services over the in-memory repository.
 */
jest.setTimeout(300_000);
const staff = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const KEY = 'tm1-test-hospitality';
const file = (buffer: Buffer) => ({ buffer, size: buffer.length });
const code = (e: unknown): string => String(((e as { getResponse?: () => { code?: string } }).getResponse?.() ?? {}).code);

/** a kit whose renderer can be told to fail for one theme: the marketplace theme "broken" */
function makeKit(state: { breakTheme: string | null }): Kit {
  const real = loadKit();
  return { ...real, renderPage: (input: RenderInput) => { if (state.breakTheme && input.theme?.manifest.id === state.breakTheme) throw new TypeError('template exploded'); return real.renderPage(input); } } as Kit;
}

function world() {
  const state = { breakTheme: null as string | null };
  const store = new MemoryThemeMarketStore(); const notifier = new ThemeChangeNotifier();
  store.vendors.set('vendor-aaaa', { name: 'Acme', email: null, phone: null, subdomain: 'acme', customDomain: null, mediaHashes: [] });
  const kit = makeKit(state);
  const market = new ThemeMarketService(store, notifier, kit);
  const themes = new ThemeRenderService(kit, store, notifier);
  return { state, store, notifier, market, themes, publishNow: async (zip: Buffer, vendorId: string | null = null) => { const t = (await market.upload(staff, file(zip), { vendorId })).theme; await market.submit(t.id, staff); return market.publish(t.id, staff); } };
}

describe('theme runtime: published marketplace themes are served with no restart', () => {
  it('a theme appears in the list and renders the moment it is published, and is gone from the list when archived', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      expect(w.themes.listThemes().map((t) => t.id)).not.toContain(KEY); expect(() => w.themes.getTheme(KEY)).toThrow(HttpException);
      const pub = await w.publishNow(goodZip());   // the notifier makes the renderer re-read at once (no timer, no restart)
      const listed = w.themes.listThemes().find((t) => t.id === KEY)!;
      expect(listed).toMatchObject({ source: 'MARKETPLACE', visibility: 'PUBLIC', version: 1, tier: 'Standard' });
      const content = w.themes.kitApi.sampleContent('restaurant-cafe');
      const r = w.themes.render(KEY, { page: 'home', content, vendor: { id: 'x' }, host: { siteUrl: 'https://x.example.test' }, entitlements: { callsToAction: true } });
      expect(typeof r.html).toBe('string'); expect(r.html.length).toBeGreaterThan(500);
      expect(w.themes.isMarketplace(KEY)).toBe(true);
      await w.market.archive(pub.id, staff);
      expect(w.themes.listThemes().map((t) => t.id)).not.toContain(KEY);
    } finally { w.themes.onModuleDestroy(); }
  });

  it('the library default of a category is never a marketplace theme (Free keeps the default)', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      await w.publishNow(goodZip());
      for (const c of ['restaurant-cafe', 'hotel-homestay', 'real-estate-agent', 'travel-agency', 'doctor-clinic', 'plumber']) expect(w.themes.defaultThemeFor(c)).not.toBe(KEY);
      expect(w.themes.defaultThemeFor('restaurant-cafe')).toBe('free-hospitality');
    } finally { w.themes.onModuleDestroy(); }
  });

  it('a library key can never be taken over by a marketplace row, and a tampered stored package is skipped (the business falls back, no error)', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      const pub = await w.publishNow(goodZip());
      expect(w.themes.listThemes().some((t) => t.id === KEY)).toBe(true);
      w.store.rows.find((r) => r.id === pub.id)!.bytes = Buffer.from('not a zip any more');
      await w.themes.refreshDynamic();
      expect(w.themes.listThemes().some((t) => t.id === KEY)).toBe(false); expect(() => w.themes.getTheme(KEY)).toThrow(HttpException);
      expect(w.themes.listThemes().map((t) => t.id)).toEqual(expect.arrayContaining(['free-hospitality', 'free-practice']));   // the library is untouched
    } finally { w.themes.onModuleDestroy(); }
  });

  it('when the database cannot be read the previous set stays: a theme that was working keeps working', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      await w.publishNow(goodZip());
      w.store.loadServable = async () => { throw new Error('db down'); };
      await w.themes.refreshDynamic();
      expect(w.themes.listThemes().some((t) => t.id === KEY)).toBe(true);
    } finally { w.themes.onModuleDestroy(); }
  });

  it('a newer published version replaces the older one under the same key; the cache is read again after its time to live', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      await w.publishNow(goodZip({ version: 1 }));
      const h1 = w.themes.getTheme(KEY).hash;
      let now = 1_000_000; w.themes.clock = () => now; await w.themes.refreshDynamic(); expect(w.themes.dynamicStale).toBe(false);
      now += DYNAMIC_THEME_TTL_MS + 1; expect(w.themes.dynamicStale).toBe(true);
      await w.publishNow(goodZip({ version: 2, description: 'second version' }));
      expect(w.themes.getTheme(KEY)).toMatchObject({ version: 2, status: 'PUBLISHED' }); expect(w.themes.getTheme(KEY).hash).not.toBe(h1); expect(w.themes.listThemes().filter((t) => t.id === KEY)).toHaveLength(1);
    } finally { w.themes.onModuleDestroy(); }
  });
});

describe('theme runtime: private themes and archived themes', () => {
  const PRIVATE = { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'Made for one customer.', sourceVendorId: 'vendor-aaaa' };
  it('a private theme is listed for its own business only', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      await w.publishNow(goodZip({ marketplace: PRIVATE }, 'tm1-private'), 'vendor-aaaa');
      expect(w.themes.listThemes('vendor-aaaa').map((t) => t.id)).toContain('tm1-private');
      expect(w.themes.listThemes('vendor-bbbb').map((t) => t.id)).not.toContain('tm1-private');
      expect(w.themes.listThemes().map((t) => t.id)).not.toContain('tm1-private'); expect(w.themes.listThemes(null).map((t) => t.id)).not.toContain('tm1-private');
    } finally { w.themes.onModuleDestroy(); }
  });

  it('through the real settings service: the chooser offers a published public theme at once, never another business\'s private one, and refuses to pick either when not allowed', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      const sw = siteWorld({ kind: 'dentist', level: 'PRO', themes: w.themes });
      const before = await sw.settings.status('vendor-aaaa'); expect(before.allowedThemes).not.toContain(KEY);
      await w.publishNow(goodZip());
      await w.publishNow(goodZip({ marketplace: PRIVATE }, 'tm1-private'), 'vendor-aaaa');
      expect((await sw.settings.status('vendor-aaaa')).allowedThemes).toEqual(expect.arrayContaining([KEY, 'tm1-private']));
      expect((await sw.settings.status('vendor-bbbb')).allowedThemes).toContain(KEY); expect((await sw.settings.status('vendor-bbbb')).allowedThemes).not.toContain('tm1-private');
      await expect(sw.settings.setTheme('vendor-bbbb', 'tm1-private', OWNER)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'THEME_INVALID' }) });
      await expect(sw.settings.setTheme('vendor-bbbb', KEY, OWNER)).resolves.toMatchObject({ themeId: KEY });
    } finally { w.themes.onModuleDestroy(); }
  });

  it('an archived theme keeps drawing for the business already on it, is not offered to others, and cannot be newly chosen', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      const sw = siteWorld({ kind: 'dentist', level: 'PRO', themes: w.themes });
      const pub = await w.publishNow(goodZip());
      await sw.settings.setTheme('vendor-aaaa', KEY, OWNER);
      const built = await sw.build.build('vendor-aaaa', { actor: STAFF }); expect(built.publication.themeId).toBe(KEY);
      await w.market.archive(pub.id, staff);
      // the business that uses it: still resolves to the archived theme and still builds with it
      expect((await sw.settings.status('vendor-aaaa')).themeId).toBe(KEY);
      await sw.repo.upsertSettings('vendor-aaaa', { language: 'en' });
      const again = await sw.build.build('vendor-aaaa', { actor: STAFF }); expect(again.publication.themeId).toBe(KEY); expect(again.publication.warningsJson).not.toContain('theme-fallback');
      // everyone else: not offered, and not choosable
      expect((await sw.settings.status('vendor-bbbb')).allowedThemes).not.toContain(KEY);
      await expect(sw.settings.setTheme('vendor-bbbb', KEY, OWNER)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'THEME_INVALID' }) });
      // until it switches: after choosing another theme the archived one is gone for this business too
      await sw.settings.setTheme('vendor-aaaa', 'free-practice', OWNER);
      expect((await sw.build.build('vendor-aaaa', { actor: STAFF })).publication.themeId).toBe('free-practice');
    } finally { w.themes.onModuleDestroy(); }
  });
});

describe('theme runtime: a theme that fails at render time falls back, never an error page', () => {
  it('render raises ThemeRenderError for a marketplace theme and the raw error for a library theme', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      await w.publishNow(goodZip()); w.state.breakTheme = KEY;
      const input = { page: 'home', content: w.themes.kitApi.sampleContent('restaurant-cafe'), vendor: { id: 'x' }, host: { siteUrl: 'https://x.example.test' }, entitlements: { callsToAction: true } };
      expect(() => w.themes.render(KEY, input)).toThrow(ThemeRenderError);
      w.state.breakTheme = 'free-practice'; expect(() => w.themes.render('free-practice', input)).toThrow(TypeError);
    } finally { w.themes.onModuleDestroy(); }
  });

  it('the build uses the business\'s previous theme when the new one fails, with a note, and a publish of that build works', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      const sw = siteWorld({ kind: 'dentist', level: 'PRO', themes: w.themes });
      await w.publishNow(goodZip());
      const first = await sw.build.build('vendor-aaaa', { actor: STAFF }); expect(first.publication.themeId).toBe('free-practice');   // the library default of a dentist
      await sw.settings.setTheme('vendor-aaaa', KEY, OWNER);
      w.state.breakTheme = KEY;
      // nothing changed since the live build: the previous publication is reused as it is (nothing is drawn again, nothing can break)
      const same = await sw.build.build('vendor-aaaa', { actor: STAFF });
      expect([same.reused, same.publication.id, same.publication.themeId]).toEqual([true, first.publication.id, 'free-practice']);
      // content changed, so the site must be drawn again: the marketplace theme fails, the previous theme draws it, with a note
      sw.state.doc = doc('dentist', { cms: { tagline: 'A new tagline for the clinic.' } });
      const r = await sw.build.build('vendor-aaaa', { actor: STAFF });
      expect(r.reused).toBe(false); expect(r.publication.version).toBe(2); expect(r.publication.themeId).toBe('free-practice'); expect(r.publication.warningsJson).toContain('theme-render-fallback');
      expect((await sw.repo.pagesOf(r.publication.id)).some((p) => p.path === '/' && p.html.startsWith('<!doctype html>'))).toBe(true);
    } finally { w.themes.onModuleDestroy(); }
  });

  it('with no previous build the library default of the category is used; a theme that works is used normally', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      const sw = siteWorld({ kind: 'dentist', level: 'PRO', themes: w.themes });
      await w.publishNow(goodZip()); await sw.settings.setTheme('vendor-aaaa', KEY, OWNER);
      w.state.breakTheme = KEY;
      const broken = await sw.build.build('vendor-aaaa', { actor: STAFF }); expect(broken.publication.themeId).toBe('free-practice'); expect(broken.publication.warningsJson).toContain('theme-render-fallback');
      w.state.breakTheme = null;
      const ok = await sw.build.build('vendor-aaaa', { actor: STAFF }); expect(ok.publication.themeId).toBe(KEY); expect(ok.publication.warningsJson).not.toContain('theme-render-fallback');
    } finally { w.themes.onModuleDestroy(); }
  });

  it('a previous theme that is itself broken is skipped: the default is used (the loop always ends)', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      const sw = siteWorld({ kind: 'dentist', level: 'PRO', themes: w.themes });
      await w.publishNow(goodZip({}, 'tm1-test-one')); await w.publishNow(goodZip({}, 'tm1-test-two'));
      await sw.settings.setTheme('vendor-aaaa', 'tm1-test-one', OWNER); await sw.build.build('vendor-aaaa', { actor: STAFF });   // published with one
      await sw.settings.setTheme('vendor-aaaa', 'tm1-test-two', OWNER);
      w.state.breakTheme = 'tm1-test-two';
      sw.state.doc = doc('dentist', { cms: { tagline: 'Second tagline.' } });   // content changes, so every build below really draws the site
      const r1 = await sw.build.build('vendor-aaaa', { actor: STAFF }); expect(r1.publication.themeId).toBe('tm1-test-one'); expect(r1.publication.warningsJson).toContain('theme-render-fallback');   // previous theme still draws
      // now both fail (the kit helper breaks one id; break the other by making the previous one throw too)
      const kit2 = w.themes.kitApi; const orig = kit2.renderPage; (kit2 as { renderPage: Kit['renderPage'] }).renderPage = (i) => { if (['tm1-test-one', 'tm1-test-two'].includes(i.theme?.manifest.id ?? '')) throw new TypeError('both broken'); return orig(i); };
      sw.state.doc = doc('dentist', { cms: { tagline: 'Third tagline.' } });
      const r2 = await sw.build.build('vendor-aaaa', { actor: STAFF }); expect(r2.publication.themeId).toBe('free-practice'); expect(r2.publication.warningsJson).toContain('theme-render-fallback');
    } finally { w.themes.onModuleDestroy(); }
  });

  it('a bad package never reaches the renderer: the upload is refused and nothing is served', async () => {
    const w = world(); await w.themes.onModuleInit();
    try {
      await expect(w.market.upload(staff, file(scriptZip()))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'THEME_PACKAGE_INVALID' }) });
      expect(w.themes.listThemes().some((t) => t.id === KEY)).toBe(false);
      void code;
    } finally { w.themes.onModuleDestroy(); }
  });
});
