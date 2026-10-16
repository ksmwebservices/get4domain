import { CategorySeed } from '../site-doc/seeds/seed.types';
import { CATEGORY_SEEDS } from '../site-doc/industry-seeds';
import { PackConfig } from '../site-doc/pack.types';
import { publicPackConfig } from '../site-doc/pack-resolve';
import { fillSeedText } from '../site-doc/starter.service';

/**
 * A full sample site for one category, built from the category's starter content and nothing else (no vendor data). The admin preview of a theme and the "preview with
 * my own content" thumbnails use the same renderer; this is what the admin sees for every compatible category. Safe to serve publicly: it holds only starter text.
 */
export interface SampleSite {
  vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
  cms: Record<string, unknown>;
  products: Record<string, unknown>[];
  paymentsEnabled: boolean;
  checkoutMode: 'ONLINE' | 'ORDER_REQUEST' | 'NONE';
  docV2: true;
  preview: true;
  sample: true;
  pack: { key: string; name: string; config: PackConfig };
}

const priceOf = (p: string): string | null => { const t = (p ?? '').trim(); return t ? t : null; };

export function buildSampleSite(pack: { key: string; name: string; config: PackConfig }): SampleSite {
  const c = pack.config;
  const seed = c.seed;
  const meta = CATEGORY_SEEDS.find((s: CategorySeed) => s.key === pack.key);
  const business = `Sample ${meta?.name ?? pack.name}`;
  const v = { business, city: 'Chennai', phone: '9876543210' };
  const fill = (t: string): string => fillSeedText(t, v);
  const terms = c.shell?.terms;
  const gallery = seed?.images.gallery ?? [];
  const team = [1, 2, 3].map((n) => ({ id: `sample-team-${n}`, name: `${terms?.teamOne ?? 'Team member'} ${n}`, role: terms?.teamOne ?? 'Team member', note: 'Sample entry', image: gallery[n % Math.max(gallery.length, 1)] }));
  const cart = c.family === 'shop' || c.family === 'menu';
  return {
    vendor: { id: 'sample', businessName: business, industry: pack.key, subdomain: 'sample' },
    cms: {
      businessName: business, tagline: seed ? fill(seed.tagline) : business, about: seed ? fill(seed.about) : '', logo: null, banner: seed?.images.hero ?? null,
      phone: v.phone, whatsapp: v.phone, email: 'hello@example.com', address: '12 Sample Street, Chennai', businessHours: 'Mon-Sat 9 am to 7 pm; Sun closed',
      facebook: 'https://facebook.com/sample', instagram: 'https://instagram.com/sample', youtube: 'https://youtube.com/@sample', linkedin: 'https://linkedin.com/company/sample', googleMaps: 'https://maps.google.com/?q=Chennai',
      seoTitle: null, seoDesc: null, seoKeywords: null, favicon: null, ogImage: null, googleAnalyticsId: null,
      portfolio: gallery.map((src, i) => ({ id: `g${i}`, src, title: `Sample picture ${i + 1}`, category: '' })),
      testimonials: (seed?.quotes ?? []).map((q) => ({ quote: q.quote, author: q.author })),
      pages: [], layout: {}, designKey: null, siteStatus: 'LIVE',
      extras: {
        headline: seed ? fill(seed.headline) : business, subline: seed ? fill(seed.subline) : '', ctaLabel: seed?.cta ?? c.ctaLabel, announcement: seed ? fill(seed.announce) : '',
        trust: (seed?.trust ?? []).map(fill), faq: (seed?.faq ?? c.defaults.faq).map((f) => ({ q: fill(f.q), a: fill(f.a) })), steps: (seed?.steps ?? []).map((s) => ({ title: s.title, desc: s.desc })),
        stats: [{ value: 'Sample', label: 'number' }, { value: 'Sample', label: 'number' }, { value: 'Sample', label: 'number' }], team,
        social: { x: 'https://x.com/sample', customLabel: 'Blog', customUrl: 'https://example.com/blog' },
      },
    },
    products: (seed?.items ?? []).map((it, i) => ({
      id: `sample-item-${i + 1}`, name: fill(it.title), description: fill(it.desc), price: priceOf(it.price), image: gallery[i % Math.max(gallery.length, 1)] ?? null, category: it.category || null,
      customFields: Object.fromEntries(Object.entries(it.fields ?? {}).map(([k, val]) => [k, fill(val)])),
    })),
    paymentsEnabled: false, checkoutMode: cart ? 'ORDER_REQUEST' : 'NONE', docV2: true, preview: true, sample: true,
    pack: { key: pack.key, name: pack.name, config: publicPackConfig(c) },
  };
}
