import Link from 'next/link';
import type { HeaderLinks } from '@/components/portal/Header';
import { CONTAINER } from '@/components/portal/ui';
import { LEGAL_DOCS, LEGAL_UI } from '@/lib/v3-public/legal-strings';
import { GROWTH_GROUPS } from '@/lib/v3-public/growth-config';
import { GROWTH, growthAnchor } from '@/lib/v3-public/growth-strings';
import { PORTAL } from '@/lib/v3-public/portal-strings';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { productPath } from '@/lib/v3-public/site-routes';

function A({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = 'text-sm text-ink-200 hover:text-white hover:underline';
  return /^https?:\/\//.test(href) ? <a href={href} className={cls}>{children}</a> : <Link href={href} className={cls}>{children}</Link>;
}

/** The rich footer: brand, four link columns, the legal list and the GST note. Dark ink surface; link contrast on it is above 9:1. */
export default function Footer({ links, main }: { links: HeaderLinks; main: (path: string) => string }) {
  const F = PORTAL.footer;
  const heading = 'text-sm font-semibold uppercase tracking-wide text-gold-300';
  return (
    <footer className="mt-auto bg-ink-900 text-ink-200 print:hidden">
      <div className={`${CONTAINER} py-12`}>
        <nav aria-label={F.label} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="lg:col-span-1">
            <p className="text-lg font-bold text-white"><Link href={links.home} className="hover:underline">{PORTAL.brand}</Link></p>
            <p className="mt-2 text-sm text-ink-300">{F.blurb}</p>
          </div>
          <div>
            <p className={heading}>{F.find}</p>
            <ul className="mt-3 space-y-2">
              <li><A href={links.directory}>{PORTAL.nav.directory}</A></li>
              <li><A href={links.search}>{PORTAL.search.label}</A></li>
              <li><A href={links.industries}>{PORTAL.nav.allCategories}</A></li>
              <li><A href={links.claim}>{PORTAL.nav.claim}</A></li>
            </ul>
          </div>
          <div>
            <p className={heading}>{F.business}</p>
            <ul className="mt-3 space-y-2">
              <li><A href={links.register}>{PORTAL.nav.start}</A></li>
              <li><A href={links.pricing}>{PORTAL.nav.pricing}</A></li>
              <li><A href={links.product}>{PORTAL.nav.product}</A></li>
              {MARKETING.product.pages.map((p) => <li key={p.slug}><A href={main(productPath(p.slug))}>{p.name}</A></li>)}
              <li><A href={links.partners}>{PORTAL.nav.partners}</A></li>
            </ul>
          </div>
          <div>
            <p className={heading}>{GROWTH.footerHeading}</p>
            <ul className="mt-3 space-y-2">
              <li><A href={main('/growth')}>{GROWTH.footerAll}</A></li>
              {GROWTH_GROUPS.map((g) => <li key={g.key}><A href={main(`/growth#${growthAnchor(g.key)}`)}>{g.name}</A></li>)}
            </ul>
            <p className={`${heading} mt-6`}>{GROWTH.footerPlans}</p>
            <ul className="mt-3 space-y-2">
              <li><A href={main('/pricing#free-title')}>{GROWTH.footerFree}</A></li>
              <li><A href={main('/pricing#plans-title')}>{GROWTH.footerSeePlans}</A></li>
              <li><A href={main('/pricing#compare-title')}>{GROWTH.footerCompare}</A></li>
            </ul>
          </div>
          <div>
            <p className={heading}>{F.learn}</p>
            <ul className="mt-3 space-y-2">
              <li><A href={links.how}>{PORTAL.nav.how}</A></li>
              <li><A href={links.guides}>{PORTAL.nav.guides}</A></li>
              <li><A href={links.industries}>{PORTAL.nav.industries}</A></li>
              <li><A href={main('/about')}>{F.about}</A></li>
              <li><A href={main('/contact')}>{F.contact}</A></li>
            </ul>
          </div>
          <div>
            <p className={heading}>{F.legal}</p>
            <ul aria-label={LEGAL_UI.footerLegalLabel} className="mt-3 space-y-2">
              {LEGAL_DOCS.map((d) => <li key={d.path}><A href={main(d.path)}>{d.title}</A></li>)}
            </ul>
          </div>
        </nav>
        <p className="mt-10 border-t border-white/10 pt-6 text-sm text-ink-300">{F.note}</p>
      </div>
    </footer>
  );
}
