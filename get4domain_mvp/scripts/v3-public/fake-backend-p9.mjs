// A fake local backend for the vendor-site renderer: the exact answer shape of GET /cms/site/:subdomain (cms.service.ts getSiteBySubdomain, wrapped by the API's
// { success, statusCode, message, data, timestamp }) and GET /cms/site-state/:subdomain, for the live case of P9 and a few neighbours. Local only: it listens on 127.0.0.1.
// Usage: node scripts/v3-public/fake-backend-p9.mjs [port]   (default 3199), or import { startFakeBackend, SITES } from this file.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const wrap = (data) => ({ success: true, statusCode: 200, message: 'Success', data, timestamp: new Date().toISOString() });

const baseCms = {
  id: 'cms1', vendorId: 'v1', businessName: 'Plumber Boy', tagline: null, about: 'Quick plumbing repairs at your door.', logo: null, banner: '/starter/generic/hero.svg', favicon: null, themeId: null,
  seoTitle: null, seoDesc: null, seoKeywords: null, phone: '+91 98765 43210', email: null, address: null, businessHours: null, whatsapp: null, facebook: null, instagram: null, linkedin: null,
  youtube: null, googleMaps: null, googleAnalyticsId: null, portfolio: null, layout: null, ogImage: null, testimonials: [], pages: null, packKey: null, siteStatus: 'LIVE', designKey: null, extras: null,
};
const product = (n, d) => ({ id: `p-${n}`, name: n, description: d, price: null, image: null, category: null, customFields: null });

/** The live case: Free plan, industry text 'Home repair and trades', no theme, no logo, no address, a phone, banner /starter/generic/hero.svg. */
export const PLUMBERBOY = {
  vendor: { id: 'v1', businessName: 'Plumber Boy', industry: 'Home repair and trades', subdomain: 'plumberboy' },
  cms: baseCms, docV2: true, pack: null, preview: false, indexable: false, themeRef: null, themeNotice: null, pagesLimit: 1, plan: 'FREE',
  products: [product('Tap and pipe repair', 'Leaks fixed the same day'), product('Bathroom fittings', 'Supply and fitting')], theme: null, paymentsEnabled: false, checkoutMode: 'NONE',
};

export const SITES = {
  plumberboy: PLUMBERBOY,
  // the live case again under a second name (used to prove which API address the renderer asks)
  'plumberboy-b': { ...PLUMBERBOY, vendor: { ...PLUMBERBOY.vendor, subdomain: 'plumberboy-b' } },
  // a themed Pro site: its theme package is asked from the same API (the package route below answers 404 for it, so the page falls back to the built-in design)
  'themed-pro': { ...PLUMBERBOY, vendor: { ...PLUMBERBOY.vendor, businessName: 'Themed Pro', industry: 'general', subdomain: 'themed-pro' }, cms: { ...baseCms, businessName: 'Themed Pro', tagline: 'A themed site', email: 'hello@example.com' }, plan: 'PRO', docV2: true,
    pack: { key: 'general', name: 'General', config: {} }, themeRef: { id: 't-missing', key: 'sample-theme', version: 1, name: 'Sample' } },
  // a Pro site whose industry text is unknown: must render the generic design
  'pro-unknown': { ...PLUMBERBOY, vendor: { ...PLUMBERBOY.vendor, businessName: 'Pro Unknown', subdomain: 'pro-unknown' }, cms: { ...baseCms, businessName: 'Pro Unknown', email: 'hello@example.com' }, plan: 'PRO', docV2: false },
  // a Pro site with no plan field at all and an unknown industry (an older answer)
  'old-unknown': { ...PLUMBERBOY, vendor: { ...PLUMBERBOY.vendor, businessName: 'Old Unknown', subdomain: 'old-unknown' }, cms: { ...baseCms, businessName: 'Old Unknown' }, plan: undefined, docV2: false },
};
const STATE = { 'draft-site': { exists: true, status: 'DRAFT' } };

export function startFakeBackend(port = 3199) {
  const log = [];
  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    log.push(`${req.method} ${u.pathname}`);
    const json = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const pk = /^\/themes\/package\/([a-z0-9-]+)$/.exec(u.pathname);
    if (pk) return pk[1] === 't1' ? json(200, wrap({ id: 't1', manifest: { id: 'sample' }, pages: [], assets: [] })) : json(404, { success: false, statusCode: 404, message: 'Theme not found' });
    const m = /^\/cms\/(site|site-state)\/([a-z0-9-]+)$/.exec(u.pathname);
    if (!m) return json(404, { success: false, statusCode: 404, message: 'Not found' });
    const [, kind, sub] = m;
    if (kind === 'site') return SITES[sub] ? json(200, wrap(JSON.parse(JSON.stringify(SITES[sub])))) : json(404, { success: false, statusCode: 404, message: 'Site not found' });
    json(200, wrap(SITES[sub] ? { exists: true, status: 'LIVE' } : STATE[sub] ?? { exists: false, status: 'NOT_FOUND' }));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, log, port: server.address().port, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 3199);
  await startFakeBackend(port);
  console.log(`fake backend on http://127.0.0.1:${port}`);
}
