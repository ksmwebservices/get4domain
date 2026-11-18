import type { PackDemo } from '../../v3-packs/pack-demo/pack-demo';

/**
 * The server-side theme preview (TM1 M5). PURE: it lays the sample business of a pack over the kit's sample content and wraps what the renderer drew into a stand-alone page. It is the TypeScript twin of
 * the gallery script's overlay (scripts/build-theme-gallery.js): same rules, so the gallery and the preview routes show the same thing. A preview shows no price, no offer, no invented number and no
 * review: a sample figure could be read as a claim.
 */
export const PREVIEW_ENTITLEMENTS = { video: false, cart: false, booking: false, customDomain: false, callsToAction: true } as const;

/** Headers every preview carries: a strict content security policy (no script, no form, no frame, no outside request, sandboxed), no cookie, never cached by a shared cache, never indexed. */
export const PREVIEW_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; sandbox",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store',
  'Cross-Origin-Resource-Policy': 'same-site', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
});

/** Empties every price of a content tree (items, groups, blocks, products, offers). */
export function stripPrices(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripPrices);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, k === 'price' || k === 'priceFrom' || k === 'oldPrice' ? '' : stripPrices(x)]));
  return v;
}
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Obj = Record<string, unknown>;
/** The pack's sample business over the kit's sample content (a clinic shows clinic services, an accountant accounting services). */
export function previewContent(base: Obj, demo: PackDemo): Obj {
  const c = stripPrices(JSON.parse(JSON.stringify(base))) as Obj;
  const name = demo.business.name;
  c.site = { ...(c.site as Obj), name, tagline: demo.business.tagline, logoAlt: `${name} logo` };
  c.hero = { ...(c.hero as Obj), title: `${name} - ${demo.business.tagline}`, subtitle: demo.business.tagline, imageAlt: `${name} at work` };
  c.about = { ...(c.about as Obj), title: `About ${name}`, text: demo.business.about };
  c.contact = { ...(c.contact as Obj), city: demo.business.city, address: `12, Bazaar Street, ${demo.business.city}` };
  c.terms = { ...(c.terms as Obj), ...demo.terms };
  const items = demo.services.map((s, i) => ({ id: `item-${i + 1}`, slug: `item-${i + 1}`, name: s.name, description: s.description, price: '', image: `sample:item-${i + 1}`, href: `/item-${i + 1}`, badge: s.badge || (i === 0 ? 'Popular' : ''), category: 'Popular' }));
  c.items = items;
  c.groups = [{ name: 'Popular', slug: 'popular', count: Math.min(3, items.length), items: items.slice(0, 3) }];
  c.team = demo.people.map((p, i) => ({ id: `t${i + 1}`, name: p.name, role: p.role, note: '', image: `sample:team-${i + 1}` }));
  c.faqs = demo.faqs.map((f) => ({ q: f.question, a: f.answer }));
  c.areas = demo.areas.map((a) => ({ name: a }));
  c.hours = demo.hours;
  c.steps = demo.steps.map((s, i) => ({ n: i + 1, title: s.title, desc: s.description }));
  if (Array.isArray(c.blocks)) c.blocks = (c.blocks as Obj[]).map((b, i) => (demo.sections[i] ? { ...b, key: demo.sections[i].key, title: demo.sections[i].title, items: demo.sections[i].items.map((x) => ({ title: x.title, detail: x.detail, price: '' })) } : b));
  c.host = { ...(c.host as Obj), siteUrl: `https://${slug(name)}.get4domain.example` };
  c.products = Array.isArray(c.products) && c.products.length ? items.map((i) => ({ ...i })) : c.products;
  c.offers = [];
  c.stats = [];
  if (Array.isArray(c.blocks)) c.blocks = (c.blocks as Obj[]).map((b) => (/offer/i.test(String(b.key)) ? { ...b, items: [] } : b));
  c.reviews = { sample: true, summary: null, writeUrl: '', google: [] };
  c.testimonials = [];
  c.sample = true;
  return c;
}

const esc = (x: string): string => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A complete page around the renderer's fragment, with the theme's own stylesheets inlined. Nothing outside is loaded. */
export function previewDocument(a: { html: string; lang: string; themeName: string; css: { tokens?: string; base?: string; motion?: string; print?: string } }): string {
  const css = [a.css.tokens, a.css.base, a.css.motion, a.css.print].filter(Boolean).join('\n').replace(/<\/style/gi, '<\\/style');
  return `<!doctype html>
<html lang="${a.lang.slice(0, 2) === 'ta' ? 'ta' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(`${a.themeName} preview`)}</title>
<style>html,body{margin:0}
${css}</style>
</head>
<body>${a.html}</body>
</html>
`;
}

/** The page names a preview may ask for: a template of the theme, validated by the caller against the theme's own templates. */
export const PAGE_NAME = /^[a-z0-9-]{1,30}$/;
