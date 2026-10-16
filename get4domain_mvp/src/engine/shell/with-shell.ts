import type { EngineSiteData } from '../types';
import type { KitSiteModel } from '../kit/model';
import { packOf } from '../sitedoc/build';
import { buildShell } from './build-shell';
import type { ShellRuntime } from './types';

const BOOKING = new Set(['BOOKING', 'APPOINTMENT', 'SITE_VISIT']);

/**
 * Gives a built-in design the engine shell (popup, bottom navigation, footer with social icons, quick view, floating contact): the words, the five bottom-navigation slots and
 * the popup steps come from the category pack, the contact details, hours and links from the vendor's own site. A built-in design is one long page, so its slots point at
 * anchors on the home page; on any other page they point back to the home page's anchors.
 */
export function withShell(model: KitSiteModel, site: EngineSiteData, o: { mode: ShellRuntime['mode']; cart: boolean; base: string; onHome: boolean }): KitSiteModel {
  const pack = packOf(site);
  const home = o.onHome ? '' : o.base;
  const anchor = (id: string): string | undefined => (model.sections.some((s) => (s as { id?: string }).id === id) ? `${home}#${id}` : undefined);
  const pages: Record<string, string> = {};
  for (const p of site.cms?.pages ?? []) pages[p.slug] = `${o.base}/p/${p.slug}`;
  const nav = model.nav.map((n) => (n.href.startsWith('#') ? { label: n.label, href: `${home}${n.href}` } : { label: n.label, href: n.href }));
  const shell = buildShell(site, {
    base: o.base, family: pack.family ?? 'enquiry', goal: BOOKING.has(pack.goal) ? 'booking' : 'enquiry', primaryLabel: (((site.cms as { extras?: { navigation?: { primaryLabel?: string } } } | null)?.extras?.navigation?.primaryLabel) || model.primaryCta.label).slice(0, 24), mode: o.mode, cart: o.cart,
    targets: { home: o.onHome ? '#top' : o.base, items: anchor('services'), team: anchor('team'), gallery: anchor('gallery'), about: anchor('about'), contact: anchor('enquiry') ?? anchor('contact'), pages, nav: [{ label: 'Home', href: o.onHome ? '#top' : o.base }, ...nav] },
  });
  return { ...model, shell };
}
