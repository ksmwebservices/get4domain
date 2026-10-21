import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { CartProvider, type CheckoutMode } from '../components/EngineCart';
import type { EngineSiteData } from '../types';
import { packOf } from '../sitedoc/build';
import { jsonLdFor } from '../sitedoc/build';
import { buildShell, packShellOf } from '../shell/build-shell';
import { ShellProvider } from '../shell/ShellProvider';
import ShellBottomNav from '../shell/ShellBottomNav';
import ShellFooter from '../shell/ShellFooter';
import { FloatingContact } from '../shell/ShellExtras';
import type { ShellRuntime } from '../shell/types';
import { buildContext } from './context';
import { extrasOf, groupsOf, itemsOf, pageSetOf, resolveRoute, type PageEntry, type PageSet, type Route, type SiteItem, type ThemeManifest, type ThemePackageData } from './data';
import { parsedPage, renderNodes, type RenderCtx } from './render';
import { submitFlow } from './actions';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
const SITE_BASE = (process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN || 'get4domain.com').toLowerCase();
const BOOKING = new Set(['BOOKING', 'APPOINTMENT', 'SITE_VISIT']);

/** A live theme package, cached for five minutes and refreshed when the theme changes (the tag is dropped on import). */
export async function fetchThemePackage(id: string): Promise<ThemePackageData | null> {
  try {
    const res = await fetch(`${API_BASE}/themes/package/${encodeURIComponent(id)}`, { next: { tags: [`theme:${id}`], revalidate: 300 } });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.data ?? j) as ThemePackageData;
  } catch { return null; }
}

export interface ThemeOptions {
  /** the address the pages live under, for example /site/ravi-clinic */
  base: string;
  mode: ShellRuntime['mode'];
  shop: boolean;
  checkoutMode: CheckoutMode;
  /** extra query string to keep on form redirects (a private preview link) */
  keep?: string;
  /** the result of the last form post, read from the address */
  flash?: { sent?: boolean; error?: string };
}

interface Prepared {
  manifest: ThemeManifest; set: PageSet; items: SiteItem[]; route: Route; flowOf: Record<string, string>;
}

function prepare(site: EngineSiteData, pkg: ThemePackageData, rest: string[], base: string): Prepared {
  const manifest = pkg.manifest;
  const set = pageSetOf(site, manifest, base);
  const items = itemsOf(site, set.itemBase, base);
  return { manifest, set, items, route: resolveRoute(rest, set, items, site), flowOf: {} };
}

export const routePath = (r: Route, set: PageSet): string => {
  switch (r.kind) {
    case 'home': return '';
    case 'page': return `/${r.entry.slug}`;
    case 'item': return `/${set.itemBase}/${r.item.slug}`;
    case 'vendor': return `/p/${r.entry.slug}`;
    case 'flow': return `/${r.flow}`;
    case 'legal': return `/legal/${r.which}`;
    default: return '';
  }
};

/** Title, description, canonical address and robots for any page of a themed site. A page that does not exist answers 404. */
export function themeMetadata(site: EngineSiteData, pkg: ThemePackageData, rest: string[], o: { base: string; subdomain: string; preview: boolean }): Metadata {
  const { route, set, items } = prepare(site, pkg, rest, o.base);
  if (route.kind === 'notfound') notFound();
  const cms = site.cms;
  const name = (cms?.businessName || site.vendor.businessName || '').trim();
  const homeTitle = cms?.seoTitle?.trim() || `${name} — ${cms?.tagline?.trim() || 'Official Website'}`;
  const about = (cms?.about || '').replace(/\s+/g, ' ').trim();
  let title = homeTitle; let description = cms?.seoDesc?.trim() || about.slice(0, 155) || `${name} — official website.`;
  let image = cms?.ogImage || cms?.banner || cms?.logo || undefined;
  if (route.kind === 'page') { title = `${route.entry.title} | ${name}`; description = `${route.entry.title} at ${name}. ${about.slice(0, 120)}`.trim(); }
  if (route.kind === 'vendor') { title = `${route.entry.title} | ${name}`; const body = ((cms?.pages ?? []).find((p) => p.slug === route.entry.slug)?.body ?? '').replace(/\s+/g, ' ').trim(); description = body.slice(0, 155) || description; }
  if (route.kind === 'item') { title = `${route.item.name} | ${name}`; description = (route.item.description || `${route.item.name} at ${name}.`).replace(/\s+/g, ' ').slice(0, 155); image = route.item.image || image; }
  if (route.kind === 'flow') title = `${({ book: 'Book an appointment', enquire: 'Send an enquiry', order: 'Place an order' })[route.flow]} | ${name}`;
  if (route.kind === 'legal') title = `${route.which === 'privacy' ? 'Privacy policy' : 'Terms of use'} | ${name}`;
  void items; void set;
  const noindex = o.preview || (site as { indexable?: boolean }).indexable === false || route.kind === 'flow' || route.kind === 'legal';
  const canonical = `https://${o.subdomain}.${SITE_BASE}${routePath(route, set)}`;
  return {
    title: { absolute: title }, description, ...(cms?.favicon ? { icons: { icon: cms.favicon } } : {}),
    ...(noindex ? { robots: { index: false, follow: route.kind !== 'flow' } } : {}),
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical, images: image ? [{ url: image, alt: name }] : [] },
  };
}

/** Structured data for a page: the business on the home page, the service or product on an item page. Real values only. */
export function themeJsonLd(site: EngineSiteData, route: Route, url: string): Record<string, unknown> | null {
  if (route.kind === 'home') return jsonLdFor(site, url) as unknown as Record<string, unknown>;
  if (route.kind === 'item') {
    const i = route.item;
    const price = /^₹?\s*[\d,]+(\.\d+)?$/.test(i.price) ? i.price.replace(/[^\d.]/g, '') : '';
    return { '@context': 'https://schema.org', '@type': 'Service', name: i.name, description: i.description || undefined, image: i.image || undefined, provider: { '@type': 'LocalBusiness', name: site.cms?.businessName || site.vendor.businessName }, ...(price ? { offers: { '@type': 'Offer', price, priceCurrency: 'INR' } } : {}) };
  }
  return null;
}

/** The colour and size variables the theme sets on its root (`:root { --g4d-accent: ... }` becomes a rule on its scope). They are handed to the engine's own parts (phone bar, popup, cart) from outside the theme's scope, so the theme's class names can never restyle them. */
function rootVarsOf(css: string, id: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(String.raw`(?:^|\})\s*\.g4d-theme-` + id.replace(/[^a-z0-9-]/g, '') + String.raw`\s*\{([^{}]*)\}`, 'g');
  for (const m of css.matchAll(re)) for (const d of m[1].split(';')) { const i = d.indexOf(':'); const k = d.slice(0, i).trim(); const v = d.slice(i + 1).trim(); if (/^--[a-z0-9-]+$/i.test(k) && v && !/[<>{}]|url\(/i.test(v)) out[k] = v; }
  return out;
}

const cssSafe = (css: string, assetBase: string, assets: Map<string, string>): string =>
  css.replace(/asset:\/\/([^"')\s]+)/g, (_m, p: string) => { const f = assets.get(p); return f ? `${assetBase}${f}` : ''; }).replace(/<\/(style)/gi, '<\\/$1');

/** The whole themed site for one address: the theme's page filled with the vendor's data inside the engine's shell, or one of the engine's own pages (form, legal). */
export default function ThemeSite({ site, pkg, rest, opts, subdomain }: { site: EngineSiteData; pkg: ThemePackageData; rest: string[]; opts: ThemeOptions; subdomain: string }) {
  const { base } = opts;
  const { manifest, set, items, route } = prepare(site, pkg, rest, base);
  if (route.kind === 'notfound') notFound();
  const pack = packOf(site);
  const family = pack.family ?? manifest.families[0] ?? 'enquiry';
  const goal = BOOKING.has(pack.goal) ? 'booking' : 'enquiry';
  const ex = extrasOf(site) as { navigation?: { primaryLabel?: string; header?: { label: string; target: string }[] } };
  const primaryLabel = (ex.navigation?.primaryLabel || pack.ctaLabel || 'Get in touch').slice(0, 24);
  const cartOn = opts.shop && !!subdomain && opts.mode === 'live';
  const mfPages = new Map(manifest.pages.map((p) => [p.slug, p]));
  const navEntries: PageEntry[] = [{ slug: '', template: 'home', title: 'Home', navLabel: 'Home', href: base }, ...set.all.filter((p) => p.vendor || mfPages.get(p.slug)?.nav !== false)];
  const pageHref: Record<string, string> = { home: base, index: base };
  for (const p of set.all) pageHref[p.slug.toLowerCase()] = p.href;
  // the vendor's own header items (Navigation tab) replace the automatic list; a target is a page address, home, p:<their page> or a web, phone or e-mail link
  const resolveTarget = (t: string): string => (t === 'home' ? base : t.startsWith('p:') ? `${base}/p/${t.slice(2)}` : /^(https?:|tel:|mailto:)/i.test(t) ? t : pageHref[t.toLowerCase()] ?? base);
  const hdrItems = (ex.navigation as { header?: { label: string; target: string }[] } | undefined)?.header?.filter((h) => h.label && h.target).slice(0, 8) ?? [];
  const headerNav: PageEntry[] = hdrItems.length ? hdrItems.map((h) => ({ slug: '', template: '', title: h.label, navLabel: h.label.slice(0, 24), href: resolveTarget(h.target) })) : navEntries;
  const find = (...slugs: string[]): string | undefined => slugs.map((s) => set.standard.find((p) => p.slug === s)?.href).find(Boolean);
  const shell = buildShell(site, {
    base, family, goal, primaryLabel, mode: opts.mode, cart: cartOn,
    targets: { home: base, items: set.itemBase ? `${base}/${set.itemBase}` : find('services', 'menu', 'packages', 'properties', 'courses'), team: find('doctors', 'about'), gallery: find('gallery', 'portfolio'), about: find('about'), contact: find('contact'), pages: pageHref, nav: navEntries.map((p) => ({ label: p.navLabel, href: p.href })) },
  });
  const assets = new Map(pkg.assets.map((a) => [a.path, a.name]));
  const assetBase = `${API_BASE}/themes/assets/${pkg.id}/`;
  const groups = groupsOf(items);
  const publicUrl = `https://${subdomain}.${SITE_BASE}`;
  const cls = `g4d-theme-${manifest.id}`;
  const annEx = extrasOf(site) as { announcement?: string; announcementLink?: string };
  const announcement = annEx.announcement?.trim() ? { text: annEx.announcement.trim().slice(0, 200), href: ['https://', 'http://', '#', 'tel:', '/'].some((p) => (annEx.announcementLink ?? '').toLowerCase().startsWith(p)) ? annEx.announcementLink : undefined } : null;
  const name = shell.business.name;

  let body: ReactNode;
  if (route.kind === 'flow') body = <FlowForm shell={shell} flow={route.flow} family={family} items={items} keep={opts.keep} nav={navEntries} flash={opts.flash} />;
  else if (route.kind === 'legal') body = <LegalPage shell={shell} which={route.which} nav={navEntries} site={site} />;
  else {
    const template = route.kind === 'home' ? 'home' : route.kind === 'item' ? 'item' : route.kind === 'vendor' ? 'page' : route.entry.template;
    const html = pkg.pages[template] ?? pkg.pages.page ?? pkg.pages.home ?? '';
    const vendorPage = route.kind === 'vendor' ? { title: route.entry.title, body: route.body, slug: route.entry.slug } : route.kind === 'page' && template === 'page' ? { title: route.entry.title, body: '', slug: route.entry.slug } : undefined;
    const data = buildContext(site, { shell, pageSet: set, items, groups, item: route.kind === 'item' ? route.item : undefined, page: vendorPage, publicUrl });
    const ctx: RenderCtx = { base, assetBase, assets, data, shell, nav: headerNav, pageHref, groups, state: { h1: false, images: 0, n: 0, bottomNavPlaced: false } };
    const rendered = renderNodes(parsedPage(`${pkg.id}:${pkg.version}:${template}`, html), [], ctx, template);
    // the engine adds the header and the footer itself when a page does not place them, because every site needs both
    body = (
      <>
        {!/<g4d-header-nav/i.test(html) && <EngineHeader shell={shell} nav={navEntries} />}
        {rendered}
        {!/<g4d-footer/i.test(html) && <ShellFooter runtime={shell} variant="columns" tagline={buildTagline(site)} links={navEntries.map((p) => ({ label: p.navLabel, href: p.href }))} />}
      </>
    );
  }

  const ld = themeJsonLd(site, route, `${publicUrl}${routePath(route, set)}`);
  const vars = Object.fromEntries(Object.entries(manifest.cssVars ?? {}).filter(([k]) => /^--g4d-[a-z0-9-]+$/.test(k)));
  // the theme's class and colours sit on the outermost element so the cart, the popup and the bottom bar (which sit beside the page, not inside it) wear the theme's colours too
  const wrap = { display: 'contents', ...rootVarsOf(pkg.css, manifest.id), ...vars, ['--eng-accent' as string]: 'var(--g4d-accent, #0f766e)', ['--eng-accent-fg' as string]: 'var(--g4d-accent-fg, #ffffff)' } as CSSProperties;
  return (
    <div style={wrap} data-g4d-theme={manifest.id}>
    <CartProvider enabled={cartOn} subdomain={subdomain} brandName={name} mode={opts.checkoutMode}>
      <ShellProvider runtime={shell}>
        {pkg.googleFonts.map((href) => <link key={href} rel="stylesheet" href={href} precedence="g4d-fonts" />)}
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: cssSafe(pkg.css, assetBase, assets) }} />
        {ld && /* eslint-disable-next-line react/no-danger */ <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />}
        {announcement && <AnnounceStrip text={announcement.text} href={announcement.href} />}
        <div className={cls}>{body}</div>
        <ShellBottomNav />
        <FloatingContact runtime={shell} />
      </ShellProvider>
    </CartProvider>
    </div>
  );
}

/** The announcement bar (the vendor's own words from the Page content tab), drawn by the engine above any theme. */
function AnnounceStrip({ text, href }: { text: string; href?: string }) {
  const inner = <span>{text}</span>;
  return <div role="status" className="bg-[var(--sh-accent)] px-4 py-2 text-center text-sm font-medium text-[var(--sh-accent-fg)]" data-g4d-announce>{href ? <a href={href} className="underline">{inner}</a> : inner}</div>;
}

const buildTagline = (site: EngineSiteData): string => site.cms?.tagline?.trim() || '';

/** A plain header in the page's own colours: the business, the pages and the main action. Used when a theme page has no header of its own. */
function EngineHeader({ shell, nav }: { shell: ShellRuntime; nav: PageEntry[] }) {
  return (
    <header className="border-b border-[var(--sh-border)] bg-[var(--sh-bg)] px-5 py-4 text-[var(--sh-fg)]" data-g4d-header>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <a href={shell.base} className="text-lg font-semibold">{shell.business.name}</a>
        <nav aria-label="Main" className="hidden gap-5 text-sm md:flex">{nav.filter((p) => p.href !== shell.base).slice(0, 6).map((p) => <a key={p.href} href={p.href} className="hover:text-[var(--sh-accent)]">{p.navLabel}</a>)}</nav>
        <a href={shell.flowPath} data-g4d-open="primary" className="inline-flex min-h-[44px] items-center bg-[var(--sh-accent)] px-4 text-sm font-semibold text-[var(--sh-accent-fg)]" style={{ borderRadius: 'var(--sh-radius)' }}>{shell.primaryLabel}</a>
      </div>
    </header>
  );
}

function Chrome({ shell, nav, children, title }: { shell: ShellRuntime; nav: PageEntry[]; children: ReactNode; title?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--sh-bg)] pb-20 text-[var(--sh-fg)] md:pb-0" style={{ ['--sh-bg' as string]: 'var(--g4d-bg, #ffffff)' }}>
      <header className="border-b border-[var(--sh-border)] px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <a href={shell.base} className="text-lg font-semibold">{shell.business.name}</a>
          <nav aria-label="Main" className="hidden gap-5 text-sm md:flex">{nav.filter((p) => p.href !== shell.base).slice(0, 6).map((p) => <a key={p.href} href={p.href} className="hover:text-[var(--sh-accent)]">{p.navLabel}</a>)}</nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">{title && <h1 className="mb-6 text-3xl font-semibold">{title}</h1>}{children}</main>
      <ShellFooter runtime={shell} variant="minimal" links={nav.map((p) => ({ label: p.navLabel, href: p.href }))} />
    </div>
  );
}

const ERRORS: Record<string, string> = {
  name: 'Please enter your name.', phone: 'Please enter a 10-digit mobile number we can call.', email: 'That e-mail address does not look right.',
  date: 'That date has passed. Please pick today or a later date.', send: 'We could not send this just now. Please call or message us instead.',
};
const FLOW_COPY: Record<string, { title: string; button: string; choice: string }> = {
  book: { title: 'Book an appointment', button: 'Send booking request', choice: 'What would you like to book?' },
  enquire: { title: 'Send an enquiry', button: 'Send enquiry', choice: 'What are you interested in?' },
  order: { title: 'Place an order', button: 'Send order request', choice: 'What would you like to order?' },
};

/** The same form as the popup, as a real page (works with scripts off). */
function FlowForm({ shell, flow, family, items, keep, nav, flash }: { shell: ShellRuntime; flow: 'book' | 'enquire' | 'order'; family: string; items: SiteItem[]; keep?: string; nav: PageEntry[]; flash?: ThemeOptions['flash'] }) {
  const copy = FLOW_COPY[flow];
  const field = 'w-full border border-[var(--sh-border)] bg-[var(--sh-bg)] px-3.5 py-3 text-base outline-none focus:border-[var(--sh-accent)]';
  const lab = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--sh-muted)]';
  const err = flash?.error ? ERRORS[flash.error] : undefined;
  return (
    <Chrome shell={shell} nav={nav} title={copy.title}>
      {flash?.sent && (
        <div role="status" className="mb-6 border border-[var(--sh-border)] bg-[var(--sh-surface)] p-4 text-sm" style={{ borderRadius: 'var(--sh-radius)' }}>
          <p className="font-semibold">Request sent</p><p className="mt-1">{shell.popup.confirm}</p>{shell.mode !== 'live' && <p className="mt-1 text-xs text-[var(--sh-muted)]">This is a preview: nothing was sent.</p>}
        </div>
      )}
      {err && <p role="alert" className="mb-4 text-sm text-red-600">{err}</p>}
      <form action={submitFlow} className="grid gap-4">
        <input type="hidden" name="base" value={shell.base} /><input type="hidden" name="flow" value={flow} /><input type="hidden" name="subdomain" value={shell.subdomain} />
        <input type="hidden" name="mode" value={shell.mode} /><input type="hidden" name="family" value={family} /><input type="hidden" name="title" value={shell.popup.title} /><input type="hidden" name="keep" value={keep ?? ''} />
        <div aria-hidden className="hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        {items.length > 0 && <div><label htmlFor="f-choice" className={lab}>{copy.choice}</label><select id="f-choice" name="choice" className={field} defaultValue=""><option value="">Choose (optional)</option>{items.map((i) => <option key={i.id} value={i.name}>{i.name}</option>)}</select></div>}
        {shell.goal === 'booking' && <div><label htmlFor="f-date" className={lab}>Preferred date</label><input id="f-date" name="date" type="date" className={field} /></div>}
        <div><label htmlFor="f-name" className={lab}>Your name</label><input id="f-name" name="name" required autoComplete="name" className={field} /></div>
        <div><label htmlFor="f-phone" className={lab}>Mobile number</label><input id="f-phone" name="phone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="10-digit mobile" className={field} /></div>
        <div><label htmlFor="f-email" className={lab}>E-mail (optional)</label><input id="f-email" name="email" type="email" autoComplete="email" className={field} /></div>
        <div><label htmlFor="f-msg" className={lab}>Message (optional)</label><textarea id="f-msg" name="message" rows={3} className={field} /></div>
        <button type="submit" className="inline-flex min-h-[44px] items-center justify-center bg-[var(--sh-accent)] px-5 py-3 text-sm font-semibold text-[var(--sh-accent-fg)]" style={{ borderRadius: 'var(--sh-radius)' }}>{copy.button}</button>
        <p className="text-center text-xs text-[var(--sh-muted)]">Your details go straight to {shell.business.name || 'the business'}. No spam.</p>
      </form>
    </Chrome>
  );
}

/** Privacy and terms pages written for this business from its own details; they promise nothing the platform does not do. */
function LegalPage({ shell, which, nav, site }: { shell: ShellRuntime; which: 'privacy' | 'terms'; nav: PageEntry[]; site: EngineSiteData }) {
  const b = shell.business.name || 'This business';
  const contact = [site.cms?.phone && `phone ${site.cms.phone}`, site.cms?.email && `e-mail ${site.cms.email}`, site.cms?.address && `visit ${site.cms.address}`].filter(Boolean).join(', ');
  const p = 'mt-3 text-sm leading-relaxed text-[var(--sh-muted)]'; const h = 'mt-8 text-lg font-semibold';
  return (
    <Chrome shell={shell} nav={nav} title={which === 'privacy' ? 'Privacy policy' : 'Terms of use'}>
      {which === 'privacy' ? (
        <>
          <p className={p}>{b} runs this website. This page explains what we do with the details you give us.</p>
          <h2 className={h}>What we collect</h2><p className={p}>Only what you type into our forms: your name, mobile number, e-mail (if you give it) and your message. If the site has a cart, we also keep the items you order.</p>
          <h2 className={h}>How we use it</h2><p className={p}>To reply to you, confirm bookings or orders, and serve you. We do not sell your details.</p>
          <h2 className={h}>Who sees it</h2><p className={p}>{b} and the platform that hosts this website for us (Get4Domain), which stores it safely on our behalf. Payments, where offered, are handled by Razorpay; we never see your card details.</p>
          <h2 className={h}>Your choices</h2><p className={p}>You can ask us to correct or remove your details at any time{contact ? `: ${contact}` : ''}.</p>
        </>
      ) : (
        <>
          <p className={p}>By using this website you agree to these simple terms from {b}.</p>
          <h2 className={h}>Information</h2><p className={p}>We try to keep everything on this site accurate. Prices, timings and availability can change; please confirm with us before you rely on them.</p>
          <h2 className={h}>Requests and bookings</h2><p className={p}>A request sent through this site is not a confirmed booking or order until {b} confirms it with you.</p>
          <h2 className={h}>Content</h2><p className={p}>The text and pictures on this site belong to {b} or are used with permission. Please do not copy them without asking.</p>
          <h2 className={h}>Contact</h2><p className={p}>{contact ? `You can reach us: ${contact}.` : 'Please use the contact details on our website.'}</p>
        </>
      )}
    </Chrome>
  );
}
