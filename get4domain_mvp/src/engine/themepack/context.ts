import type { EngineSiteData } from '../types';
import type { ShellRuntime } from '../shell/types';
import { packShellOf } from '../shell/build-shell';
import { extrasOf, type PageSet, type SiteGroup, type SiteItem } from './data';

/**
 * The data a theme template can read through {{slots}} and data-g4d-each lists, built only from the vendor's own site document. A slot with nothing behind it is empty, and the
 * block that shows it can hide itself with data-g4d-if. Customer quotes marked sample are left out (they never reach a public page).
 */
interface Ex {
  headline?: string; subline?: string; ctaLabel?: string;
  trust?: string[]; faq?: { q: string; a: string }[]; steps?: { title: string; desc?: string }[]; stats?: { value: string; label: string }[]; team?: { id?: string; name: string; role?: string; note?: string; image?: string }[];
}

export function buildContext(site: EngineSiteData, o: { shell: ShellRuntime; pageSet: PageSet; items: SiteItem[]; groups: SiteGroup[]; item?: SiteItem; page?: { title: string; body: string; slug: string }; publicUrl: string }): Record<string, unknown> {
  const cms = site.cms;
  const ex = extrasOf(site) as unknown as Ex;
  const name = (cms?.businessName || site.vendor.businessName || '').trim();
  const phone = cms?.phone?.trim() || '';
  const wa = (cms?.whatsapp || cms?.phone || '').trim();
  const about = cms?.about?.trim() || '';
  const gallery = (cms?.portfolio ?? []).filter((g) => g.src).map((g, i) => ({ src: g.src, alt: g.title || g.alt || `${name} picture ${i + 1}`, title: g.title || '' }));
  const terms = packShellOf(site).terms;
  const quotes = (cms?.testimonials ?? []).filter((t) => t.quote && t.author && !(t as { sample?: boolean }).sample).map((t) => ({ quote: t.quote, author: t.author, note: t.note || '' }));
  const tagline = cms?.tagline?.trim() || '';
  return {
    site: { name, tagline, logo: cms?.logo?.trim() || '', favicon: cms?.favicon?.trim() || '', year: String(new Date().getFullYear()), url: o.publicUrl },
    hero: { title: ex.headline?.trim() || tagline || name, subtitle: ex.subline?.trim() || about.split(/\n/)[0].slice(0, 220), image: cms?.banner?.trim() || '', cta: o.shell.primaryLabel },
    about: { title: `About ${name}`, text: about, image: gallery[0]?.src ?? '' },
    contact: { phone, phoneHref: phone ? `tel:${phone}` : '', whatsapp: o.shell.social.whatsapp ?? (wa ? `https://wa.me/${wa.replace(/\D/g, '')}` : ''), email: cms?.email?.trim() || '', address: cms?.address?.trim() || '', mapUrl: cms?.googleMaps?.trim() || '' },
    hours: cms?.businessHours?.trim() || '',
    social: { instagram: o.shell.social.instagram ?? '', facebook: o.shell.social.facebook ?? '', youtube: o.shell.social.youtube ?? '', linkedin: o.shell.social.linkedin ?? '', x: o.shell.social.x ?? '', whatsapp: o.shell.social.whatsapp ?? '', maps: o.shell.social.maps ?? '', custom: o.shell.social.custom ?? '', customLabel: o.shell.social.customLabel ?? '' },
    terms,
    cta: { label: o.shell.primaryLabel },
    page: o.page ?? { title: '', body: '', slug: '' },
    item: o.item,
    items: o.items, groups: o.groups,
    team: (ex.team ?? []).filter((m) => m.name).map((m, i) => ({ id: m.id || `team-${i + 1}`, name: m.name, role: m.role || terms.teamOne, note: m.note || '', image: m.image || '' })),
    testimonials: quotes,
    faqs: (ex.faq ?? []).filter((f) => f.q && f.a),
    gallery,
    steps: (ex.steps ?? []).filter((s) => s.title).map((s, i) => ({ title: s.title, desc: s.desc || '', n: String(i + 1) })),
    trust: (ex.trust ?? []).filter(Boolean).map((t) => ({ text: t })),
    stats: (ex.stats ?? []).filter((s) => s.value && s.label),
    pages: [{ title: 'Home', href: o.pageSet.home }, ...o.pageSet.all.map((p) => ({ title: p.navLabel, href: p.href }))],
  };
}
