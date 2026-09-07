import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * Raw static-HTML theme renderer (Theme Marketplace). An admin uploads a Bolt/designer
 * static site as `WebsiteTheme.pages` = [{ slug, title, html }] (+ optional shared `css`).
 * We render the requested page's HTML verbatim and inject the vendor's own content via
 * {{tokens}} — so one uploaded design serves every vendor with their own details, no
 * re-entry and no redeploy. Multi-page routing uses our /site/<sub>/<slug> paths.
 *
 * Trust: the HTML is ADMIN-authored (AdminGuard on upload), not vendor/visitor input, so
 * rendering it via dangerouslySetInnerHTML is first-party content, not user injection.
 */

export interface ThemePage { slug: string; title: string; html: string }

interface SiteCms {
  businessName?: string | null; tagline?: string | null; about?: string | null;
  logo?: string | null; banner?: string | null; phone?: string | null; whatsapp?: string | null;
  email?: string | null; address?: string | null; googleMaps?: string | null;
}
interface SiteLike {
  vendor: { businessName: string; subdomain: string | null };
  cms: SiteCms | null;
  theme?: { pages?: unknown; css?: string | null } | null;
}

/** Parse the stored `pages` Json into a validated ThemePage[] (empty ⇒ not a raw theme). */
export function themePages(theme?: { pages?: unknown } | null): ThemePage[] {
  const raw = theme?.pages;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is ThemePage =>
      !!p && typeof p === 'object' && typeof (p as ThemePage).html === 'string' && typeof (p as ThemePage).slug === 'string')
    .map((p) => ({ slug: p.slug, title: p.title || p.slug, html: p.html }));
}

const esc = (s: string | null | undefined): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Replace {{token}} placeholders with the vendor's real content. Unknown tokens are left as-is. */
function injectContent(html: string, site: SiteLike): string {
  const cms = site.cms ?? {};
  const businessName = cms.businessName || site.vendor.businessName || '';
  const waDigits = (cms.whatsapp ?? '').replace(/\D/g, '');
  const map: Record<string, string> = {
    businessName: esc(businessName),
    tagline: esc(cms.tagline),
    about: esc(cms.about),
    logo: esc(cms.logo),
    banner: esc(cms.banner),
    phone: esc(cms.phone),
    email: esc(cms.email),
    address: esc(cms.address),
    whatsapp: esc(cms.whatsapp),
    whatsappLink: waDigits ? `https://wa.me/${waDigits}` : '',
    mapsLink: esc(cms.googleMaps),
    year: String(new Date().getFullYear()),
  };
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : full);
}

/** Rewrite common intra-theme links (about.html, /about) to our /site/<sub>/<slug> routes. */
function rewriteLinks(html: string, base: string, slugs: Set<string>): string {
  return html.replace(/href\s*=\s*"([^"]+)"/g, (full, href: string) => {
    const clean = href.replace(/^\.?\//, '').replace(/\.html?$/i, '').replace(/\/$/, '');
    const slug = clean === '' || clean === 'index' || clean === 'home' ? 'home' : clean;
    if (slug === 'home' || slugs.has(slug)) return `href="${base}/${slug}"`;
    return full; // external / anchor / asset links untouched
  });
}

export function renderRawHtmlSite(
  site: SiteLike,
  opts: { subdomain: string; rest: string[] },
): ReactElement {
  const pages = themePages(site.theme);
  const base = `/site/${opts.subdomain}`;
  const slugs = new Set(pages.map((p) => (p.slug === pages[0]?.slug ? 'home' : p.slug)));
  const requested = opts.rest[0] || 'home';
  const current = pages.find((p) => p.slug === requested) ?? (requested === 'home' ? pages[0] : undefined) ?? pages[0];
  const html = rewriteLinks(injectContent(current.html, site), base, slugs);
  const multi = pages.length > 1;

  return (
    <div>
      {site.theme?.css ? (
        // eslint-disable-next-line react/no-danger
        <style dangerouslySetInnerHTML={{ __html: site.theme.css }} />
      ) : null}

      {multi && (
        <nav className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/95 px-4 py-2 text-sm backdrop-blur">
          {pages.map((p, i) => {
            const slug = i === 0 ? 'home' : p.slug;
            const active = (requested === slug) || (requested === 'home' && i === 0);
            return (
              <Link key={p.slug} href={`${base}/${slug}`}
                className={`rounded-lg px-3 py-1.5 font-medium ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {p.title}
              </Link>
            );
          })}
        </nav>
      )}

      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
