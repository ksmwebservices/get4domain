import type { EngineSiteData } from '../types';
import { hoursRows } from './hours';
import type { PackShell, ShellItem, ShellLink, ShellNavSlot, ShellRuntime, ShellSocial } from './types';

/**
 * Builds the shell's runtime data for one site from the category pack (the words, the five bottom-navigation slots, the popup steps) and the vendor's own site (name, contact,
 * hours, social links, items, team) with the vendor's own settings on top (labels, which optional popup fields to show, the confirmation message). Built-in designs and imported
 * themes call this with different `targets` (anchors on one page, or the addresses of separate pages); everything else is identical.
 */
export interface ShellTargets {
  home: string;
  items?: string; team?: string; gallery?: string; about?: string; contact?: string;
  /** the standard and vendor pages by address (slug), for bottom-navigation slots such as page:offers */
  pages: Record<string, string>;
  /** the links of the More sheet and the footer: every page of the site */
  nav: ShellLink[];
}

interface ExtrasShell {
  popup?: { email?: 'hidden' | 'optional' | 'required'; message?: 'hidden' | 'optional' | 'required'; confirm?: string };
  navigation?: { bottom?: { key: string; label: string }[]; primaryLabel?: string };
  social?: { x?: string; customLabel?: string; customUrl?: string };
  team?: { id?: string; name: string }[];
}

export const DEFAULT_SHELL: PackShell = {
  terms: { team: 'Team', teamOne: 'Team member', items: 'Services', itemOne: 'Service', groups: 'Categories' },
  bottomNav: [
    { key: 'home', label: 'Home', icon: 'home', target: 'home' }, { key: 'items', label: 'Services', icon: 'services', target: 'items' }, { key: 'action', label: 'Contact', icon: 'enquiry', target: 'action' },
    { key: 'about', label: 'About', icon: 'info', target: 'about' }, { key: 'more', label: 'More', icon: 'more', target: 'more' },
  ],
  popup: { title: 'Get in touch', steps: [{ key: 'details', kind: 'details', label: 'Your details', required: true }, { key: 'confirm', kind: 'confirm', label: 'Confirm' }], confirm: 'Thank you. We have your request and will get back to you shortly.' },
};

export const packShellOf = (site: EngineSiteData): PackShell => ((site.pack?.config as { shell?: PackShell } | undefined)?.shell ?? DEFAULT_SHELL);

export function buildShell(site: EngineSiteData, opts: { base: string; family: string; goal: string; primaryLabel: string; mode: ShellRuntime['mode']; targets: ShellTargets; cart: boolean }): ShellRuntime {
  const cms = site.cms;
  const ex = ((cms as { extras?: ExtrasShell } | null)?.extras ?? {}) as ExtrasShell;
  const shell = packShellOf(site);
  const name = (cms?.businessName || site.vendor.businessName || '').trim();
  const phone = cms?.phone?.trim() || undefined;
  const wa = (cms?.whatsapp || cms?.phone || '').trim() || undefined;
  const social: ShellSocial = {
    instagram: cms?.instagram?.trim() || undefined, facebook: cms?.facebook?.trim() || undefined, youtube: cms?.youtube?.trim() || undefined, linkedin: cms?.linkedin?.trim() || undefined,
    x: ex.social?.x?.trim() || undefined, whatsapp: wa ? `https://wa.me/${wa.replace(/\D/g, '')}` : undefined, maps: cms?.googleMaps?.trim() || undefined,
    custom: ex.social?.customUrl?.trim() || undefined, customLabel: ex.social?.customLabel?.trim() || undefined,
  };
  const labels = new Map((ex.navigation?.bottom ?? []).map((b) => [b.key, b.label]));
  const t = opts.targets;
  const slots: ShellNavSlot[] = [];
  shell.bottomNav.forEach((s, i) => {
    const label = (labels.get(s.key) || s.label).slice(0, 14);
    const centre = i === 2;
    if (s.target === 'action') { slots.push({ key: s.key, label, icon: s.icon, kind: 'action' }); return; }
    if (s.target === 'cart') { slots.push(opts.cart ? { key: s.key, label, icon: s.icon, kind: 'cart' } : { key: s.key, label: centre ? (labels.get(s.key) || opts.primaryLabel).slice(0, 14) : label, icon: 'enquiry', kind: 'action' }); return; }
    if (s.target === 'more') { slots.push({ key: s.key, label, icon: s.icon, kind: 'more' }); return; }
    const href = s.target === 'home' ? t.home : s.target.startsWith('page:') ? t.pages[s.target.slice(5)] : (t as unknown as Record<string, string | undefined>)[s.target];
    if (href) slots.push({ key: s.key, label, icon: s.icon, kind: 'link', href });
  });
  // a slot whose page does not exist is left out; the bar still needs its main action in the middle
  if (!slots.some((s) => s.kind === 'action' || s.kind === 'cart')) slots.splice(Math.min(2, slots.length), 0, { key: 'action', label: opts.primaryLabel.slice(0, 14), icon: 'enquiry', kind: 'action' });
  const more: ShellLink[] = [...t.nav];
  if (phone) more.push({ label: `Call ${phone}`, href: `tel:${phone}`, external: true });
  if (social.whatsapp) more.push({ label: 'WhatsApp', href: social.whatsapp, external: true });
  for (const [k, label] of [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['linkedin', 'LinkedIn'], ['x', 'X']] as const) if (social[k]) more.push({ label, href: social[k]!, external: true });
  const items: ShellItem[] = site.products.slice(0, 60).map((p) => ({
    id: p.id, title: p.name, category: p.category ?? undefined, description: (p.description ?? '').slice(0, 400) || undefined, image: p.image ?? undefined,
    price: (p.customFields as Record<string, unknown> | null)?.samplePrice === 'true' ? 'Contact for price' : (p.price ? (/^[₹$]/.test(p.price) ? p.price : `₹${p.price}`) : undefined),
  }));
  const team = (ex.team ?? []).filter((m) => m.name).map((m, i) => ({ id: m.id || `team-${i + 1}`, name: m.name }));
  return {
    subdomain: site.vendor.subdomain ?? '', mode: opts.mode, base: opts.base, family: opts.family, goal: opts.goal === 'booking' ? 'booking' : 'enquiry',
    business: { name, phone, whatsapp: wa, email: cms?.email?.trim() || undefined, address: cms?.address?.trim() || undefined },
    popup: { title: shell.popup.title, steps: shell.popup.steps, confirm: (ex.popup?.confirm || shell.popup.confirm).slice(0, 300), email: ex.popup?.email ?? 'optional', message: ex.popup?.message ?? 'optional' },
    items, team, bottomNav: slots.slice(0, 5), more, social, hours: hoursRows(cms?.businessHours), cart: { enabled: opts.cart }, primaryLabel: opts.primaryLabel,
    legal: [{ label: 'Privacy', href: `${opts.base}/legal/privacy` }, { label: 'Terms', href: `${opts.base}/legal/terms` }],
    flowPath: `${opts.base}/${opts.family === 'menu' || opts.family === 'shop' ? 'order' : opts.goal === 'booking' ? 'book' : 'enquire'}`,
  };
}
