import type { ReactNode } from 'react';
import Footer from '@/components/portal/Footer';
import { portalFont } from '@/components/portal/fonts';
import Header, { type HeaderLinks } from '@/components/portal/Header';
import { navPacks } from '@/components/portal/nav-data';
import { portalLinks } from '@/lib/v3-public/portal-links';
import { PORTAL } from '@/lib/v3-public/portal-strings';

/**
 * The one shell of every V3 public page, for the main site and the directory alike: skip link, header with the category mega menu, the page, the rich footer.
 * Pages that want a tinted full-width band use <FullBleed> inside the page; the wrapper clips sideways overflow so the band never causes a horizontal scroll.
 */
export default function PortalShell({ variant, children }: { variant: 'site' | 'directory'; children: ReactNode }) {
  const l = portalLinks();
  const links: HeaderLinks = {
    home: l.main('/'), product: l.main('/product'), pricing: l.main('/pricing'), how: l.main('/how-it-works'), industries: l.main('/industries'),
    guides: l.main('/guides'), partners: l.main('/partners'), directory: l.directoryHome, search: l.search, claim: l.claim, login: l.login, register: l.main('/register'),
  };
  // a path on this host stays relative; to the other host it is absolute (portalLinks decides), so the prefix is whatever main('') gives
  const mainPrefix = l.main('');
  return (
    <div className={`${portalFont.variable} flex min-h-screen flex-col overflow-x-clip bg-white font-[family-name:var(--font-portal),system-ui,sans-serif] text-slate-700 antialiased`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-ink-900 focus:shadow-premium">{PORTAL.skip}</a>
      <Header links={links} packs={navPacks()} mainPrefix={mainPrefix} active={variant} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <Footer links={links} main={l.main} />
    </div>
  );
}
