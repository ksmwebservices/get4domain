import { toRenderEntitlements, resolveEntitlements } from '../src/plans/entitlements/entitlement-engine';
import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { evaluateIndexing } from '../src/site-publish/seo/indexing-rule';
import { SiteLifecycle, SeededLifecycle } from '../src/site-publish/publish/site-lifecycle';
import { entitlements } from './support/site-fixtures';
import { STAFF, siteWorld } from './support/site-world';

/**
 * Slice 5.4b through the real build service and the real renderer: a Free site is a listing-only page (no call to action of any kind), a Pro site has its calls to action, the
 * seeded notice appears only for seeded states, the SEO layer follows the seeded indexing setting, and legacy mode is untouched. Golden snapshots pin the Free home page of each track.
 */
jest.setTimeout(180_000);
const KINDS = [['plumber', 'handyman'], ['dentist', 'professional'], ['jewellery', 'ecommerce']] as const;
const FORBIDDEN: Array<[RegExp, string]> = [
  [/<form\b/i, 'a form'], [/<button\b/i, 'a button'], [/<input\b/i, 'an input'], [/<textarea\b/i, 'a textarea'],
  [/href="tel:/i, 'a tel: link'], [/href="sms:/i, 'an sms: link'], [/href="mailto:/i, 'a mailto: link'], [/wa\.me/i, 'a wa.me link'],
  [/href="\/(?:cart|book|enquire|checkout)\b/i, 'a cart, booking or enquiry link'],
  [/data-g4d-slot="(?:enquiry-form|booking|cart|whatsapp-float|action|bottom-nav|share-qr|search)"/, 'a call-to-action slot'],
];
const b3 = { get: async () => ({ ...DEFAULT_B3_SETTINGS }) };
const lifecycle = (state: SeededLifecycle | null, quality = false): SiteLifecycle => ({ lifecycleOf: async () => state, qualityOk: async () => quality });
const pagesOf = async (w: ReturnType<typeof siteWorld>, id: string) => (await w.repo.pagesOf(id)).filter((p) => p.html.startsWith('<!doctype html>'));

describe('render entitlements: callsToAction follows site.cta', () => {
  it('Free (locked) is false, Pro (active) is true, and nothing else turns it on', () => {
    expect(toRenderEntitlements(entitlements('FREE', 'handyman')).callsToAction).toBe(false);
    expect(toRenderEntitlements(entitlements('PRO', 'handyman')).callsToAction).toBe(true);
    const locked = entitlements('PRO', 'ecommerce'); locked.features['site.cta'] = { ...locked.features['site.cta'], state: 'LOCKED_PREVIEW' };
    expect(toRenderEntitlements(locked).callsToAction).toBe(false);
    const hidden = entitlements('PRO', 'ecommerce'); delete hidden.features['site.cta'];
    expect(toRenderEntitlements(hidden).callsToAction).toBe(false);
  });
  it('the render entitlements object has exactly the five keys the kit knows', () => {
    expect(Object.keys(toRenderEntitlements(entitlements('PRO'))).sort()).toEqual(['booking', 'callsToAction', 'cart', 'customDomain', 'video']);
    expect(resolveEntitlements).toBeDefined();
  });
});

describe('the SEO layer for seeded sites', () => {
  const base = { businessName: 'Acme', categoryId: 'plumber', claimed: false, verifiedContact: false, address: '1 Road', serviceAreas: 0, homeContent: true, forceNoindex: false };
  it('a seeded site is noindex while the mode is OFF (the default), whatever its quality', () => {
    expect(evaluateIndexing({ ...base, seeded: { mode: 'OFF', qualityOk: true } })).toMatchObject({ indexable: false, missing: [{ code: 'SEEDED_INDEXING_OFF' }] });
  });
  it('with QUALITY, a seeded site is indexable only when the quality check passes; the claim checks do not apply to it', () => {
    expect(evaluateIndexing({ ...base, seeded: { mode: 'QUALITY', qualityOk: true } })).toEqual({ indexable: true, missing: [] });
    expect(evaluateIndexing({ ...base, seeded: { mode: 'QUALITY', qualityOk: false } }).missing.map((m) => m.code)).toEqual(['SEEDED_QUALITY']);
  });
  it('a seeded site still needs the basics, and staff can still force noindex', () => {
    expect(evaluateIndexing({ ...base, businessName: ' ', seeded: { mode: 'QUALITY', qualityOk: true } }).missing.map((m) => m.code)).toContain('BUSINESS_NAME');
    expect(evaluateIndexing({ ...base, forceNoindex: true, seeded: { mode: 'QUALITY', qualityOk: true } }).indexable).toBe(false);
  });
  it('a site that is not seeded keeps the claim rules exactly', () => {
    expect(evaluateIndexing(base).missing.map((m) => m.code)).toEqual(['CLAIMED', 'VERIFIED_CONTACT']);
    expect(evaluateIndexing({ ...base, claimed: true, verifiedContact: true }).indexable).toBe(true);
  });
});

describe.each(KINDS)('%s (%s): Free is a listing-only site', (kind, track) => {
  it('no page has a call to action of any kind, the phone is plain text, and the listing lines come from the settings', async () => {
    const w = siteWorld({ kind, level: 'FREE', b3 });
    const { publication } = await w.build.build(`v-${kind}`, { actor: STAFF });
    const pages = await pagesOf(w, publication.id);
    expect(pages.length).toBeGreaterThan(4);
    for (const p of pages) {
      for (const [re, what] of FORBIDDEN) expect({ path: p.path, what, hit: re.test(p.html) }).toEqual({ path: p.path, what, hit: false });
      expect(p.html).toContain('data-g4d-listed-on'); expect(p.html).toContain(DEFAULT_B3_SETTINGS.siteFooterBridgeText.slice(0, 40));
    }
    const contact = pages.find((p) => p.path === '/contact')!;
    expect(contact.html).toMatch(/\+91|\d{5}/);   // the number is on the page as text
    expect(track).toBeTruthy();
  });

  it('the home page of the Free listing is pinned (golden snapshot)', async () => {
    const w = siteWorld({ kind, level: 'FREE', b3 });
    const { publication } = await w.build.build(`v-${kind}`, { actor: STAFF });
    const home = (await pagesOf(w, publication.id)).find((p) => p.path === '/')!;
    expect(home.html.replace(/<style[\s\S]*?<\/style>/g, '')).toMatchSnapshot();
  });

  it('a Pro site has its calls to action and the customer disclosure beside the form, and none of the listing lines', async () => {
    const w = siteWorld({ kind, level: 'PRO', b3 });
    const { publication } = await w.build.build(`v-${kind}`, { actor: STAFF });
    const pages = await pagesOf(w, publication.id);
    const all = pages.map((p) => p.html).join('\n');
    expect(all).toMatch(/<form class="g4d-form"/); expect(all).toMatch(/href="tel:/);
    expect(all).toContain(DEFAULT_B3_SETTINGS.customerDisclosureText.slice(0, 40));
    expect(all).not.toContain('data-g4d-listed-on'); expect(all).not.toContain('data-g4d-listing-note');
    if (track === 'ecommerce') expect(all).toContain('class="g4d-cart"'); else expect(all).toContain('/book');
  });
});

describe('the seeded notice and the SEO layer through the build', () => {
  it('SEEDED and INVITED carry the notice with working claim and remove links; every other state does not', async () => {
    for (const state of ['SEEDED', 'INVITED'] as const) {
      const w = siteWorld({ kind: 'plumber', level: 'FREE', b3, lifecycle: lifecycle(state) });
      const home = (await pagesOf(w, (await w.build.build('v-plumber', { actor: STAFF })).publication.id)).find((p) => p.path === '/')!;
      expect(home.html).toContain(DEFAULT_B3_SETTINGS.seededNoticeText); expect(home.html).toContain('<a href="/claim">'); expect(home.html).toContain('<a href="/remove">');
    }
    for (const state of ['CLAIMED_FREE', 'PRO', null] as const) {
      const w = siteWorld({ kind: 'plumber', level: 'FREE', b3, lifecycle: lifecycle(state) });
      const home = (await pagesOf(w, (await w.build.build('v-plumber', { actor: STAFF })).publication.id)).find((p) => p.path === '/')!;
      expect(home.html).not.toContain('data-g4d-seeded-notice');
    }
  });

  it('a seeded site is noindex by default; QUALITY with a passing check makes it indexable; QUALITY with a failing check does not', async () => {
    const run = async (mode: 'OFF' | 'QUALITY', ok: boolean) => {
      const w = siteWorld({ kind: 'plumber', level: 'FREE', b3: { get: async () => ({ ...DEFAULT_B3_SETTINGS, seededSiteIndexingMode: mode }) }, lifecycle: lifecycle('SEEDED', ok) });
      const p = (await w.build.build('v-plumber', { actor: STAFF })).publication; const home = (await pagesOf(w, p.id)).find((x) => x.path === '/')!;
      return { indexable: p.indexable, robots: /<meta name="robots" content="([^"]*)"/.exec(home.html)?.[1] };
    };
    expect(await run('OFF', true)).toMatchObject({ indexable: false, robots: 'noindex, nofollow' });
    expect(await run('QUALITY', false)).toMatchObject({ indexable: false, robots: 'noindex, nofollow' });
    const q = await run('QUALITY', true); expect(q.indexable).toBe(true); expect(q.robots).not.toMatch(/noindex/);
  });

  it('changing a setting text rebuilds the site (the texts are part of the settings hash)', async () => {
    let text = 'First footer line.';
    const w = siteWorld({ kind: 'plumber', level: 'FREE', b3: { get: async () => ({ ...DEFAULT_B3_SETTINGS, siteFooterBridgeText: text }) } });
    const a = await w.build.build('v-plumber', { actor: STAFF }); text = 'Second footer line.';
    const b = await w.build.build('v-plumber', { actor: STAFF });
    expect(b.reused).toBe(false); expect(b.publication.version).toBe(2); expect(a.publication.id).not.toBe(b.publication.id);
  });

  it('without the Batch 3 settings (older callers) the build still works and draws no listing lines', async () => {
    const w = siteWorld({ kind: 'plumber', level: 'FREE' });
    const home = (await pagesOf(w, (await w.build.build('v-plumber', { actor: STAFF })).publication.id)).find((p) => p.path === '/')!;
    expect(home.html).not.toContain('data-g4d-listing-note'); expect(home.html).not.toMatch(/<form\b/);
  });
});

describe('a published Pro page is served listing-only the moment the plan lapses or the vendor is suspended (owner rule 9)', () => {
  const HOST = 'sri-ganesh-plumbing.get4domain.com';
  async function live() {
    const w = siteWorld({ kind: 'plumber', level: 'PRO', b3, servePolicy: true });
    w.state.vendorHosts.set(HOST, { vendorId: 'v-plumber', removed: false });
    const { publication } = await w.build.build('v-plumber', { actor: STAFF });
    await w.publish.publish('v-plumber', publication.id, STAFF);
    return w;
  }
  it('Pro is served with its forms; the same stored page is served as a listing once site.cta is gone; the stored page is unchanged; Pro returning restores the original bytes', async () => {
    const w = await live();
    const pro = (await w.pub.byHost(HOST, '/contact', 'en'))!;
    expect(pro.html).toMatch(/<form class="g4d-form"/); expect(pro.html).toMatch(/href="tel:/);
    const stored = (await w.repo.pagesOf((await w.repo.currentPublication('v-plumber'))!.id)).find((p) => p.path === '/contact')!;

    w.state.ent = entitlements('FREE', 'handyman');   // the plan lapsed or the vendor was suspended: the engine now says Free
    const free = (await w.pub.byHost(HOST, '/contact', 'en'))!;
    for (const [re, what] of FORBIDDEN) expect({ what, hit: re.test(free.html) }).toEqual({ what, hit: false });
    expect(free.html).toContain('data-g4d-listed-on'); expect(free.html).toContain(DEFAULT_B3_SETTINGS.siteFooterBridgeText.slice(0, 40));
    expect(free.etag).not.toBe(pro.etag);   // a cache never serves one in place of the other
    expect((await w.repo.pagesOf((await w.repo.currentPublication('v-plumber'))!.id)).find((p) => p.path === '/contact')!.html).toBe(stored.html);   // nothing stored changed

    w.state.ent = entitlements('PRO', 'handyman');   // renewal or reinstatement
    const back = (await w.pub.byHost(HOST, '/contact', 'en'))!;
    expect(back.html).toBe(pro.html); expect(back.etag).toBe(pro.etag);
  });
  it('the stylesheet, sitemap and robots files are served as they are', async () => {
    const w = await live(); w.state.ent = entitlements('FREE', 'handyman');
    const css = (await w.pub.byHost(HOST, '/assets/site.css', 'en'))!; expect(css.contentType).toContain('text/css'); expect(css.html).not.toContain('g4d-listing-note');
    expect((await w.pub.byHost(HOST, '/robots.txt', 'en'))!.contentType).toContain('text/plain');
  });
  it('a page that was built listing-only is not changed again (idempotent)', async () => {
    const w = siteWorld({ kind: 'plumber', level: 'FREE', b3, servePolicy: true });
    w.state.vendorHosts.set(HOST, { vendorId: 'v-plumber', removed: false });
    const { publication } = await w.build.build('v-plumber', { actor: STAFF });
    await w.publish.publish('v-plumber', publication.id, STAFF);
    const stored = (await w.repo.pagesOf(publication.id)).find((p) => p.path === '/')!;
    const served = (await w.pub.byHost(HOST, '/', 'en'))!;
    expect(served.html).toBe(stored.html); expect(served.etag).toBe(`"${stored.sha256}"`);
  });
});
