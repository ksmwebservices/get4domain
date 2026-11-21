import 'reflect-metadata';
import { resolveTheme } from '../src/site-publish/content/theme-resolution';
import { SiteSettingsService } from '../src/site-publish/publish/site-settings.service';
import { ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';
import { ThemeSwitchService } from '../src/v3-theme-switch/theme-switch.service';
import { MeThemesController, PublicThemesController } from '../src/v3-theme-catalog/api/theme-catalog.controllers';
import { accessOf, applyState, feeLine, themesForPack, ThemeLite } from '../src/v3-theme-catalog/core/theme-catalog-core';
import { ThemeCatalogV3Service } from '../src/v3-theme-catalog/theme-catalog.service';

/** Wave 3 Part H: the theme catalogue per pack, the owner's choice view, and the rules (paid themes only on paid plans; a PENDING fee is no number). */
const T = (id: string, name: string, tracks: string[], categories: string[], tier = 'standard'): ThemeLite => ({ id, name, tier, tracks, categories });
const THEMES: ThemeLite[] = [
  T('clinic-calm', 'Clinic Calm', ['professional'], ['clinic', 'dentist']),
  T('pro-bold', 'Pro Bold', ['professional', 'ecommerce'], ['lawyer'], 'premium'),
  T('shop-fresh', 'Shop Fresh', ['ecommerce'], ['retail-shop']),
  T('fixit', 'Fix It', ['handyman'], ['plumber']),
  T('alpha', 'Alpha', ['professional'], ['clinic']),
];
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

describe('themesForPack (pure)', () => {
  it('lists the themes designed for a category of the pack, sorted by name then id', () => {
    const r = themesForPack(THEMES, ['clinic', 'dentist'], ['professional']);
    expect(r.matchedBy).toBe('CATEGORY'); expect(r.themes.map((t) => t.id)).toEqual(['alpha', 'clinic-calm']);
    expect(themesForPack([...THEMES].reverse(), ['clinic', 'dentist'], ['professional']).themes.map((t) => t.id)).toEqual(['alpha', 'clinic-calm']);   // the same answer whatever the input order
  });
  it('falls back to the tracks the pack needs when the theme kit names none of its categories', () => {
    const r = themesForPack(THEMES, ['hardware-store'], ['ECOMMERCE']);
    expect(r.matchedBy).toBe('TRACK'); expect(r.themes.map((t) => t.id)).toEqual(['pro-bold', 'shop-fresh']);
  });
  it('answers NONE with an empty list, never an error, when nothing fits', () => {
    expect(themesForPack(THEMES, ['x'], ['unknown-track'])).toEqual({ matchedBy: 'NONE', themes: [] });
    expect(themesForPack([], ['clinic'], ['professional'])).toEqual({ matchedBy: 'NONE', themes: [] });
  });
  it('marks the Standard theme of a category DEFAULT (every plan) and the others LIBRARY (paid plans)', () => {
    const defaults = new Set(['clinic-calm']);
    expect(accessOf('clinic-calm', defaults)).toBe('DEFAULT'); expect(accessOf('alpha', defaults)).toBe('LIBRARY');
  });
});

describe('applyState (pure)', () => {
  const free = { allowedIds: new Set(['clinic-calm']), track: 'professional', onLibrary: false };
  const paid = { allowedIds: new Set(['clinic-calm', 'alpha', 'pro-bold']), track: 'professional', onLibrary: true };
  it('a business may apply what the site status says it may', () => {
    expect(applyState(THEMES[0], free)).toEqual({ allowed: true, reason: null });
    expect(applyState(THEMES[4], paid)).toEqual({ allowed: true, reason: null });
  });
  it('on a Free plan a library theme made for its business needs a paid plan', () => {
    expect(applyState(THEMES[4], free)).toEqual({ allowed: false, reason: 'PLAN_REQUIRED' });
  });
  it('a theme designed for another kind of business is not for this business, on any plan', () => {
    expect(applyState(THEMES[2], free)).toEqual({ allowed: false, reason: 'NOT_FOR_YOUR_BUSINESS' });
    expect(applyState(THEMES[2], paid)).toEqual({ allowed: false, reason: 'NOT_FOR_YOUR_BUSINESS' });
    expect(applyState(THEMES[4], { allowedIds: new Set(), track: null, onLibrary: false })).toEqual({ allowed: false, reason: 'NOT_FOR_YOUR_BUSINESS' });
  });
});

describe('feeLine: a PENDING fee is never a number', () => {
  it('shows the approved fee before GST', () => { expect(feeLine({ pricePaise: 49900, priceStatus: 'SET', taxNote: 'Before GST' })).toEqual({ priceStatus: 'SET', pricePaise: 49900, taxNote: 'Before GST', purchasable: true }); });
  it('shows PENDING with no number, and not purchasable, for a missing, zero, negative, fractional or contradictory price', () => {
    for (const f of [{ pricePaise: null, priceStatus: 'PENDING' }, { pricePaise: 0, priceStatus: 'SET' }, { pricePaise: -5, priceStatus: 'SET' }, { pricePaise: 12.5, priceStatus: 'SET' }, { pricePaise: 100, priceStatus: 'PENDING' }, { pricePaise: null, priceStatus: 'SET' }] as const) {
      expect(feeLine({ ...f, taxNote: 'Before GST' })).toEqual({ priceStatus: 'PENDING', pricePaise: null, taxNote: 'Before GST', purchasable: false });
    }
  });
});

describe('paid themes only on paid plans (the existing resolver, proved here)', () => {
  const base = { categoryId: 'clinic', track: 'professional', themes: THEMES.map((t) => ({ ...t, hash: 'h' })), defaultId: 'clinic-calm', strict: true };
  it('a Free plan is refused any theme that is not the default (FEATURE_LOCKED); a paid plan with the library may apply it', () => {
    expect(() => resolveTheme({ ...base, requested: 'alpha', entitlement: { state: 'ACTIVE', enumValue: 'default', upsellText: null } as never })).toThrow();
    expect(() => resolveTheme({ ...base, requested: 'alpha', entitlement: null })).toThrow();
    expect(resolveTheme({ ...base, requested: 'alpha', entitlement: { state: 'ACTIVE', enumValue: 'library', upsellText: null } as never }).themeId).toBe('alpha');
    expect(resolveTheme({ ...base, requested: 'clinic-calm', entitlement: null }).themeId).toBe('clinic-calm');   // the default is on every plan
  });
  it('a theme designed for another track is refused even with the library', () => {
    expect(() => resolveTheme({ ...base, requested: 'shop-fresh', entitlement: { state: 'ACTIVE', enumValue: 'library', upsellText: null } as never })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────── the service, with the other services found through a fake ModuleRef
function make(opts: { plan?: 'free' | 'paid'; fee?: { pricePaise: number | null; priceStatus: 'SET' | 'PENDING' }; packs?: Array<{ key: string; name: string; enabled: boolean }>; cats?: Array<{ packKey: string; categoryKey: string; minTier: string; active: boolean }> } = {}) {
  const packs = opts.packs ?? [{ key: 'CLINIC', name: 'Clinics', enabled: true }, { key: 'OFF', name: 'Off', enabled: false }];
  const cats = opts.cats ?? [{ packKey: 'CLINIC', categoryKey: 'clinic', minTier: 'PROFESSIONAL', active: true }, { packKey: 'CLINIC', categoryKey: 'dentist', minTier: 'PROFESSIONAL', active: true }, { packKey: 'CLINIC', categoryKey: 'old', minTier: 'PROFESSIONAL', active: false }];
  const prisma = {
    v3Pack: { findUnique: async ({ where }: { where: { key: string } }) => packs.find((p) => p.key === where.key) ?? null },
    v3PackCategory: { findMany: async ({ where }: { where: { packKey: string; active: boolean } }) => cats.filter((c) => c.packKey === where.packKey && c.active === where.active) },
    v3PlanSubscription: { findFirst: async () => ({ plan: { track: 'PROFESSIONAL' } }) },
  };
  const render = { listThemes: () => THEMES.map((t) => ({ ...t, hash: 'h' })), defaultThemeFor: (c: string) => (c === 'clinic' ? 'clinic-calm' : c === 'lawyer' ? 'pro-bold' : null) };
  const paid = opts.plan === 'paid';
  const site = { status: async () => ({ themeId: 'clinic-calm', allowedThemes: paid ? ['clinic-calm', 'alpha', 'pro-bold'] : ['clinic-calm'] }) };
  const fee = { fee: async () => ({ ...(opts.fee ?? { pricePaise: null, priceStatus: 'PENDING' }), taxNote: 'Before GST' as const }) };
  const ref = { get: (t: unknown) => (t === ThemeRenderService ? render : t === SiteSettingsService ? site : t === ThemeSwitchService ? fee : (() => { throw new Error('unknown token'); })()) };
  return new ThemeCatalogV3Service(prisma as never, ref as never);
}

describe('ThemeCatalogV3Service.forPack', () => {
  it('lists the themes of the pack with their access, and only the pack\'s own categories', async () => {
    const r = await make().forPack('CLINIC');
    expect(r.pack).toEqual({ key: 'CLINIC', name: 'Clinics' }); expect(r.matchedBy).toBe('CATEGORY');
    expect(r.items.map((i) => [i.id, i.access])).toEqual([['alpha', 'LIBRARY'], ['clinic-calm', 'DEFAULT']]);
    expect(r.items.find((i) => i.id === 'alpha')!.categories).toEqual(['clinic']);
  });
  it('shows no price, no vendor and no personal data (it is public)', async () => {
    const text = JSON.stringify(await make().forPack('CLINIC'));
    expect(text).not.toMatch(/price|paise|fee|vendor|email|phone|discount|offer|coupon|workspace|\bbos\b|leadspace/i);
  });
  it('an unknown, disabled or malformed pack key is THEME_PACK_NOT_FOUND (404), the same answer for all', async () => {
    for (const k of ['NOPE', 'OFF', '', 'bad key', 'x'.repeat(80), undefined as unknown as string]) { const e = await err(make().forPack(k)); expect([k, code(e), (e as { getStatus: () => number }).getStatus()]).toEqual([k, 'THEME_PACK_NOT_FOUND', 404]); }
  });
});

describe('ThemeCatalogV3Service.forVendor', () => {
  it('on a Free plan the default may be applied, the library needs a paid plan, and a PENDING fee is no number', async () => {
    const v = await make({ plan: 'free' }).forVendor('v1');
    expect(v.selectedThemeId).toBe('clinic-calm'); expect(v.library).toBe(false);
    expect(v.fee).toEqual({ priceStatus: 'PENDING', pricePaise: null, taxNote: 'Before GST', purchasable: false });
    const by = Object.fromEntries(v.items.map((i) => [i.id, i]));
    expect(by['clinic-calm']).toMatchObject({ allowed: true, reason: null, selected: true, access: 'DEFAULT' });
    expect(by['alpha']).toMatchObject({ allowed: false, reason: 'PLAN_REQUIRED', access: 'LIBRARY' });
    expect(by['shop-fresh']).toBeUndefined();   // a theme for another track is not offered at all
  });
  it('on a paid plan the library may be applied and the approved fee is shown before GST', async () => {
    const v = await make({ plan: 'paid', fee: { pricePaise: 49900, priceStatus: 'SET' } }).forVendor('v1');
    expect(v.library).toBe(true); expect(v.fee).toMatchObject({ priceStatus: 'SET', pricePaise: 49900, purchasable: true });
    expect(v.items.filter((i) => i.allowed).map((i) => i.id).sort()).toEqual(['alpha', 'clinic-calm', 'pro-bold']);
    expect(v.items.every((i) => i.reason === null || ['PLAN_REQUIRED', 'NOT_FOR_YOUR_BUSINESS'].includes(i.reason))).toBe(true);
  });
  it('is sorted and never changes the data it reads', async () => {
    const v = await make({ plan: 'paid' }).forVendor('v1');
    expect(v.items.map((i) => i.name)).toEqual([...v.items.map((i) => i.name)].sort((a, b) => a.localeCompare(b)));
  });
});

describe('the routes', () => {
  it('the public list is cacheable and passes the pack through', async () => {
    const headers: Record<string, string> = {};
    const out = await new PublicThemesController(make()).list({ pack: 'CLINIC' }, { set: (k: string, v: string) => { headers[k] = v; } } as never);
    expect(headers['Cache-Control']).toBe('public, max-age=300'); expect(out.items.length).toBe(2);
    expect(code(await err(new PublicThemesController(make()).list({}, { set: () => undefined } as never)))).toBe('THEME_PACK_NOT_FOUND');
  });
  it('the owner view reads the signed-in vendor only', async () => {
    const seen: string[] = [];
    const svc = { forVendor: async (id: string) => { seen.push(id); return { ok: true }; } } as never;
    await new MeThemesController(svc).view({ vendorId: 'v7' } as never);
    expect(seen).toEqual(['v7']);
  });
});
