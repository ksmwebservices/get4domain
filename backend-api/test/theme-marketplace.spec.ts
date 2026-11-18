import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { PrismaService } from '../src/prisma/prisma.service';
import { SiteSettingsService } from '../src/site-publish/publish/site-settings.service';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';
import { ThemeCatalogV3Service } from '../src/v3-theme-catalog/theme-catalog.service';
import { ThemeSwitchService } from '../src/v3-theme-switch/theme-switch.service';
import { AdminThemeMarketController } from '../src/v3-theme-market/api/theme-market.controllers';
import { MeThemeMarketController, PublicThemeMarketController } from '../src/v3-theme-market/api/theme-marketplace.controllers';
import { libraryMeta, matches } from '../src/v3-theme-market/core/theme-listing-core';
import { PACK_KEYS } from '../src/v3-theme-market/core/theme-package-core';
import { PREVIEW_HEADERS } from '../src/v3-theme-market/core/theme-preview-core';
import { ThemeChangeNotifier, ThemeMarketService } from '../src/v3-theme-market/theme-market.service';
import { ThemeMarketStore } from '../src/v3-theme-market/theme-market.store';
import { ThemeMarketplaceService } from '../src/v3-theme-market/theme-marketplace.service';
import { ThemePreviewService } from '../src/v3-theme-market/theme-preview.service';
import { packDemo } from '../src/v3-packs/pack-demo/pack-demo';
import { goodZip } from './support/theme-package-fixtures';
import { MemoryThemeMarketStore } from './support/memory-theme-market-store';
import { OWNER, siteWorld } from './support/site-world';

/**
 * TM1 M5, the marketplace API and the server-side preview, over HTTP with the real renderer, the real theme catalogue and the real site settings (plan gate), the in-memory theme table, and real packages.
 * Business "vendor-pro" is on a paid plan and "vendor-free" on Free; both are professional-track clinics.
 */
jest.setTimeout(480_000);
const staff = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const KEY = 'tm1-test-hospitality'; const PRIV = 'tm1-private-clinic';
const MK = { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], addons: ['ONLINE_ORDERING_DELIVERY'], capabilities: [] as string[], tags: ['restaurant-plus-delivery'], catalogueCategories: [] as string[], licence: 'Built by the team.', starter: true, sourceVendorId: null as string | null };

describe('theme marketplace API', () => {
  let app: INestApplication; let store: MemoryThemeMarketStore; let market: ThemeMarketService; let themes: ThemeRenderService; let ids: Record<string, string>;
  const as = (p: string) => ({ 'x-test-principal': p });
  const get = (url: string, p?: string) => { const r = request(app.getHttpServer()).get(url); return p ? r.set(as(p)) : r; };
  const publish = async (zip: Buffer, vendorId: string | null = null): Promise<string> => { const t = (await market.upload(staff, { buffer: zip }, { vendorId })).theme; await market.submit(t.id, staff); await market.publish(t.id, staff); return t.id; };

  beforeAll(async () => {
    const kit = loadKit(); store = new MemoryThemeMarketStore(); const notifier = new ThemeChangeNotifier();
    store.vendors.set('vendor-pro', { name: 'Pro Clinic', email: null, phone: null, subdomain: null, customDomain: null, mediaHashes: [] });
    store.vendors.set('vendor-free', { name: 'Free Clinic', email: null, phone: null, subdomain: null, customDomain: null, mediaHashes: [] });
    market = new ThemeMarketService(store, notifier, kit); themes = new ThemeRenderService(kit, store, notifier); await themes.onModuleInit();
    const pro = siteWorld({ kind: 'dentist', level: 'PRO', themes }); const free = siteWorld({ kind: 'dentist', level: 'FREE', themes });
    const settings = { status: (v: string) => (v === 'vendor-free' ? free : pro).settings.status(v), setTheme: (v: string, t: string) => (v === 'vendor-free' ? free : pro).settings.setTheme(v, t, OWNER) };
    ids = { pub: await publish(goodZip({ marketplace: MK }, KEY)), priv: await publish(goodZip({ marketplace: { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'One customer.', sourceVendorId: 'vendor-pro' } }, PRIV), 'vendor-pro') };
    const draft = (await market.upload(staff, { buffer: goodZip({ marketplace: { ...MK, tags: [], addons: [] } }, 'tm1-draft-only') })).theme; ids.draft = draft.id;
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [PublicThemeMarketController, MeThemeMarketController, AdminThemeMarketController],
      providers: [
        throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard },
        { provide: ThemeMarketStore, useValue: store }, { provide: ThemeChangeNotifier, useValue: notifier }, { provide: ThemeRenderService, useValue: themes }, ThemePreviewService, ThemeMarketplaceService,
        { provide: ThemeMarketService, useValue: market }, ThemeCatalogV3Service, { provide: SiteSettingsService, useValue: settings },
        { provide: ThemeSwitchService, useValue: { fee: async () => ({ priceStatus: 'PENDING', pricePaise: null, taxNote: 'Before GST' }) } },
        { provide: PrismaService, useValue: { v3PlanSubscription: { findFirst: async () => ({ plan: { track: 'PROFESSIONAL' } }) } } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner-pro') req.user = { sub: 'vendor-pro', email: 'p@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-free') req.user = { sub: 'vendor-free', email: 'f@x.invalid', role: 'VENDOR' };
      else if (p === 'member-pro') req.user = { sub: 'vendor-pro', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'm1', modules: ['website'] };
      else if (p === 'vendor-other') req.user = { sub: 'vendor-other', email: 'o@x.invalid', role: 'VENDOR' };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(async () => { themes.onModuleDestroy(); await app.close(); });

  describe('listing core', () => {
    it('every pack has at least one library theme designed for it (nothing is listed as designed for a pack by guess)', () => {
      const lib = ['free-hospitality', 'free-practice', 'free-service-pro', 'free-shop-lite', 'free-studio'].map((id) => libraryMeta(themes.getTheme(id).manifest));
      for (const p of PACK_KEYS) expect(lib.some((t) => t.packs.includes(p))).toBe(true);
      const practice = lib.find((t) => t.key === 'free-practice')!; expect(practice.packs).toEqual(expect.arrayContaining(['CLINIC', 'LAB'])); expect(practice.addons).toEqual([]); expect(practice.tags).toEqual([]);
    });
    it('filters combine, and a library theme matches a catalogue category through its pack', () => {
      const lib = libraryMeta(themes.getTheme('free-practice').manifest);
      expect(matches(lib, { pack: 'CLINIC', tier: 'Standard' })).toBe(true); expect(matches(lib, { pack: 'CLINIC', tier: 'Premium' })).toBe(false); expect(matches(lib, { addon: 'SHOP' })).toBe(false);
      expect(matches(lib, { category: 'dentist' })).toBe(true); expect(matches(lib, { q: 'practice' })).toBe(true); expect(matches(lib, { q: 'nothing like this' })).toBe(false);
    });
  });

  describe('public list and detail', () => {
    it('lists the library and the published public themes by name; a private theme and a draft are not there', async () => {
      const r = await get('/v3/public/theme-market/themes?pageSize=100'); expect(r.status).toBe(200);
      const keys = (r.body.data.items as Array<{ id: string; name: string }>).map((i) => i.id);
      expect(keys).toEqual(expect.arrayContaining(['free-practice', 'free-hospitality', KEY])); expect(keys).not.toContain(PRIV); expect(keys).not.toContain('tm1-draft-only');
      const names = (r.body.data.items as Array<{ name: string }>).map((i) => i.name); expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });
    it('filters by pack, add-on, combination tag, tier and category; a value that is not real is 400', async () => {
      const ids = async (q: string) => ((await get(`/v3/public/theme-market/themes?${q}&pageSize=100`)).body.data.items as Array<{ id: string }>).map((i) => i.id);
      expect(await ids('addon=ONLINE_ORDERING_DELIVERY')).toEqual([KEY]); expect(await ids('tag=restaurant-plus-delivery')).toEqual([KEY]);
      expect(await ids('pack=FOOD_SERVICE')).toEqual(expect.arrayContaining([KEY, 'free-hospitality'])); expect(await ids('pack=CLINIC')).toContain('free-practice'); expect(await ids('pack=CLINIC')).not.toContain(KEY);
      expect(await ids('tier=Premium')).toEqual([]); expect(await ids('starter=true')).toEqual([KEY]);
      expect(await ids('category=dentist')).toContain('free-practice');
      for (const q of ['pack=NOPE', 'addon=NOPE', 'tag=nope', 'tier=Gold', 'category=not-a-category', 'capability=NOPE', 'starter=maybe']) { const b = await get(`/v3/public/theme-market/themes?${q}`); expect([b.status, b.body.code]).toEqual([400, 'THEME_FILTER_INVALID']); }
    });
    it('an item says only what the theme is for: no vendor, no price, no count, no rating, no ranking, no source business', async () => {
      const r = await get(`/v3/public/theme-market/themes/${KEY}`); expect(r.status).toBe(200);
      const d = r.body.data; expect(Object.keys(d).sort()).toEqual(['addons', 'capabilities', 'catalogueCategories', 'description', 'id', 'name', 'packs', 'pages', 'preview', 'previews', 'premium', 'source', 'starter', 'tags', 'tier', 'tracks', 'version'].sort());
      expect(d).toMatchObject({ source: 'MARKETPLACE', starter: true, tags: ['restaurant-plus-delivery'], addons: ['ONLINE_ORDERING_DELIVERY'] }); expect(d.pages).toContain('home'); expect(d.previews.map((p: { pack: string }) => p.pack)).toEqual(MK.packs);
      expect(JSON.stringify(r.body)).not.toMatch(/sourceVendorId|vendor-pro|price|paise|rating|popular|downloads|installs|count|rank/i);
    });
    it('a theme that is private, a draft, or unknown is a plain 404 THEME_NOT_AVAILABLE', async () => {
      for (const k of [PRIV, 'tm1-draft-only', 'nope-nope']) { const r = await get(`/v3/public/theme-market/themes/${k}`); expect([r.status, r.body.code]).toEqual([404, 'THEME_NOT_AVAILABLE']); }
    });
  });

  describe('a business\'s own view (owner only)', () => {
    it('a paid business may apply a marketplace theme of its track; its own private theme is listed for it and for nobody else', async () => {
      const r = await get('/v3/me/theme-market/themes?pageSize=100', 'owner-pro'); expect(r.status).toBe(200);
      const byId = new Map((r.body.data.items as Array<{ id: string; allowed: boolean; reason: string | null; selected: boolean }>).map((i) => [i.id, i]));
      expect(byId.get(KEY)).toMatchObject({ allowed: true, reason: null }); expect(byId.get(PRIV)).toMatchObject({ allowed: true }); expect(byId.get('free-practice')!.selected).toBe(true);   // the dentist's default
      expect(r.body.data.fee).toEqual({ priceStatus: 'PENDING', pricePaise: null, taxNote: 'Before GST', purchasable: false });
      const other = await get('/v3/me/theme-market/themes?pageSize=100', 'vendor-other'); expect((other.body.data.items as Array<{ id: string }>).map((i) => i.id)).not.toContain(PRIV);
    });
    it('the plan gate: a Free business sees the marketplace locked (PLAN_REQUIRED) and is refused by the switch', async () => {
      const r = await get('/v3/me/theme-market/themes?pageSize=100', 'owner-free');
      const byId = new Map((r.body.data.items as Array<{ id: string; allowed: boolean; reason: string | null }>).map((i) => [i.id, i]));
      expect(byId.get(KEY)).toMatchObject({ allowed: false, reason: 'PLAN_REQUIRED' }); expect(byId.get('free-practice')).toMatchObject({ allowed: true }); expect(r.body.data.library).toBe(false);
      const pro = siteWorld({ kind: 'dentist', level: 'PRO', themes }); const free = siteWorld({ kind: 'dentist', level: 'FREE', themes });
      await expect(free.settings.setTheme('vendor-free', KEY, OWNER)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'FEATURE_LOCKED' }) });
      await expect(pro.settings.setTheme('vendor-pro', KEY, OWNER)).resolves.toMatchObject({ themeId: KEY });
    });
    it('filters work for the business too, and a team member is refused (the list shows the switch fee)', async () => {
      const r = await get('/v3/me/theme-market/themes?tag=restaurant-plus-delivery', 'owner-pro'); expect((r.body.data.items as Array<{ id: string }>).map((i) => i.id)).toEqual([KEY]);
      expect((await get('/v3/me/theme-market/themes', 'member-pro')).status).toBe(403); expect((await get('/v3/me/theme-market/themes')).status).toBe(401);
      expect((await get('/v3/me/theme-market/themes?pack=NOPE', 'owner-pro')).body.code).toBe('THEME_FILTER_INVALID');
    });
    it('detail: allowed state, fee, pages and a preview path per pack; another business\'s private theme is 404', async () => {
      const d = await get(`/v3/me/theme-market/themes/${KEY}`, 'owner-pro'); expect(d.status).toBe(200);
      expect(d.body.data).toMatchObject({ id: KEY, allowed: true, fee: { priceStatus: 'PENDING' } }); expect(d.body.data.pages).toContain('home'); expect(d.body.data.previews[0].path).toContain(`/v3/me/theme-market/themes/${KEY}/preview?pack=`);
      expect((await get(`/v3/me/theme-market/themes/${PRIV}`, 'owner-pro')).status).toBe(200);
      const hidden = await get(`/v3/me/theme-market/themes/${PRIV}`, 'vendor-other'); expect([hidden.status, hidden.body.code]).toEqual([404, 'THEME_NOT_AVAILABLE']);
    });
  });

  describe('server-side preview', () => {
    const sandboxed = (res: request.Response): void => {
      for (const [k, v] of Object.entries(PREVIEW_HEADERS)) if (k !== 'Content-Type') expect(res.headers[k.toLowerCase()]).toBe(v);
      expect(res.headers['content-type']).toContain('text/html'); expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/); expect(res.headers['content-security-policy']).toMatch(/\bsandbox\b/); expect(res.headers['content-security-policy']).not.toMatch(/script-src|unsafe-eval/);
    };
    it('public: draws the theme with the pack\'s sample business, with strict headers, no cookie, no script and no price', async () => {
      const r = await get(`/v3/public/theme-market/themes/${KEY}/preview?pack=FOOD_SERVICE`); expect(r.status).toBe(200); sandboxed(r);
      expect(r.text.startsWith('<!doctype html>')).toBe(true); expect(r.text).toContain(packDemo('FOOD_SERVICE')!.business.name); expect(r.text).not.toMatch(/<script/i); expect(r.text).not.toContain('₹'); expect(r.text).toContain('noindex');
      const lib = await get('/v3/public/theme-market/themes/free-practice/preview?pack=CLINIC&page=services'); expect(lib.status).toBe(200); expect(lib.text).toContain(packDemo('CLINIC')!.business.name);
    });
    it('the default pack is the theme\'s first; an unknown pack, page or theme is 404 THEME_NOT_AVAILABLE and nothing is drawn', async () => {
      expect((await get(`/v3/public/theme-market/themes/${KEY}/preview`)).status).toBe(200);
      for (const u of [`/v3/public/theme-market/themes/${KEY}/preview?pack=NOPE`, `/v3/public/theme-market/themes/${KEY}/preview?page=nope`, `/v3/public/theme-market/themes/${KEY}/preview?page=..%2Fx`, '/v3/public/theme-market/themes/nope-nope/preview', `/v3/public/theme-market/themes/${PRIV}/preview`, '/v3/public/theme-market/themes/tm1-draft-only/preview']) {
        const r = await get(u); expect([r.status, r.body.code]).toEqual([404, 'THEME_NOT_AVAILABLE']);
      }
    });
    it('a business previews a theme it may see (its own private one too) and not another business\'s', async () => {
      const ok = await get(`/v3/me/theme-market/themes/${PRIV}/preview?pack=HOSPITALITY_EVENTS`, 'owner-pro'); expect(ok.status).toBe(200); sandboxed(ok);
      expect((await get(`/v3/me/theme-market/themes/${PRIV}/preview`, 'vendor-other')).status).toBe(404); expect((await get(`/v3/me/theme-market/themes/${KEY}/preview`, 'member-pro')).status).toBe(403);
    });
    it('admin: any stored version, a draft included, for OPERATIONS and up; SALES, SUPPORT, a vendor and the signed-out are refused', async () => {
      const ok = await get(`/v3/admin/theme-market/themes/${ids.draft}/preview`, 'OPERATIONS'); expect(ok.status).toBe(200); sandboxed(ok); expect(ok.text).toContain(packDemo('HOSPITALITY_EVENTS')!.business.name);   // no pack given: the theme's first pack
      const food = await get(`/v3/admin/theme-market/themes/${ids.draft}/preview?pack=FOOD_SERVICE&page=about`, 'ADMIN'); expect(food.status).toBe(200); expect(food.text).toContain(packDemo('FOOD_SERVICE')!.business.name);
      for (const who of ['MARKETING', 'SUPPORT', 'owner-pro']) expect((await get(`/v3/admin/theme-market/themes/${ids.draft}/preview`, who)).status).toBe(403);
      expect((await get(`/v3/admin/theme-market/themes/${ids.draft}/preview`)).status).toBe(403);
      expect((await get('/v3/admin/theme-market/themes/theme-id-9999/preview', 'ADMIN')).status).toBe(404);
    });
    it('a package that was fine at upload but no longer validates cannot be previewed (422), and a theme that throws is 422 THEME_PREVIEW_FAILED, never a stack trace', async () => {
      const row = store.rows.find((r) => r.id === ids.draft)!; const keep = row.bytes; row.bytes = Buffer.from('not a zip any more');
      try { const r = await get(`/v3/admin/theme-market/themes/${ids.draft}/preview`, 'ADMIN'); expect([r.status, r.body.code]).toEqual([422, 'THEME_PREVIEW_FAILED']); expect(JSON.stringify(r.body)).not.toMatch(/at \w+|stack/i); } finally { row.bytes = keep; }
    });
  });
});
