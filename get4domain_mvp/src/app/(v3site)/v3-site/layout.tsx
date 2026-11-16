import Link from 'next/link';
import { assertV3Public } from '@/lib/v3-public/guard';
import { directoryOrigin } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

/** The shell of the commercial public pages: own header and footer, no chatbot, no demo gate, no contact details of ours beyond the contact page. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  assertV3Public();
  const directory = directoryOrigin();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">{SITE.skip}</a>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-bold text-slate-900">{SITE.brand}</Link>
          <nav aria-label={SITE.nav.label} className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/pricing" className="hover:underline">{SITE.nav.pricing}</Link>
            <Link href="/how-it-works" className="hover:underline">{SITE.nav.how}</Link>
            <Link href="/industries" className="hover:underline">{SITE.nav.industries}</Link>
            {directory ? <a href={directory} className="hover:underline">{SITE.nav.directory}</a> : null}
            <Link href="/login" className="hover:underline">{SITE.nav.login}</Link>
            <Link href="/register" className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white">{SITE.nav.register}</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-600">
          <nav aria-label={SITE.footer.label} className="flex flex-wrap gap-x-8 gap-y-3">
            <ul className="flex flex-wrap gap-4">
              <li><Link href="/features" className="hover:underline">{SITE.footer.features}</Link></li>
              <li><Link href="/about" className="hover:underline">{SITE.footer.about}</Link></li>
              <li><Link href="/contact" className="hover:underline">{SITE.footer.contact}</Link></li>
            </ul>
            <ul className="flex flex-wrap gap-4">
              <li><Link href="/legal/terms" className="hover:underline">{SITE.footer.terms}</Link></li>
              <li><Link href="/legal/privacy" className="hover:underline">{SITE.footer.privacy}</Link></li>
              <li><Link href="/legal/refund-and-cancellation" className="hover:underline">{SITE.footer.refund}</Link></li>
            </ul>
          </nav>
          <p className="mt-4">{SITE.footer.note}</p>
        </div>
      </footer>
    </div>
  );
}
