import type { EngineSiteData } from '../types';
import type { KitBrand, KitItem } from './model';

/** Build the brand block from a vendor's CMS (or the demo content injected as CMS).
 *  `defaults.name` is the reference demo business name (e.g. "CareWell Clinic") used
 *  when no real vendor/demo name is supplied (preview + demo). */
export function brandFrom(site: EngineSiteData, defaults: { name: string; tagline: string; about: string }): KitBrand {
  const cms = site.cms;
  return {
    name: cms?.businessName || site.vendor.businessName || defaults.name,
    tagline: cms?.tagline || defaults.tagline,
    about: cms?.about || defaults.about,
    logo: cms?.logo || undefined,
    phone: cms?.phone || undefined,
    whatsapp: cms?.whatsapp || cms?.phone || undefined,
    email: cms?.email || undefined,
    address: cms?.address || undefined,
    businessHours: cms?.businessHours || undefined,
  };
}

const priceStr = (p?: string | null): string | undefined => {
  if (!p) return undefined;
  const t = p.trim();
  if (!t) return undefined;
  return /^[₹$]/.test(t) ? t : `₹${t}`;
};

/**
 * Real vendor products → kit items when present; otherwise the industry's seed items.
 * customFields map to meta rows + tags so a vendor's catalogue renders richly.
 */
export function itemsFrom(site: EngineSiteData, seed: KitItem[]): KitItem[] {
  if (!site.products.length) return seed;
  return site.products.map((p) => {
    const cf = p.customFields ?? {};
    const meta = Object.entries(cf)
      .filter(([k, v]) => k !== 'tags' && typeof v === 'string' && v.trim())
      .slice(0, 4)
      .map(([k, v]) => ({ label: k.replace(/[_-]/g, ' '), value: v }));
    const tags = typeof cf.tags === 'string' && cf.tags.trim() ? cf.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    return {
      title: p.name,
      subtitle: p.category || undefined,
      price: priceStr(p.price),
      image: p.image || undefined,
      desc: p.description || undefined,
      tags,
      meta: meta.length ? meta : undefined,
    };
  });
}

/** Whether the site is showing real vendor content (vs seed). */
export const hasRealItems = (site: EngineSiteData): boolean => site.products.length > 0;

/** A broad pool of royalty-free imagery, grouped loosely so builders pick fitting shots. */
export const IMG = {
  clinic: ['/demo-library/pexels-263402.jpg', '/demo-library/pexels-40568.jpg', '/demo-library/pexels-305566.jpg', '/demo-library/pexels-4225880.jpg'],
  salon: ['/demo-library/pexels-3993449.jpg', '/demo-library/pexels-3997379.jpg', '/demo-library/pexels-705255.jpg', '/demo-library/pexels-3738349.jpg'],
  gym: ['/demo-library/pexels-1954524.jpg', '/demo-library/pexels-416778.jpg', '/demo-library/pexels-136404.jpg', '/demo-library/pexels-949126.jpg'],
  hotel: ['/demo-library/pexels-258154.jpg', '/demo-library/pexels-271624.jpg', '/demo-library/pexels-164595.jpg', '/demo-library/pexels-338504.jpg'],
  events: ['/demo-library/pexels-1616113.jpg', '/demo-library/pexels-169198.jpg', '/demo-library/pexels-1190298.jpg', '/demo-library/pexels-2291367.jpg'],
  travel: ['/demo-library/pexels-2325446.jpg', '/demo-library/pexels-3155666.jpg', '/demo-library/pexels-1287460.jpg', '/demo-library/pexels-1051073.jpg'],
  education: ['/demo-library/pexels-159711.jpg', '/demo-library/pexels-289737.jpg', '/demo-library/pexels-1370296.jpg', '/demo-library/pexels-256541.jpg'],
  restaurant: ['/demo-library/pexels-262978.jpg', '/demo-library/pexels-1640777.jpg', '/demo-library/pexels-70497.jpg', '/demo-library/pexels-958545.jpg'],
  retail: ['/demo-library/pexels-994523.jpg', '/demo-library/pexels-291762.jpg', '/demo-library/pexels-1884581.jpg', '/demo-library/pexels-322207.jpg'],
  agriculture: ['/demo-library/pexels-2933243.jpg', '/demo-library/pexels-1112080.jpg', '/demo-library/pexels-440731.jpg', '/demo-library/pexels-2382904.jpg'],
  automobile: ['/demo-library/pexels-3802510.jpg', '/demo-library/pexels-244553.jpg', '/demo-library/pexels-97075.jpg', '/demo-library/pexels-3807277.jpg'],
  construction: ['/demo-library/pexels-1170412.jpg', '/demo-library/pexels-159306.jpg', '/demo-library/pexels-2219024.jpg', '/demo-library/pexels-439416.jpg'],
  technology: ['/demo-library/pexels-1181671.jpg', '/demo-library/pexels-546819.jpg', '/demo-library/pexels-3861958.jpg', '/demo-library/pexels-1714208.jpg'],
  logistics: ['/demo-library/pexels-1427107.jpg', '/demo-library/pexels-906494.jpg', '/demo-library/pexels-3057960.jpg', '/demo-library/pexels-1267338.jpg'],
  finance: ['/demo-library/pexels-210607.jpg', '/demo-library/pexels-6693661.jpg', '/demo-library/pexels-534216.jpg', '/demo-library/pexels-259027.jpg'],
  professional: ['/demo-library/pexels-3184465.jpg', '/demo-library/pexels-1181406.jpg', '/demo-library/pexels-3184292.jpg', '/demo-library/pexels-416405.jpg'],
  diagnostics: ['/demo-library/pexels-4033148.jpg', '/demo-library/pexels-2280571.jpg', '/demo-library/pexels-3735747.jpg', '/demo-library/pexels-4021775.jpg'],
  photography: ['/demo-library/pexels-1264210.jpg', '/demo-library/pexels-1983037.jpg', '/demo-library/pexels-338936.jpg', '/demo-library/pexels-1926769.jpg'],
  coaching: ['/demo-library/pexels-3184328.jpg', '/demo-library/pexels-7096.jpg', '/demo-library/pexels-1181534.jpg', '/demo-library/pexels-4144923.jpg'],
};
