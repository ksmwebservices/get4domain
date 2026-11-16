import Link from 'next/link';
import { assertV3Public } from '@/lib/v3-public/guard';
import { directoryHomeHref } from '@/lib/v3-public/host-routing';
import { S } from '@/lib/v3-public/strings';

/** The shell of every V3 public page: its own header and footer (no chatbot, no demo gate, no contact details). */
export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  assertV3Public();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">{S.skipToContent}</a>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={directoryHomeHref()} className="text-lg font-bold text-slate-900">{S.brand}</Link>
          <nav aria-label={S.nav.label} className="flex flex-wrap gap-4 text-sm">
            <Link href={directoryHomeHref()} className="hover:underline">{S.nav.directory}</Link>
            <Link href="/claim" className="hover:underline">{S.nav.claim}</Link>
            <Link href="/account/login" className="hover:underline">{S.nav.login}</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-600">
          <nav aria-label={S.footer.label}>
            <h2 className="font-semibold text-slate-900">{S.footer.legalHeading}</h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <li><Link href="/legal/terms" className="hover:underline">{S.footer.terms}</Link></li>
              <li><Link href="/legal/privacy" className="hover:underline">{S.footer.privacy}</Link></li>
              <li><Link href="/legal/refund-and-cancellation" className="hover:underline">{S.footer.refund}</Link></li>
              <li><Link href="/legal/wallet-terms" className="hover:underline">{S.footer.wallet}</Link></li>
              <li><Link href="/legal/directory-listing-terms" className="hover:underline">{S.footer.listing}</Link></li>
            </ul>
          </nav>
          <p className="mt-3">{S.footer.note}</p>
        </div>
      </footer>
    </div>
  );
}
