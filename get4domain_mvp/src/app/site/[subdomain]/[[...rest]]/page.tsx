import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { canonicalIndustryId } from '@/data/demo-site';
import { getEngineIndustry, renderKitTemplate } from '@/engine/registry';
import KitRenderer from '@/engine/kit/KitRenderer';
import { buildPageModel, buildSiteDocModel, jsonLdFor } from '@/engine/sitedoc/build';
import { templateFromThemeRow, type ThemeRow } from '@/engine/kit/template';
import { themePages } from '@/engine/raw-html-site';
import { buildThemeSrcDoc, RawThemeFrame } from '@/engine/raw-theme-frame';
import type { EngineSiteData } from '@/engine/types';
import { withShell } from '@/engine/shell/with-shell';
import ThemeSite,{ fetchThemePackage, themeMetadata } from '@/engine/themepack/site';
import FreeSiteView from '@/components/site/FreeSiteView';
import SiteApp from '@/components/site-kit/SiteApp';
import { themeForSite } from '@/lib/v3-public/site-kit/resolver';
import { buildSiteView, categoryLabel } from '@/lib/v3-public/site-kit/view';
import { buildHead } from '@/lib/v3-public/site-kit/head';
import SiteBeingSetUp from '@/components/site/SiteBeingSetUp';
import { fetchSiteState, freeViewOf, isFreeSite, logVendorNotFound, siteApiBase, type VendorNotFoundReason } from '@/lib/v3-public/site-state';

// Pages are fast because the vendor's data is cached for a minute and tagged `site:<subdomain>`; Publish drops that tag (POST /api/revalidate-site) so a change shows
// within seconds. The vendor's private preview link (?preview=) is never cached.

// The browser-facing address (a theme's forms post to it). The server's own reads use siteApiBase(): the runtime INTERNAL_API_URL first, because NEXT_PUBLIC_API_URL is fixed when the app is built.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

interface VendorProduct {
  id: string; name: string; description: string | null; price: string | null;
  image: string | null; category: string | null; customFields: Record<string, string> | null;
}
interface SiteData {
  vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
  cms: {
    businessName: string | null; tagline: string | null; about: string | null;
    logo: string | null; banner: string | null; phone: string | null; whatsapp: string | null;
    email: string | null; address: string | null; seoTitle: string | null; seoDesc: string | null;
    seoKeywords: string | null; favicon?: string | null; ogImage?: string | null; googleAnalyticsId?: string | null;
  } | null;
  products: VendorProduct[];
  theme?: (ThemeRow & { pages?: unknown; css?: string | null; js?: string | null; fonts?: unknown }) | null;
  paymentsEnabled?: boolean;
  docV2?: boolean;
  checkoutMode?: 'ONLINE' | 'ORDER_REQUEST' | 'NONE';
  preview?: boolean;
  pack?: { key: string; name: string; config: unknown } | null;
  indexable?: boolean;
  /** industry designs round 2: the imported theme this site renders (null = a built-in design) */
  themeRef?: { id: string; key: string; version: number; name: string } | null;
  themeNotice?: { kind: string; message: string } | null;
  pagesLimit?: number;
}

/** Fetch the live site for a subdomain (real, non-sandbox vendors only). */
async function fetchSite(subdomain: string, preview?: string, design?: string): Promise<SiteData | null> {
  try {
    const url = `${siteApiBase()}/cms/site/${encodeURIComponent(subdomain)}${preview ? `?preview=${encodeURIComponent(preview)}${design ? `&design=${encodeURIComponent(design)}` : ''}` : ''}`;
    const res = await fetch(url, preview ? { cache: 'no-store' } : { next: { tags: [`site:${subdomain}`], revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as SiteData;
  } catch {
    return null;
  }
}

/** The site-state route: does this address have a site at all (live or draft)? false when it has none or the API cannot say. */
async function siteExists(subdomain: string): Promise<boolean> {
  return (await fetchSiteState(siteApiBase(), subdomain))?.exists === true;
}

/** The address has no site we can show: log why (one line, subdomain and reason code) and answer the normal not-found page. */
async function missing(subdomain: string): Promise<never> {
  const state = await fetchSiteState(siteApiBase(), subdomain);
  logVendorNotFound(subdomain, state === null ? 'API_UNREACHABLE' : 'API_NOT_FOUND');
  notFound();
}

/** A page of a site that exists but has no such page, or no design for it: log the reason and answer the normal not-found page. */
function noPage(subdomain: string, reason: VendorNotFoundReason): never {
  logVendorNotFound(subdomain, reason);
  notFound();
}

interface Params { subdomain: string; rest?: string[] }

const SITE_BASE = (process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN || 'get4domain.com').toLowerCase();
/** Links are written relative to the vendor's own host (/about, /p/news): a vendor has no /site/<name> path address (the middleware redirects that to the vendor host). */
const VENDOR_BASE = '';

type Query = { preview?: string; design?: string; sent?: string; e?: string };

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Query> }): Promise<Metadata> {
  const { subdomain, rest = [] } = await params;
  const { preview, design } = await searchParams;
  const site = await fetchSite(subdomain, preview, design);
  // an address with no site answers 404; an address that has one which cannot be shown yet (a draft, or not ready) says it is being set up. Both stay out of search.
  if (!site) {
    if (await siteExists(subdomain)) return { title: 'This site is being set up', robots: { index: false, follow: false } };
    return missing(subdomain);
  }
  const category = categoryLabel(site.vendor.industry, site.pack?.name ?? null, site.pack?.key ?? null);
  if (site.docV2 && site.themeRef && !isFreeSite(site)) {
    const pkg = await fetchThemePackage(site.themeRef.id);
    if (pkg) return themeMetadata(site as unknown as EngineSiteData, pkg, rest, { base: VENDOR_BASE, subdomain, preview: !!site.preview, category, baseDomain: SITE_BASE });
  }
  // the title of the page being shown (empty on the home page): a vendor-written page, an uploaded theme's page, or one of the built-in pages
  const first = rest[0] ?? 'home';
  let pageTitleText: string | null = null; let path = '/';
  if (first === 'p' && rest[1]) {
    const pg = (site.cms as { pages?: { slug: string; title: string }[] } | null)?.pages?.find((x) => x.slug === rest[1]);
    pageTitleText = pg?.title ?? null; path = `/p/${rest[1]}`;
  } else if (first !== 'home') {
    const themed = themePages(site.theme).find((p) => p.slug === first);
    pageTitleText = themed?.title ?? (first === 'contact' ? 'Contact' : first === 'listings' ? 'Our listings' : first.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()));
    path = `/${first}`;
  }
  const meta = buildHead({ site, subdomain, path, pageTitle: pageTitleText, category, baseDomain: SITE_BASE, noindex: !!(site.preview || (site.docV2 && site.indexable === false)) });
  return meta;
}

export default async function VendorSitePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Query> }) {
  const { subdomain, rest = [] } = await params;
  const { preview, design, sent, e } = await searchParams;
  const site = await fetchSite(subdomain, preview, design);
  if (!site) {
    if (await siteExists(subdomain)) return <SiteBeingSetUp />;
    return missing(subdomain);
  }

  // A Free site is information only: no contact form, chat widget, button or e-mail, whatever design, industry text or theme it has (or has not).
  // If its information page cannot even be put together, the site exists, so say it is being set up (and log why), never a bare 404.
  if (isFreeSite(site)) {
    let view: ReturnType<typeof freeViewOf> | null = null;
    try { view = freeViewOf(site); } catch { logVendorNotFound(subdomain, 'FREE_RENDER_FAILED'); }
    return view ? <FreeSiteView view={view} /> : <SiteBeingSetUp />;
  }

  // Uploaded static-HTML theme wins first (Theme Marketplace): render the vendor's EXACT
  // design in an isolated iframe (pixel-identical, its own CSS/JS), with forms wired to
  // the engine. rest[0] selects the page (default = home).
  const pages = themePages(site.theme);
  if (pages.length > 0) {
    const fonts = Array.isArray(site.theme?.fonts) ? (site.theme?.fonts as string[]) : [];
    const srcDoc = buildThemeSrcDoc(
      { pages, css: site.theme?.css ?? '', js: site.theme?.js ?? '', fonts },
      { vendor: { businessName: site.vendor.businessName, subdomain: site.vendor.subdomain }, cms: site.cms },
      { subdomain, rest, apiBase: API_BASE },
    );
    return <RawThemeFrame srcDoc={srcDoc} title={site.cms?.businessName || site.vendor.businessName} />;
  }

  // Selected template: if the vendor picked a theme with a data-driven layout,
  // render THAT design (any industry), filled with their content — the no-redeploy path.
  const selectedTemplate = templateFromThemeRow(site.theme);
  if (selectedTemplate && (rest.length === 0 || rest[0] === 'home')) {
    return <>{renderKitTemplate(selectedTemplate, site as unknown as EngineSiteData, { kind: 'live', subdomain })}</>;
  }

  // The new Website Manager (per-vendor switch `site_doc_v2`): the site is the vendor's own content + a category pack + a theme and layouts they chose.
  // No stock photo, invented testimonial or invented number is ever added; an empty field is hidden or shows the pack's plain wording.
  if (site.docV2) {
    const mode = { kind: 'live' as const, subdomain };
    // a shop can take online payment (the vendor's own Razorpay) or order requests the shop confirms by phone
    const shop = !!site.paymentsEnabled || site.checkoutMode === 'ORDER_REQUEST';
    const checkoutMode = site.checkoutMode === 'ORDER_REQUEST' ? ('ORDER_REQUEST' as const) : ('ONLINE' as const);
    // an imported theme (round 2): its pages filled with the vendor's data inside the engine shell. A theme that cannot be loaded falls through to the built-in design.
    if (site.themeRef) {
      const pkg = await fetchThemePackage(site.themeRef.id);
      if (pkg) {
        const keep = preview ? `preview=${encodeURIComponent(preview)}${design ? `&design=${encodeURIComponent(design)}` : ''}` : '';
        return (
          <>
            {site.preview ? <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full bg-amber-300 px-4 py-2 text-center text-xs font-semibold text-slate-900 shadow-lg md:bottom-5">Preview: this is how your site will look. It is not live until you publish.</div> : null}
            <ThemeSite site={site as unknown as EngineSiteData} pkg={pkg} rest={rest} subdomain={subdomain} opts={{ base: VENDOR_BASE, mode: site.preview ? 'preview' : 'live', shop, checkoutMode, keep, flash: { sent: sent === '1', error: e } }} />
          </>
        );
      }
    }
    const bar = site.preview ? <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full bg-amber-300 px-4 py-2 text-center text-xs font-semibold text-slate-900 shadow-lg md:bottom-5">Preview: this is how your site will look. It is not live until you publish.</div> : null;
    if (rest[0] === 'p' && rest[1]) {
      const pg = (site.cms as { pages?: { slug: string; title: string; body: string }[] } | null)?.pages?.find((x) => x.slug === rest[1]);
      if (!pg) return noPage(subdomain, 'INNER_PAGE_NOT_FOUND');
      return <>{bar}<KitRenderer model={withShell(buildPageModel(site as unknown as EngineSiteData, pg), site as unknown as EngineSiteData, { mode: site.preview ? 'preview' : 'live', cart: shop, base: VENDOR_BASE, onHome: false })} mode={mode} shop={shop} checkoutMode={checkoutMode} /></>;
    }
    if (rest.length === 0 || rest[0] === 'home') {
      const ga = site.cms?.googleAnalyticsId?.trim();
      return (
        <>
          {bar}
          {/* eslint-disable-next-line react/no-danger */}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFor(site as unknown as EngineSiteData, `https://${subdomain}.get4domain.com`)).replace(/</g, '\\u003c') }} />
          {ga && /^[A-Za-z0-9-]{4,20}$/.test(ga) && !site.preview ? (
            <>
              <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
              <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}</Script>
            </>
          ) : null}
          <KitRenderer model={withShell(buildSiteDocModel(site as unknown as EngineSiteData), site as unknown as EngineSiteData, { mode: site.preview ? 'preview' : 'live', cart: shop, base: VENDOR_BASE, onHome: true })} mode={mode} shop={shop} checkoutMode={checkoutMode} />
        </>
      );
    }
    return noPage(subdomain, 'NO_DESIGN');
  }

  // Industry-switch: if this vendor's industry has a bespoke engine site (Real
  // Estate today), render THAT — a genuinely different information architecture and
  // conversion journey. Every other industry keeps the existing generic renderer
  // untouched, so nothing regresses while industries are migrated one at a time.
  const engineIndustry = getEngineIndustry(canonicalIndustryId(site.vendor.industry));
  if (engineIndustry && (rest.length === 0 || rest[0] === 'home')) {
    return <>{engineIndustry.render(site as unknown as EngineSiteData, { kind: 'live', subdomain })}</>;
  }

  // The generic design (Pro, and any site no bespoke design takes): the theme design kit. The theme is picked from the vendor's category (sub category, category, main
  // category, closest industry pack, safe default) and drawn as a small web app: bottom navigation on a phone, top navigation on a computer, an Install app button.
  const page = rest[0] ?? 'home';
  if (!['home', 'listings', 'contact'].includes(page)) return noPage(subdomain, 'INNER_PAGE_NOT_FOUND');
  const { theme, pack } = themeForSite(site);
  const view = buildSiteView(site, { mode: 'live', pack });
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    name: view.name, description: view.about ?? view.tagline ?? undefined,
    image: view.banner ?? undefined, telephone: view.phone ?? undefined,
    address: view.address ?? undefined, url: `https://${subdomain}.${SITE_BASE}`, areaServed: 'IN',
  };
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\u003c') }} />
      <SiteApp view={view} theme={theme} />
    </>
  );
}
