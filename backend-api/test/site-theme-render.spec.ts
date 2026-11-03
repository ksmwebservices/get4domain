import { BadRequestException } from '@nestjs/common';
import { Kit, loadKit } from '../src/site-publish/renderer/renderer-loader';
import { ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';

/**
 * S54.3: the backend uses the kit's renderer (built from themes/ at build time, never copied). The service validates every vendor theme with the kit's own
 * lint at start, refuses an invalid one, resolves the default theme of a category and returns the renderer's output unchanged. Real renderer, real library.
 */
jest.setTimeout(120_000);
const kit: Kit = loadKit();
const ENT_OFF = { video: false, cart: false, booking: false, customDomain: false };

describe('renderer loader', () => {
  it('exposes the kit functions the backend needs, built from the themes folder', () => {
    for (const fn of ['renderPage', 'loadTheme', 'lintTheme', 'listVendorThemeIds', 'computeContentHash', 'readThemeDir', 'categoryById', 'hasCategory', 'variantFor']) expect(typeof (kit as unknown as Record<string, unknown>)[fn]).toBe('function');
    expect(kit.CATEGORIES).toHaveLength(41);
  });
  it('knows the five Standard vendor themes and not the internal starter', () => {
    expect(kit.listVendorThemeIds()).toEqual(['free-hospitality', 'free-practice', 'free-service-pro', 'free-shop-lite', 'free-studio']);
  });
});

describe('ThemeRenderService', () => {
  const svc = new ThemeRenderService(kit);
  svc.init();

  it('validates every vendor theme with the kit lint at start and serves all five', () => {
    const themes = svc.listThemes();
    expect(themes.map((t) => t.id)).toEqual(['free-hospitality', 'free-practice', 'free-service-pro', 'free-shop-lite', 'free-studio']);
    for (const t of themes) { expect(t.tier).toBe('Standard'); expect(t.hash).toMatch(/^[0-9a-f]{64}$/); expect(t.categories.length).toBeGreaterThan(0); }
    expect(svc.invalidThemes()).toEqual({});
  });

  it('refuses to serve a theme that fails the kit lint (THEME_INVALID), and keeps serving the others', () => {
    const failing: Kit = { ...kit, lintTheme: (t, o) => (t.manifest.id === 'free-studio' ? { ok: false, findings: [{ rule: 'one-h1', message: 'broken on purpose' }] } : kit.lintTheme(t, o)) } as Kit;
    const s = new ThemeRenderService(failing); s.init();
    expect(Object.keys(s.invalidThemes())).toEqual(['free-studio']);
    expect(s.listThemes().map((t) => t.id)).not.toContain('free-studio');
    let err: unknown; try { s.getTheme('free-studio'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'THEME_INVALID' });
    expect(() => s.getTheme('free-practice')).not.toThrow();
  });

  it('an unknown theme id, and the internal starter, are THEME_INVALID', () => {
    for (const id of ['nope', '_starter', '../etc']) expect(() => svc.getTheme(id)).toThrow(BadRequestException);
  });

  it('every one of the 41 categories has exactly one default Standard theme, taken from the theme manifests', () => {
    for (const c of kit.CATEGORIES) {
      const owners = svc.listThemes().filter((t) => t.categories.includes(c.id));
      expect(owners).toHaveLength(1);
      expect(svc.defaultThemeFor(c.id)).toBe(owners[0].id);
    }
    expect(svc.defaultThemeFor('not-a-category')).toBeNull();
  });

  it('renders deterministically: the same inputs give byte-identical output', () => {
    const input = { page: 'home', content: kit.sampleContent('plumber'), settings: {}, vendor: { id: 'v1' }, host: { siteUrl: 'https://acme.get4domain.com' }, entitlements: ENT_OFF };
    const a = svc.render('free-service-pro', input); const b = svc.render('free-service-pro', input);
    expect(a.html).toBe(b.html);
    expect(JSON.stringify(a.seo)).toBe(JSON.stringify(b.seo));
    expect(a.html.length).toBeGreaterThan(5000);
    expect(a.lang).toBe('en-IN');
  });

  it('returns the renderer output unchanged: same as calling the kit directly', () => {
    const input = { page: 'about', content: kit.sampleContent('dentist', { lang: 'ta' }), settings: {}, vendor: { id: 'v1' }, host: { siteUrl: 'https://acme.get4domain.com' }, entitlements: ENT_OFF };
    const viaService = svc.render('free-practice', input);
    const direct = kit.renderPage({ theme: kit.loadTheme('free-practice'), ...input });
    expect(viaService.html).toBe(direct.html);
    expect(viaService.warnings).toEqual(direct.warnings);
    expect(viaService.lang).toBe('ta-IN');
  });

  it('caches by theme id and content hash: loading twice returns the same theme object', () => {
    expect(svc.getTheme('free-shop-lite').theme).toBe(svc.getTheme('free-shop-lite').theme);
  });
});

describe('contract: a Pro vendor may use any theme of their track, so every theme x every category of its tracks must render cleanly', () => {
  const svc = new ThemeRenderService(kit); svc.init();
  it('renders all pages for every (theme, category of the theme\'s tracks) pair with exactly one h1 and no blocking warning', () => {
    const blocking = /^missing-template|^unknown-category|^missing:host|^preset-ignored:invalid/;
    const problems: string[] = [];
    for (const t of svc.listThemes()) {
      const theme = svc.getTheme(t.id).theme;
      for (const c of kit.CATEGORIES.filter((x) => t.tracks.includes(x.track))) {
        for (const page of ['home', 'about', 'services', 'gallery', 'contact']) {
          const out = svc.render(t.id, { page, content: kit.sampleContent(c.id), settings: {}, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' }, entitlements: ENT_OFF });
          const h1 = (out.html.match(/<h1[\s>]/g) ?? []).length;
          if (h1 !== 1) problems.push(`${t.id}/${c.id}/${page}: ${h1} h1`);
          for (const w of out.warnings) if (blocking.test(w)) problems.push(`${t.id}/${c.id}/${page}: ${w}`);
        }
        void theme;
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });
});

describe('contract: every theme, every category it lists, through the kit lint', () => {
  const svc = new ThemeRenderService(kit); svc.init();
  it.each(['free-hospitality', 'free-practice', 'free-service-pro', 'free-shop-lite', 'free-studio'])('%s passes the kit lint on all its categories (rendered by the same renderer)', (id) => {
    const { theme } = svc.getTheme(id);
    const result = kit.lintTheme(theme, {});
    expect({ ok: result.ok, findings: result.findings.filter((f: { severity?: string }) => f.severity !== 'info').slice(0, 3) }).toEqual({ ok: true, findings: [] });
    expect(result.categories?.length ?? theme.manifest.categories.length).toBe(theme.manifest.categories.length);
  });
});
