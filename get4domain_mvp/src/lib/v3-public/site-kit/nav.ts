import type { SectionKey } from './themes';
import type { SiteView } from './view';

/**
 * Navigation of a vendor site, one list for both bars: the sticky bottom bar on a phone (Home, Services, Gallery, Reviews, then Call or Enquire) and the top bar on a
 * computer. A tab whose section is not on the page is left out, so the bar never points at nothing. On a Free (information only) site the last place is "Find us", an
 * in-page anchor: no call or enquiry link exists there. Pure.
 */
export interface NavItem { key: 'home' | 'services' | 'gallery' | 'reviews' | 'action' | 'find'; label: string; href: string; kind: 'anchor' | 'tel' | 'enquire' }

/** Which sections the page will draw, in the theme's order, given what the vendor has (a section with nothing to show is left out). */
export function visibleSections(view: SiteView, order: readonly SectionKey[]): SectionKey[] {
  const priced = view.items.filter((i) => i.price).length;
  const has: Record<SectionKey, boolean> = {
    hero: true,
    services: view.items.length > 0,
    gallery: view.gallery.length >= 2,
    reviews: view.reviews.length > 0,
    faq: view.faqs.length > 0,
    pricing: priced >= 3,
    map: !!view.address || view.hours.length > 0,
    contact: !!(view.phone || view.whatsapp || view.email),
  };
  return order.filter((k) => has[k]);
}

/** The address the main action opens: WhatsApp first, then e-mail, then the phone. null when the site is information only or has no way to be reached. */
export function enquiryHref(view: SiteView): { href: string; kind: 'whatsapp' | 'email' | 'tel' } | null {
  if (view.mode !== 'live') return null;
  const digits = (s: string): string => s.replace(/\D/g, '');
  if (view.whatsapp && digits(view.whatsapp).length >= 8) return { href: `https://wa.me/${digits(view.whatsapp)}`, kind: 'whatsapp' };
  if (view.email && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(view.email)) return { href: `mailto:${view.email}`, kind: 'email' };
  const tel = telHref(view.phone);
  return tel ? { href: tel, kind: 'tel' } : null;
}
export function telHref(phone: string | null): string | null {
  if (!phone) return null;
  const plus = phone.trim().startsWith('+');
  const d = phone.replace(/\D/g, '');
  return d.length >= 6 ? `tel:${plus ? '+' : ''}${d}` : null;
}

export function navItems(view: SiteView, sections: readonly SectionKey[]): NavItem[] {
  const has = (k: SectionKey): boolean => sections.includes(k);
  const out: NavItem[] = [{ key: 'home', label: 'Home', href: '#top', kind: 'anchor' }];
  if (has('services')) out.push({ key: 'services', label: 'Services', href: '#services', kind: 'anchor' });
  if (has('gallery')) out.push({ key: 'gallery', label: 'Gallery', href: '#gallery', kind: 'anchor' });
  if (has('reviews')) out.push({ key: 'reviews', label: 'Reviews', href: '#reviews', kind: 'anchor' });
  if (view.mode === 'live') {
    const tel = telHref(view.phone);
    const enq = enquiryHref(view);
    if (tel) out.push({ key: 'action', label: 'Call', href: tel, kind: 'tel' });
    else if (enq) out.push({ key: 'action', label: 'Enquire', href: enq.href, kind: 'enquire' });
  } else if (has('map')) out.push({ key: 'find', label: 'Find us', href: '#find', kind: 'anchor' });
  else if (has('contact')) out.push({ key: 'find', label: 'Contact', href: '#contact', kind: 'anchor' });
  return out.slice(0, 5);
}
