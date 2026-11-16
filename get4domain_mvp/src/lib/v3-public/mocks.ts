import type { BacklinkBlock, BusinessFacts, Card, ClaimSearchItem, ListingState, Crumb, Facet, Link, PageModel, PageType } from './types';

/**
 * Fixtures for reviewing the public site without the API (V3_PUBLIC_USE_MOCKS=true, the default).
 * They follow the real page model exactly. Nothing here is a real business, a real address or a production URL.
 */
export const MOCK_ORIGIN = 'https://directory.example.invalid';
const API = 'https://api.example.invalid';

const abs = (p: string): string => `${MOCK_ORIGIN}${p === '/' ? '' : p}`;
const crumbs = (items: Array<[string, string]>): Crumb[] => items.map(([name, path]) => ({ name, path, url: abs(path) }));
const visit = (id: string, src: string): string => `${API}/v3/go/${id}?src=${src}`;

interface Biz { id: string; slug: string; name: string; locality: string; category: string; description: string; claimed: boolean; verified: boolean; hours: string | null; site: boolean }

const BIZ: Biz[] = [
  { id: 'b-1001', slug: 'sri-murugan-plumbing', name: 'Sri Murugan Plumbing', locality: 'Adyar', category: 'Plumbers', description: 'Pipe fitting, leak repair and bathroom fittings for homes and small shops.', claimed: false, verified: false, hours: null, site: true },
  { id: 'b-1002', slug: 'anand-electricals', name: 'Anand Electricals', locality: 'Adyar', category: 'Electricians', description: 'Wiring, switchboards and fan installation for homes.', claimed: true, verified: true, hours: 'Monday to Saturday, 9 am to 7 pm', site: true },
  { id: 'b-1003', slug: 'blue-tap-services', name: 'Blue Tap Services', locality: 'Velachery', category: 'Plumbers', description: 'Water tank cleaning and plumbing repairs.', claimed: true, verified: false, hours: 'Every day, 8 am to 8 pm', site: true },
  { id: 'b-1004', slug: 'kavitha-home-care', name: 'Kavitha Home Care', locality: 'Adyar', category: 'Plumbers', description: 'Plumbing repairs and fittings.', claimed: false, verified: false, hours: null, site: false },
  { id: 'b-1005', slug: 'city-pipe-works', name: 'City Pipe Works', locality: 'T Nagar', category: 'Plumbers', description: 'Pipeline work for flats and offices.', claimed: false, verified: false, hours: null, site: true },
];

const card = (b: Biz, src: PageType): Card => ({
  name: b.name, slug: b.slug, profilePath: `/business/${b.slug}`, locality: b.locality, category: b.category, description: b.description,
  claimed: b.claimed, verified: b.verified, hoursText: b.hours, imageUrl: null,
  visitUrl: b.site ? visit(b.id, src) : null, listingOnly: !b.site,
});

const links = (items: Array<[string, string, number?]>): Link[] => items.map(([name, path, count]) => (count === undefined ? { name, path } : { name, path, count }));
const NO_RELATED = { nearbyLocalities: [], relatedCategories: [], parents: [] };

interface Opts {
  type: PageType; path: string; title: string; description: string; h1: string; intro: string; cards?: Card[]; facets?: Facet[];
  crumbs: Array<[string, string]>; indexable?: boolean; reason?: PageModel['meta']['noindexReason']; related?: PageModel['related']; faq?: PageModel['faq'];
  page?: { n: number; total: number; size: number; totalItems: number; base: string }; business?: BusinessFacts;
}

function model(o: Opts): PageModel {
  const at = (n: number): string => (n < 2 ? o.page!.base : `${o.page!.base}/page/${n}`);
  const pg = o.page
    ? {
        number: o.page.n, totalPages: o.page.total, pageSize: o.page.size, total: o.page.totalItems,
        prevPath: o.page.n > 1 ? at(o.page.n - 1) : null, nextPath: o.page.n < o.page.total ? at(o.page.n + 1) : null,
        prev: o.page.n > 1 ? abs(at(o.page.n - 1)) : null, next: o.page.n < o.page.total ? abs(at(o.page.n + 1)) : null,
      }
    : null;
  const indexable = o.indexable ?? false;
  const cr = crumbs(o.crumbs);
  return {
    type: o.type, path: o.path, page: pg,
    meta: {
      title: o.title, description: o.description, canonical: abs(o.path),
      robots: indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow', indexable, noindexReason: indexable ? null : (o.reason ?? 'NOT_INDEXABLE'),
      hreflang: [],
    },
    h1: o.h1, intro: o.intro, breadcrumbs: cr,
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: cr.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) }],
    cards: o.cards ?? [], facets: o.facets ?? [], related: o.related ?? NO_RELATED, faq: o.faq ?? [], ...(o.business ? { business: o.business } : {}),
  };
}

const plumbers = BIZ.filter((b) => b.category === 'Plumbers');
const HOME_CRUMB: [string, string] = ['Directory', '/directory'];

function facts(b: Biz): BusinessFacts {
  return {
    name: b.name, claimed: b.claimed, verified: b.verified, category: b.category, locality: b.locality, city: 'Chennai', description: b.description,
    address: b.claimed ? { locality: b.locality, city: 'Chennai' } : null, geo: null, hoursText: b.hours, imageUrl: null,
    visitUrl: b.site ? visit(b.id, 'business') : null, listingOnly: !b.site,
  };
}

/** The same URL grammar as the backend (url-scheme.ts), trimmed to what the fixtures need. */
function parse(path: string): { base: string; page: number } | null {
  const p = path.split('#')[0].split('?')[0].toLowerCase().replace(/\/+$/, '') || '/';
  const m = /^(.*)\/page\/(\d{1,4})$/.exec(p);
  if (!m) return { base: p, page: 1 };
  const n = Number(m[2]);
  return n < 2 ? null : { base: m[1] || '/', page: n };
}

export function mockPage(path: string): { kind: 'ok'; model: PageModel } | { kind: 'notFound' } | { kind: 'gone' } {
  const parsed = parse(path);
  if (!parsed) return { kind: 'notFound' };
  const { base, page } = parsed;

  if (base === '/removed-shop' || base === '/business/removed-shop') return { kind: 'gone' };

  const biz = /^\/business\/([a-z0-9-]+)$/.exec(base);
  if (biz) {
    if (page !== 1) return { kind: 'notFound' };
    const b = BIZ.find((x) => x.slug === biz[1]);
    if (!b) return { kind: 'notFound' };
    return { kind: 'ok', model: model({
      type: 'business', path: base, title: `${b.name}, ${b.locality} | Get4Domain`, description: `${b.name} is listed as ${b.category.toLowerCase()} in ${b.locality}, Chennai.`,
      h1: b.name, intro: b.description, crumbs: [HOME_CRUMB, ['Chennai', '/chennai'], [b.category, '/chennai/plumbers'], [b.name, base]], indexable: b.claimed, reason: b.claimed ? null : 'UNCLAIMED', business: facts(b),
    }) };
  }

  const single = (total: number, size: number): { total: number; ok: boolean } => ({ total: Math.max(1, Math.ceil(total / size)), ok: page <= Math.max(1, Math.ceil(total / size)) });

  switch (base) {
    case '/directory':
    case '/':
      if (page !== 1) return { kind: 'notFound' };
      return { kind: 'ok', model: model({
        type: 'home', path: '/', title: 'Business directory for Indian cities | Get4Domain', description: 'Browse listed businesses by city and category.', h1: 'Business directory', intro: 'Browse listed businesses by city and category. Each listing links to the business own site.',
        crumbs: [HOME_CRUMB], cards: BIZ.slice(0, 2).map((b) => card(b, 'home')),
        facets: [{ kind: 'city', items: links([['Chennai', '/chennai', 5], ['Coimbatore', '/coimbatore', 0]]) }, { kind: 'category', items: links([['Plumbers', '/category/plumbers', 4], ['Electricians', '/category/electricians', 1]]) }],
      }) };
    case '/state/tamil-nadu': {
      if (page !== 1) return { kind: 'notFound' };
      return { kind: 'ok', model: model({
        type: 'state', path: base, title: 'Businesses in Tamil Nadu | Get4Domain', description: 'Cities with listed businesses in Tamil Nadu.', h1: 'Businesses in Tamil Nadu', intro: 'Cities in Tamil Nadu that have listed businesses.',
        crumbs: [HOME_CRUMB, ['Tamil Nadu', base]], facets: [{ kind: 'city', items: links([['Chennai', '/chennai', 5]]) }], page: { n: 1, total: 1, size: 20, totalItems: 5, base },
      }) };
    }
    case '/chennai': {
      const s = single(BIZ.length, 20);
      if (!s.ok) return { kind: 'notFound' };
      return { kind: 'ok', model: model({
        type: 'city', path: page > 1 ? `${base}/page/${page}` : base, title: 'Businesses in Chennai | Get4Domain', description: 'Listed businesses in Chennai by category.', h1: 'Businesses in Chennai', intro: 'Listed businesses in Chennai.',
        crumbs: [HOME_CRUMB, ['Chennai', base]], cards: BIZ.map((b) => card(b, 'city')), facets: [{ kind: 'category', items: links([['Plumbers', '/chennai/plumbers', 4], ['Electricians', '/chennai/electricians', 1]]) }],
        page: { n: page, total: s.total, size: 20, totalItems: BIZ.length, base },
      }) };
    }
    case '/category/plumbers': {
      if (page !== 1) return { kind: 'notFound' };
      return { kind: 'ok', model: model({
        type: 'category', path: base, title: 'Plumbers | Get4Domain', description: 'Listed plumbers by city.', h1: 'Plumbers', intro: 'Plumbers listed in the directory, by city.',
        crumbs: [HOME_CRUMB, ['Plumbers', base]], cards: plumbers.map((b) => card(b, 'category')), facets: [{ kind: 'city', items: links([['Chennai', '/chennai/plumbers', 4]]) }], page: { n: 1, total: 1, size: 20, totalItems: plumbers.length, base },
      }) };
    }
    case '/chennai/plumbers': {
      // The fixture pages two cards at a time so that /page/2 and /page/3 can be reviewed.
      const size = 2; const total = Math.ceil(plumbers.length / size);
      if (page > total) return { kind: 'notFound' };
      return { kind: 'ok', model: model({
        type: 'cityCategory', path: page > 1 ? `${base}/page/${page}` : base, title: 'Plumbers in Chennai | Get4Domain', description: 'Plumbers listed in Chennai.', h1: 'Plumbers in Chennai', intro: 'Plumbers listed in Chennai. Each card links to the business own site.',
        crumbs: [HOME_CRUMB, ['Chennai', '/chennai'], ['Plumbers', base]], cards: plumbers.slice((page - 1) * size, page * size).map((b) => card(b, 'cityCategory')),
        facets: [{ kind: 'locality', items: links([['Adyar', '/chennai/plumbers-in-adyar', 2], ['Velachery', '/chennai/plumbers-in-velachery', 1]]) }],
        related: { nearbyLocalities: links([['Velachery', '/chennai/plumbers-in-velachery']]), relatedCategories: links([['Electricians', '/chennai/electricians']]), parents: links([['Chennai', '/chennai']]) },
        faq: [{ question: 'How do I reach a plumber listed here?', answer: 'Use the Visit site link on the card. It opens the business own site.' }],
        indexable: true, page: { n: page, total, size, totalItems: plumbers.length, base },
      }) };
    }
    case '/chennai/plumbers-in-adyar': {
      if (page !== 1) return { kind: 'notFound' };
      const list = plumbers.filter((b) => b.locality === 'Adyar');
      return { kind: 'ok', model: model({
        type: 'localityCategory', path: base, title: 'Plumbers in Adyar, Chennai | Get4Domain', description: 'Plumbers listed in Adyar, Chennai.', h1: 'Plumbers in Adyar, Chennai', intro: 'Plumbers listed in Adyar.',
        crumbs: [HOME_CRUMB, ['Chennai', '/chennai'], ['Plumbers', '/chennai/plumbers'], ['Adyar', base]], cards: list.map((b) => card(b, 'localityCategory')), indexable: true, page: { n: 1, total: 1, size: 20, totalItems: list.length, base },
      }) };
    }
    case '/chennai/plumbers-in-velachery': {
      if (page !== 1) return { kind: 'notFound' };
      const list = plumbers.filter((b) => b.locality === 'Velachery');
      // Thin page: reachable, renders as the model says (noindex).
      return { kind: 'ok', model: model({
        type: 'localityCategory', path: base, title: 'Plumbers in Velachery, Chennai | Get4Domain', description: 'Plumbers listed in Velachery, Chennai.', h1: 'Plumbers in Velachery, Chennai', intro: 'Plumbers listed in Velachery.',
        crumbs: [HOME_CRUMB, ['Chennai', '/chennai'], ['Plumbers', '/chennai/plumbers'], ['Velachery', base]], cards: list.map((b) => card(b, 'localityCategory')), reason: 'THIN', page: { n: 1, total: 1, size: 20, totalItems: list.length, base },
      }) };
    }
    case '/chennai/electricians': {
      if (page !== 1) return { kind: 'notFound' };
      return { kind: 'ok', model: model({
        type: 'cityCategory', path: base, title: 'Electricians in Chennai | Get4Domain', description: 'Electricians listed in Chennai.', h1: 'Electricians in Chennai', intro: 'Electricians listed in Chennai.',
        crumbs: [HOME_CRUMB, ['Chennai', '/chennai'], ['Electricians', base]], cards: BIZ.filter((b) => b.category === 'Electricians').map((b) => card(b, 'cityCategory')), reason: 'THIN', page: { n: 1, total: 1, size: 20, totalItems: 1, base },
      }) };
    }
    case '/pincode/600020/plumbers': {
      if (page !== 1) return { kind: 'notFound' };
      // Empty page: reachable and rendered as the model says.
      return { kind: 'ok', model: model({
        type: 'pincodeCategory', path: base, title: 'Plumbers in 600020 | Get4Domain', description: 'Plumbers listed in the 600020 area.', h1: 'Plumbers in 600020', intro: 'Plumbers listed in this postal area.',
        crumbs: [HOME_CRUMB, ['Plumbers', '/category/plumbers'], ['600020', base]], reason: 'EMPTY', page: { n: 1, total: 1, size: 20, totalItems: 0, base },
      }) };
    }
    default:
      return { kind: 'notFound' };
  }
}

/** The listing state each fixture business is in, so every claim screen can be reached in mock mode. */
const MOCK_STATE: Record<string, ListingState> = {
  'sri-murugan-plumbing': 'UNCLAIMED_LISTING', 'anand-electricals': 'LIVE', 'blue-tap-services': 'CLAIMED', 'kavitha-home-care': 'DRAFT_SITE', 'city-pipe-works': 'UNCLAIMED_LISTING',
};

/** Fixture businesses a claim search can find (claimed ones are shown but cannot be chosen). */
export function mockSearch(name: string, city: string): ClaimSearchItem[] {
  const n = name.trim().toLowerCase();
  const c = city.trim().toLowerCase();
  if (!n && !c) return [];
  return BIZ.filter((b) => (!n || b.name.toLowerCase().includes(n)) && (!c || 'chennai'.includes(c))).map((b) => ({ slug: b.slug, name: b.name, place: `${b.locality}, Chennai`, category: b.category, claimed: b.claimed, state: MOCK_STATE[b.slug] ?? 'UNCLAIMED_LISTING' }));
}

export function mockListing(slug: string): ClaimSearchItem | null {
  const b = BIZ.find((x) => x.slug === slug);
  return b ? { slug: b.slug, name: b.name, place: `${b.locality}, Chennai`, category: b.category, claimed: b.claimed, state: MOCK_STATE[b.slug] ?? 'UNCLAIMED_LISTING' } : null;
}

/** Fixture claim tokens: the first works end to end, the second shows the email-switched-off screen, anything else is an invalid link. */
export const MOCK_TOKEN_OK = 'mock-claim-token-00000000';
export const MOCK_TOKEN_MAIL_OFF = 'mock-mail-off-token-0000';
export const MOCK_CODE_OK = '123456';
export const MOCK_CODE_LOCKED = '000000';
export const MOCK_SETUP_TOKEN = 'mock-setup-token-0000000000';

export const MOCK_BUSINESS_IDS: readonly string[] = BIZ.map((b) => b.id);

/** A backlink block for one claimed fixture business, so that the block can be reviewed. */
export function mockBacklinkBlock(businessId: string): BacklinkBlock | null {
  if (businessId !== 'b-1002') return null;
  return {
    brand: { href: MOCK_ORIGIN, text: 'Listed in the Get4Domain directory' },
    links: [
      { href: abs('/chennai/electricians'), text: 'Electricians in Chennai' },
      { href: abs('/chennai'), text: 'Businesses in Chennai' },
    ],
    html: '',
  };
}

/** What the backend robots text looks like while the directory pages are indexable (fixture). */
export const MOCK_DIRECTORY_ROBOTS = ['User-agent: *', 'Allow: /', 'Disallow: /go/', 'Disallow: /v3/go/', 'Disallow: /search', 'Disallow: /*?*q=', 'Disallow: /*?*sort=', '', `Sitemap: ${MOCK_ORIGIN}/sitemap.xml`, ''].join('\n');

/** Directory sitemap fixtures: an index of one chunk, and the chunk. */
export function mockSitemap(route: string): string | null {
  const head = '<?xml version="1.0" encoding="UTF-8"?>\n';
  if (route.endsWith('/index.xml')) return `${head}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${MOCK_ORIGIN}/sitemaps/directory-1.xml</loc></sitemap></sitemapindex>\n`;
  if (route.endsWith('/directory-1.xml')) return `${head}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${MOCK_ORIGIN}/chennai/plumbers</loc></url><url><loc>${MOCK_ORIGIN}/business/anand-electricals</loc></url></urlset>\n`;
  return null;
}
