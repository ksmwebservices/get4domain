import Link from 'next/link';
import { assertV3Public } from '@/lib/v3-public/guard';
import { LEGAL_DOCS, LEGAL_UI } from '@/lib/v3-public/legal-strings';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { directoryOrigin } from '@/lib/v3-public/site-metadata';
import { productPath } from '@/lib/v3-public/site-routes';
import { SITE } from '@/lib/v3-public/site-strings';

/** The shell of the commercial public pages: own header and footer, no chatbot, no demo gate, no contact details of ours beyond the contact page. Every link here is a real page. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  assertV3Public();
  const directory = directoryOrigin();
  const F = MARKETING.footer;
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">{SITE.skip}</a>
      <header className="border-b border-slate-200 print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold text-slate-900">{SITE.brand}</Link>
          <nav aria-label={SITE.nav.label} className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/product" className="hover:underline">{MARKETING.nav.product}</Link>
            <Link href="/pricing" className="hover:underline">{SITE.nav.pricing}</Link>
            <Link href="/how-it-works" className="hover:underline">{SITE.nav.how}</Link>
            <Link href="/industries" className="hover:underline">{SITE.nav.industries}</Link>
            <Link href="/guides" className="hover:underline">{MARKETING.nav.guides}</Link>
            <Link href="/partners" className="hover:underline">{MARKETING.nav.partners}</Link>
            {directory ? <a href={directory} className="hover:underline">{SITE.nav.directory}</a> : null}
            <Link href="/login" className="hover:underline">{SITE.nav.login}</Link>
            <Link href="/register" className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white">{SITE.nav.register}</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50 print:hidden">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-600">
          <nav aria-label={SITE.footer.label} className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="font-medium text-slate-900">{F.productHeading}</p>
              <ul className="mt-2 space-y-1">
                <li><Link href="/product" className="hover:underline">{MARKETING.product.h1}</Link></li>
                {MARKETING.product.pages.map((p) => <li key={p.slug}><Link href={productPath(p.slug)} className="hover:underline">{p.name}</Link></li>)}
                <li><Link href="/features" className="hover:underline">{SITE.footer.features}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-900">{F.learnHeading}</p>
              <ul className="mt-2 space-y-1">
                <li><Link href="/how-it-works" className="hover:underline">{F.howLink}</Link></li>
                <li><Link href="/guides" className="hover:underline">{F.guidesLink}</Link></li>
                <li><Link href="/industries" className="hover:underline">{F.industriesLink}</Link></li>
                <li><Link href="/pricing" className="hover:underline">{F.pricingLink}</Link></li>
                {directory ? <li><a href={directory} className="hover:underline">{F.directoryLink}</a></li> : null}
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-900">{F.companyHeading}</p>
              <ul className="mt-2 space-y-1">
                <li><Link href="/about" className="hover:underline">{SITE.footer.about}</Link></li>
                <li><Link href="/contact" className="hover:underline">{SITE.footer.contact}</Link></li>
                <li><Link href="/partners" className="hover:underline">{F.partnersLink}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-900">{SITE.footer.legal}</p>
              <ul aria-label={LEGAL_UI.footerLegalLabel} className="mt-2 space-y-1">
                {LEGAL_DOCS.map((d) => <li key={d.path}><Link href={d.path} className="hover:underline">{d.title}</Link></li>)}
              </ul>
            </div>
          </nav>
          <p className="mt-6">{SITE.footer.note}</p>
        </div>
      </footer>
    </div>
  );
}
