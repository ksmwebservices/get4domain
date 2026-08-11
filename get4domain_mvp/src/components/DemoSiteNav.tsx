'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Users, CalendarDays, Image as ImageIcon, Info, Phone, Newspaper } from 'lucide-react';
import type { DemoSection, SectionType } from '@/data/demo-site';

const ICON: Record<SectionType | 'home', typeof Home> = {
  home: Home, catalog: LayoutGrid, team: Users, booking: CalendarDays,
  gallery: ImageIcon, about: Info, contact: Phone, blog: Newspaper,
};

interface Props {
  business: string;
  base: string;             // /demo/[cat] or /demo/[cat]/[sub]
  sections: DemoSection[];
}

/**
 * The demo site's OWN navigation — desktop top links + a fixed mobile bottom nav
 * matching the app's bottom-nav pattern (fixed, icon+label tabs). Real routes, not
 * anchors. Not Get4Domain's app nav.
 */
export default function DemoSiteNav({ business, base, sections }: Props) {
  const pathname = usePathname();
  const items = [
    { href: base, label: 'Home', type: 'home' as const },
    ...sections.map((s) => ({ href: `${base}/${s.slug}`, label: s.label, type: s.type })),
  ];
  const isActive = (href: string) => pathname === href;
  // Mobile bottom nav: Home + up to 3 sections + Contact (keeps it native/uncrowded).
  const contact = sections.find((s) => s.type === 'contact');
  const mobile = [
    items[0],
    ...sections.filter((s) => s.type !== 'contact').slice(0, 3).map((s) => ({ href: `${base}/${s.slug}`, label: s.label, type: s.type })),
    ...(contact ? [{ href: `${base}/${contact.slug}`, label: 'Contact', type: 'contact' as const }] : []),
  ];

  return (
    <>
      {/* Desktop top nav */}
      <header className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link href={base} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 font-bold text-white">{business.charAt(0)}</div>
            <span className="text-base font-bold text-slate-900">{business}</span>
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((it) => (
              <Link key={it.href} href={it.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${isActive(it.href) ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                {it.label}
              </Link>
            ))}
          </nav>
          {contact && <Link href={`${base}/${contact.slug}`} className="rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-700">Enquire</Link>}
        </div>
      </header>

      {/* Mobile top bar (brand only) */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href={base} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 text-sm font-bold text-white">{business.charAt(0)}</div>
          <span className="text-sm font-bold text-slate-900">{business}</span>
        </Link>
      </div>

      {/* Mobile bottom nav — native app pattern */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-slate-200 bg-white md:hidden">
        {mobile.map((it) => {
          const Ic = ICON[it.type];
          const active = isActive(it.href);
          return (
            <Link key={it.href} href={it.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-primary-600' : 'text-slate-500'}`}>
              <Ic className="h-5 w-5" />
              <span className="max-w-[64px] truncate">{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
