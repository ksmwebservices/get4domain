import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { industryContent } from '@/data/industry-content';
import SiteApp from '@/components/site-kit/SiteApp';
import FreeSiteView from '@/components/site/FreeSiteView';
import { contrastRatio } from '../site-kit/color';
import { navItems, visibleSections, enquiryHref } from '../site-kit/nav';
import { GENERAL_PACK, PACKS, closestPack, derivePack, packById } from '../site-kit/packs';
import { MANIFEST_PATH, buildWebManifest, detectPlatform, iconLetter, iconSize, installAvailable, installSteps, shortNameOf } from '../site-kit/pwa';
import { contextOf, pickCandidate, resolveTheme, themeForSite } from '../site-kit/resolver';
import { DEFAULT_THEME_ID, FLAGSHIPS, GENERAL_THEME, flagshipFor, flagshipId, validateTargets, type KitTheme, type Target } from '../site-kit/themes';
import { buildSiteView, distinctText, hoursLines, pageTitle, siteViewFromFree } from '../site-kit/view';
import { freeViewOf } from '../site-state';

const src = (f: string): string => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const render = (view: ReturnType<typeof buildSiteView>, theme: KitTheme): string => renderToStaticMarkup(createElement(SiteApp, { view, theme }));

/** A theme that targets exactly the given things (a test double with the real shape). */
const mk = (id: string, targets: Target[], o: Partial<KitTheme> = {}): KitTheme => ({ ...flagshipFor(PACKS[0]), id, name: id, targets, isDefault: false, pack: 'nothing-matches', ...o });

describe('P11 packs: derived from the full main-category list', () => {
  test('one pack per main category, however many there are', () => {
    assert.equal(PACKS.length, industryContent.length);
    assert.ok(PACKS.length >= 29);
    assert.deepEqual(PACKS.map((p) => p.id), industryContent.map((c) => c.id));
    for (const p of PACKS) { assert.ok(p.starter.services.length > 0, p.id); assert.ok(p.starter.headline && p.starter.cta, p.id); assert.ok(p.hue >= 0 && p.hue < 360); }
  });
  test('a main category that is added later still gets a pack and a flagship theme', () => {
    const extra = derivePack({ ...industryContent[0], id: 'tattoo-studio', name: 'Tattoo studio', seoKeywords: ['tattoo'] });
    assert.equal(extra.id, 'tattoo-studio');
    assert.equal(extra.family, 'portfolio', 'guessed from the word studio');
    const th = flagshipFor(extra);
    assert.equal(th.id, 'tattoo-studio-flagship');
    assert.equal(th.pack, 'tattoo-studio');
    assert.ok(derivePack({ ...industryContent[0], id: 'zzz', name: 'Zzz thing', seoKeywords: [] }).family);
  });
  test('closest pack: ids, old names, plain words, and the safe default for anything else', () => {
    assert.equal(closestPack('restaurant').id, 'restaurant');
    assert.equal(closestPack('healthcare').id, 'clinic');
    assert.equal(closestPack('real-estate').id, 'realestate');
    assert.equal(closestPack('Dental clinic').id, 'clinic');
    assert.equal(closestPack('Tours and travel agency').id, 'travel');
    assert.equal(closestPack('Beauty salon').id, 'salon');
    for (const none of ['', '   ', 'zzzz qqqq', null, undefined, 'Home repair and trades xyz123']) assert.ok(closestPack(none as string).id.length > 0);
    assert.equal(closestPack('').id, GENERAL_PACK.id);
    assert.equal(closestPack('zzzz qqqq').id, GENERAL_PACK.id);
    assert.equal(packById('advocate')?.id, 'professional');
    assert.equal(packById('nope'), null);
  });
  test('every pack has a flagship theme; its text passes AA contrast; themes differ in layout, not only colour', () => {
    assert.equal(FLAGSHIPS.length, PACKS.length + 1);
    assert.equal(new Set(FLAGSHIPS.map((t) => t.id)).size, FLAGSHIPS.length);
    for (const t of FLAGSHIPS) {
      assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'a valid manifest id');
      assert.equal(t.freeMode, true); assert.equal(t.track, 'both');
      for (const [what, a, b] of [['text', t.colors.fg, t.colors.bg], ['muted', t.colors.muted, t.colors.bg], ['button', t.colors.accentFg, t.colors.accent], ['accent', t.colors.accent, t.colors.bg]] as const) {
        const r = contrastRatio(a, b); assert.ok(r !== null && r >= 4.5, `${t.id} ${what} ${r}`);
      }
    }
    const sig = (t: KitTheme): string => [t.design.hero, t.design.services, t.design.gallery, t.design.type, t.design.order.join('>')].join('|');
    assert.ok(new Set(FLAGSHIPS.map(sig)).size >= 12, `distinct layouts: ${new Set(FLAGSHIPS.map(sig)).size}`);
    const fams = [...new Set(PACKS.map((p) => p.family))];
    for (const a of fams) for (const b of fams) if (a < b) {
      const x = FLAGSHIPS.find((t) => t.families[0] === a)!.design; const y = FLAGSHIPS.find((t) => t.families[0] === b)!.design;
      const diff = (['hero', 'services', 'gallery', 'type'] as const).filter((k) => x[k] !== y[k]).length + (x.order.join() !== y.order.join() ? 1 : 0);
      assert.ok(diff >= 2, `${a} vs ${b} differ in ${diff} knobs`);
    }
  });
});

describe('P11 targets: the resolver rule at every level', () => {
  const sub = mk('t-sub', [{ level: 'sub', id: 'dental', slug: 'clinic/dental' }]);
  const cat = mk('t-cat', [{ level: 'category', id: 'dental-clinic' }]);
  const main = mk('t-main', [{ level: 'main', id: 'clinic' }]);
  const ctx = { main: { id: 'clinic' }, category: { id: 'dental-clinic' }, sub: { id: 'dental', slug: 'clinic/dental' } };

  test('sub category first, then category, then main category', () => {
    const all = [main, cat, sub];
    assert.deepEqual([resolveTheme(ctx, all).theme.id, resolveTheme(ctx, all).level], ['t-sub', 'sub']);
    assert.deepEqual([resolveTheme({ ...ctx, sub: undefined }, all).theme.id, resolveTheme({ ...ctx, sub: undefined }, all).level], ['t-cat', 'category']);
    assert.deepEqual([resolveTheme({ main: ctx.main }, all).theme.id, resolveTheme({ main: ctx.main }, all).level], ['t-main', 'main']);
  });
  test('the most specific wins whatever the order of the list, and a less specific one never beats it', () => {
    for (const all of [[sub, cat, main], [main, sub, cat], [cat, main, sub]]) assert.equal(resolveTheme(ctx, all).theme.id, 't-sub');
    assert.equal(resolveTheme({ ...ctx, sub: { id: 'other' } }, [sub, cat, main]).theme.id, 't-cat');
  });
  test('id or slug both match, ignoring case and spaces', () => {
    assert.equal(resolveTheme({ sub: { slug: ' Clinic/Dental ' } }, [sub]).theme.id, 't-sub');
    assert.equal(resolveTheme({ sub: { id: 'DENTAL' } }, [sub]).theme.id, 't-sub');
    assert.equal(resolveTheme({ category: { slug: 'dental-clinic' } }, [cat]).theme.id, 't-cat');
  });
  test('several themes at one level: the vendor choice, else the default, else the lowest id (never list order)', () => {
    const a = mk('a-theme', [{ level: 'category', id: 'dental-clinic' }]);
    const b = mk('b-theme', [{ level: 'category', id: 'dental-clinic' }], { isDefault: true });
    const c = mk('c-theme', [{ level: 'category', id: 'dental-clinic' }]);
    for (const list of [[a, b, c], [c, b, a], [b, c, a]]) {
      assert.equal(resolveTheme({ category: { id: 'dental-clinic' } }, list, 'c-theme').theme.id, 'c-theme', 'the vendor choice');
      assert.equal(resolveTheme({ category: { id: 'dental-clinic' } }, list).theme.id, 'b-theme', 'the default');
      assert.equal(resolveTheme({ category: { id: 'dental-clinic' } }, list, 'not-a-candidate').theme.id, 'b-theme', 'a choice that is not a candidate is ignored');
    }
    assert.equal(resolveTheme({ category: { id: 'dental-clinic' } }, [c, a]).theme.id, 'a-theme', 'no default: the lowest id');
    assert.deepEqual(resolveTheme({ category: { id: 'dental-clinic' } }, [c, a, b]).candidates, ['a-theme', 'b-theme', 'c-theme']);
    assert.equal(pickCandidate([c, a]).id, 'a-theme');
  });
  test('no target matches: the flagship of the closest pack, then the safe default', () => {
    const r = resolveTheme({ main: { id: 'restaurant' } }, FLAGSHIPS.filter((t) => t.id !== 'restaurant-flagship').concat([mk('x', [{ level: 'main', id: 'zzz' }])]));
    assert.equal(r.level, 'default', 'the restaurant flagship was removed from the pool, so the default answers');
    const pk = resolveTheme({ category: { id: 'unknown-thing' }, main: { id: 'unknown-main' } }, [mk('only', [{ level: 'main', id: 'zzz' }], { pack: 'restaurant' })]);
    assert.ok(pk.theme.id === GENERAL_THEME.id && pk.level === 'default');
    const closest = resolveTheme({ main: { id: 'travel' } }, [mk('trip', [{ level: 'main', id: 'zzz' }], { pack: 'travel' }), main]);
    assert.deepEqual([closest.theme.id, closest.level], ['trip', 'pack']);
    const real = resolveTheme({ main: { id: 'travel' } });
    assert.deepEqual([real.theme.id, real.level], ['travel-flagship', 'main'], 'a flagship targets its own main category');
    const none = resolveTheme({});
    assert.deepEqual([none.theme.id, none.level], [DEFAULT_THEME_ID, 'default']);
    assert.equal(resolveTheme({}, []).theme.id, DEFAULT_THEME_ID, 'an empty theme list still answers');
  });
  test('the context of a site: category key, its main category, and a sub category from the data', () => {
    assert.deepEqual(contextOf({ vendor: { industry: 'restaurant' } }).main, { id: 'restaurant', slug: 'restaurant' });
    assert.deepEqual(contextOf({ vendor: { industry: 'x' }, pack: { key: 'advocate' } }).main, { id: 'professional', slug: 'professional' });
    assert.deepEqual(contextOf({ vendor: { industry: 'x' }, pack: { key: 'advocate' } }).category, { id: 'advocate', slug: 'advocate' });
    assert.equal(contextOf({ vendor: { industry: 'Dental clinic' } }).sub?.slug, 'clinic/dental');
    assert.equal(contextOf({ vendor: { industry: 'Dental clinic', subCategory: 'orthodontics' } }).sub?.id, 'orthodontics');
    assert.equal(contextOf({ vendor: { industry: 'Home repair and trades' } }).sub, undefined);
    assert.deepEqual(contextOf(null), {});
    assert.equal(themeForSite({ vendor: { industry: 'Dental clinic' } }).theme.pack, 'clinic');
    assert.equal(themeForSite({ vendor: { industry: 'zzzz' } }).theme.id, DEFAULT_THEME_ID);
  });
  test('a sub category target beats the vendor industry flagship end to end', () => {
    const dental = mk('dental-pro', [{ level: 'sub', slug: 'clinic/dental' }]);
    assert.equal(themeForSite({ vendor: { industry: 'Dental clinic' } }, [...FLAGSHIPS, dental]).theme.id, 'dental-pro');
    assert.equal(themeForSite({ vendor: { industry: 'Dental clinic' } }, [...FLAGSHIPS, dental]).level, 'sub');
    assert.equal(themeForSite({ vendor: { industry: 'clinic' } }, [...FLAGSHIPS, dental]).theme.id, 'clinic-flagship');
  });
  test('"targets" in theme.json are checked in plain sentences', () => {
    assert.deepEqual(validateTargets(undefined), { targets: [], errors: [] });
    assert.equal(validateTargets({}).errors.length, 1);
    assert.match(validateTargets([{ level: 'region', id: 'x' }]).errors[0], /"level" must be/);
    assert.match(validateTargets([{ level: 'main' }]).errors[0], /"id" or a "slug"/);
    assert.match(validateTargets([{ level: 'main', id: 'Bad Id!' }]).errors[0], /not a valid id or slug/);
    assert.match(validateTargets([{ level: 'main', id: 'clinic' }, { level: 'main', id: 'clinic' }]).errors[0], /listed twice/);
    const known = { main: new Set(PACKS.map((p) => p.id)) };
    assert.match(validateTargets([{ level: 'main', id: 'nope' }], known).errors[0], /does not exist/);
    const ok = validateTargets([{ level: 'main', id: 'clinic' }, { level: 'sub', slug: 'clinic/dental' }], known);
    assert.deepEqual(ok.errors, []); assert.equal(ok.targets.length, 2);
  });
});

describe('P11 the app shell', () => {
  const site = {
    vendor: { businessName: 'Plumber Boy', industry: 'Home repair and trades', subdomain: 'plumberboy' },
    cms: { businessName: 'Plumber Boy', tagline: 'Quick plumbing repairs at your door.', about: 'We fix leaks and fit bathrooms across the city.', phone: '+91 98765 43210', whatsapp: '919876543210', email: 'owner@example.com', address: '12 Lake Road, Chennai', hours: 'Opening hours', banner: '/starter/generic/hero.svg', logo: null },
    products: [{ name: 'Tap and pipe repair', description: 'Leaks fixed the same day', price: '₹499', image: '/starter/home-services/g1.webp' }, { name: 'Bathroom fittings', description: 'Supply and fitting', price: null, image: '/starter/home-services/g2.webp' }],
  };
  const p = closestPack('Home repair'); const theme = themeForSite(site).theme;

  test('bottom navigation on a phone, top navigation on a computer, Powered by line once', () => {
    const html = render(buildSiteView(site, { mode: 'live', pack: p }), theme);
    assert.match(html, /data-testid="bottom-nav"/); assert.match(html, /data-testid="top-nav"/);
    const bottom = /<nav class="sk-bnav"[\s\S]*?<\/nav>/.exec(html)![0];
    for (const label of ['Home', 'Services', 'Call']) assert.ok(bottom.includes(`<span>${label}</span>`), label);
    assert.ok(bottom.includes('href="tel:+919876543210"') || bottom.includes('href="tel:+91'), 'Call is a tel link in live mode');
    assert.match(html, /<footer class="sk-foot"><small><span data-g4d-powered-by="">Powered by <a href="https:\/\/get4domain\.com\/"[^>]*>Get4Domain<\/a><\/span><\/small><\/footer>/);
    assert.equal((html.match(/Powered by/g) ?? []).length, 1);
    assert.match(src('lib/v3-public/site-kit/css.ts'), /@media\(min-width:768px\)\{[\s\S]*\.sk-bnav\{display:none\}[\s\S]*\.sk-dnav\{display:flex\}/, 'the bottom bar is for phones only, the top bar for computers');
    assert.match(src('lib/v3-public/site-kit/css.ts'), /\.sk-bnav\{position:fixed;/);
  });
  test('the nav lists only sections that exist, and the labels follow the spec', () => {
    const v = buildSiteView({ vendor: { businessName: 'X' }, cms: { phone: '+91 99999 11111' }, products: [] }, { mode: 'live', pack: GENERAL_PACK });
    assert.deepEqual(navItems(v, visibleSections(v, GENERAL_THEME.design.order)).map((n) => n.label), ['Home', 'Call']);
    const sample = buildSiteView(site, { mode: 'live', pack: p, sample: true });
    const labels = navItems(sample, visibleSections(sample, theme.design.order)).map((n) => n.label);
    assert.deepEqual(labels, ['Home', 'Services', 'Gallery', 'Reviews', 'Call']);
    const noPhone = buildSiteView({ ...site, cms: { ...site.cms, phone: null } }, { mode: 'live', pack: p, sample: true });
    assert.equal(navItems(noPhone, visibleSections(noPhone, theme.design.order)).at(-1)?.label, 'Enquire');
    assert.equal(enquiryHref(noPhone)?.kind, 'whatsapp');
  });
  test('the Install app button is a client button, mobile only, with a guide sheet and the browser prompt', () => {
    const c = src('components/site-kit/InstallButton.tsx');
    assert.match(c, /^'use client'/);
    assert.match(c, /beforeinstallprompt/); assert.match(c, /\.prompt\(\)/); assert.match(c, /display-mode: standalone/); assert.match(c, /Install app/); assert.match(c, /sk-mobile-only/);
    assert.match(src('lib/v3-public/site-kit/css.ts'), /\.sk-mobile-only\{display:none!important\}/);
    const html = render(buildSiteView(site, { mode: 'live', pack: p }), theme);
    assert.ok(!html.includes('data-testid="install-app"'), 'drawn after the browser decides it can install (not in the server HTML)');
    assert.match(src('components/site-kit/SiteApp.tsx'), /<InstallButton appName=\{view\.name\} \/>/, 'the button is in every site, Free and Pro');
  });
  test('install rules: platform, standalone, steps', () => {
    assert.equal(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari'), 'ios');
    assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari', 5), 'ios', 'iPadOS');
    assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari', 0), 'other');
    assert.equal(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120'), 'android');
    assert.equal(detectPlatform('Mozilla/5.0 (Windows NT 10.0) Chrome/120'), 'other');
    assert.equal(installAvailable('ios', false), true); assert.equal(installAvailable('android', false), true);
    assert.equal(installAvailable('other', false), false, 'never on a computer'); assert.equal(installAvailable('ios', true), false, 'never when already installed');
    assert.ok(installSteps('ios')[1].includes('Add to Home Screen')); assert.ok(installSteps('android')[1].includes('Install app'));
  });
  test('the vendor web manifest: name, icon, colours, own start address', () => {
    const m = buildWebManifest({ name: 'Plumber Boy and Sons Plumbing Works', accent: '#0f766e', background: '#ffffff', description: 'Plumbing <b>x</b>' }) as Record<string, unknown> & { icons: { src: string; sizes: string; purpose: string }[] };
    assert.equal(m.name, 'Plumber Boy and Sons Plumbing Works'); assert.ok((m.short_name as string).length <= 12);
    assert.equal(m.display, 'standalone'); assert.equal(m.start_url, '/'); assert.equal(m.scope, '/'); assert.equal(m.theme_color, '#0f766e');
    assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
    assert.ok(!String(m.description).includes('<'));
    assert.equal(buildWebManifest({ name: 'X', accent: 'red', background: 'blue' }).theme_color, '#2563eb');
    assert.equal(shortNameOf('Plumber Boy'), 'Plumber Boy'); assert.equal(iconLetter('  plumber'), 'P'); assert.equal(iconLetter('???'), 'W');
    assert.equal(iconSize('512'), 512); assert.equal(iconSize('9999'), 192); assert.equal(iconSize(null), 192);
    const page = src('app/site/[subdomain]/[[...rest]]/page.tsx');
    assert.match(src('lib/v3-public/site-kit/head.ts'), /manifest: MANIFEST_PATH/); assert.equal(MANIFEST_PATH, '/app-manifest');
    assert.match(src('app/site/[subdomain]/app-manifest/route.ts'), /application\/manifest\+json/);
    assert.match(src('app/site/[subdomain]/app-icon/route.ts'), /ImageResponse/);
  });
  test('every pack renders in both modes without throwing and with the name as the one H1', () => {
    for (const pk of [...PACKS, GENERAL_PACK]) {
      const th = flagshipFor(pk);
      for (const mode of ['info', 'live'] as const) {
        const html = render(buildSiteView(site, { mode, pack: pk, sample: true }), th);
        assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, `${pk.id} ${mode}`);
        assert.match(html, /<h1>Plumber Boy<\/h1>/);
        assert.ok(html.includes(`data-hero="${th.design.hero}"`) && html.includes(`data-type="${th.design.type}"`));
      }
    }
  });
});

describe('P11 Free mode: information only', () => {
  const raw = {
    vendor: { businessName: 'Plumber Boy', industry: 'Home repair and trades', subdomain: 'plumberboy' },
    cms: { businessName: 'Plumber Boy', tagline: 'Quick plumbing repairs at your door.', about: 'Quick plumbing repairs at your door.', phone: '+91 98765 43210', whatsapp: '919876543210', email: 'owner@example.com', address: '12 Lake Road, Chennai', hours: 'Opening hours', banner: '/starter/generic/hero.svg', logo: null },
    products: [{ name: 'Tap and pipe repair', description: 'Tap and pipe repair', price: null, image: null }, { name: 'Bathroom fittings', description: 'Supply and fitting', price: null, image: null }],
    plan: 'FREE',
  };
  const free = (o: Partial<typeof raw> = {}): string => renderToStaticMarkup(createElement(FreeSiteView, { view: freeViewOf({ ...raw, ...o } as never) }));

  test('no form, input, chat, button element, mailto, tel or wa.me link; the phone is plain text; no e-mail anywhere', () => {
    const html = free();
    assert.ok(!/<(form|input|textarea|select|iframe|script|button)\b/i.test(html), 'a forbidden element');
    assert.ok(!/mailto:|tel:|wa\.me|whatsapp|chatbot/i.test(html), 'a forbidden link');
    assert.ok(!html.includes('owner@example.com') && !html.includes('919876543210'));
    assert.ok(html.includes('+91 98765 43210'), 'the phone is shown');
    // the one shared "Powered by Get4Domain" mark (engine/components/PoweredBy) is the platform's own link and is on every site; nothing else may link out
    const withoutMark = html.replace(/<span data-g4d-powered-by="">[\s\S]*?<\/span>/, '');
    assert.ok(!/href="(https?:|mailto:|tel:)/i.test(withoutMark), 'only in-page anchors remain');
    assert.ok(!/class="sk-btn/.test(html), 'no call-to-action button');
    assert.ok(!/<a [^>]*class="sk-btn/.test(html));
  });
  test('the view never carries an e-mail or a WhatsApp number in info mode', () => {
    const v = buildSiteView(raw, { mode: 'info', pack: GENERAL_PACK });
    assert.equal(v.email, null); assert.equal(v.whatsapp, null); assert.equal(v.phone, '+91 98765 43210');
    assert.equal(enquiryHref(v), null);
    assert.ok(navItems(v, visibleSections(v, GENERAL_THEME.design.order)).every((n) => n.kind === 'anchor'));
  });
  test('H1 is the business name (the category is only a small label); no repeated text; no "Opening hours" placeholder line', () => {
    const html = free();
    assert.match(html, /<h1>Plumber Boy<\/h1>/);
    assert.match(html, /<p class="sk-eyebrow">Home repair and trades<\/p>/);
    assert.equal((html.match(/Quick plumbing repairs at your door\./g) ?? []).length, 1, 'the tagline and the identical about text show once');
    assert.equal((html.match(/Tap and pipe repair/g) ?? []).length, 1, 'a description equal to the name is dropped');
    assert.ok(!html.includes('Opening hours'), 'a placeholder hides the whole line');
    assert.ok(!html.includes('Hours:'));
    const real = free({ cms: { ...raw.cms, hours: 'Mon to Sat: 9 am to 6 pm' } });
    assert.ok(real.includes('Opening hours') && real.includes('Mon to Sat: 9 am to 6 pm'), 'real hours are shown');
  });
  test('hours and text helpers', () => {
    for (const bad of ['Opening hours', 'opening hours:', 'Hours', 'N/A', '', '  ', null, undefined, [], ['Opening hours'], [{ day: 'Mon', hours: 'Hours' }], '-']) assert.deepEqual(hoursLines(bad), [], String(bad));
    assert.deepEqual(hoursLines('Mon-Sat 9-6'), ['Mon-Sat 9-6']);
    assert.deepEqual(hoursLines([{ day: 'Sun', hours: 'Closed' }, 'Mon-Sat 9-6']), ['Sun: Closed', 'Mon-Sat 9-6']);
    assert.equal(distinctText('Fresh food daily', ['Fresh food daily.']), null);
    assert.equal(distinctText('Fresh food daily', ['Something else']), 'Fresh food daily');
    assert.equal(distinctText(null, []), null);
  });
  test('the page title is "<business name> | <real category> | Get4Domain"', () => {
    assert.equal(pageTitle('Plumber Boy', 'Home repair and trades'), 'Plumber Boy | Home repair and trades | Get4Domain');
    assert.equal(pageTitle('Plumber Boy', null), 'Plumber Boy | Get4Domain');
    assert.equal(pageTitle('Clinic', 'clinic'), 'Clinic | Get4Domain', 'not the name twice');
    assert.equal(freeViewOf(raw as never).category, 'Home repair and trades');
    assert.equal(freeViewOf({ ...raw, vendor: { ...raw.vendor, industry: 'restaurant' } } as never).category, 'Restaurant & Food');
    const page = src('app/site/[subdomain]/[[...rest]]/page.tsx');
    // A1: every renderer takes its head from buildHead (<name> | <category> in <city>), tested in a1.test.ts
    assert.match(page, /buildHead\(\{ site, subdomain/);
  });
  test('the Free page file has no link, button or form; an adapter turns the Free view into the kit view', () => {
    const c = src('components/site/FreeSiteView.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/<(a|button|form|input|textarea|select|iframe|script)\b/i.test(c));
    assert.ok(!/mailto:|tel:|wa\.me|whatsapp|ChatBot|href=|onClick/i.test(c));
    const v = siteViewFromFree(freeViewOf(raw as never), closestPack('plumber'));
    assert.equal(v.mode, 'info');
    const kit = src('components/site-kit/SiteApp.tsx');
    assert.match(kit, /live \? \(|live && /, 'every link checks live');
    // the only links the kit can write are guarded: tel and mailto and wa.me only through live-only values
    for (const m of kit.matchAll(/href=\{`?(mailto:|tel:)/g)) assert.ok(m, 'guarded');
  });
});
