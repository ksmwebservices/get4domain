'use client';

import { ChevronDown, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavPack } from '@/components/portal/nav-data';
import { btn, CONTAINER, FOCUS } from '@/components/portal/ui';
import { PORTAL } from '@/lib/v3-public/portal-strings';

/** Every address the header needs, worked out on the server (the main site and the directory can be two hosts). */
export interface HeaderLinks {
  home: string; product: string; pricing: string; how: string; industries: string; guides: string; partners: string;
  directory: string; search: string; claim: string; login: string; register: string;
}

const NAV_LINK = `rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-ink-900 ${FOCUS}`;

/** Links that stay on this host use the router; links to the other host are plain anchors. */
function A({ href, className, children, onClick }: { href: string; className?: string; children: React.ReactNode; onClick?: () => void }) {
  return /^https?:\/\//.test(href)
    ? <a href={href} className={className} onClick={onClick}>{children}</a>
    : <Link href={href} className={className} onClick={onClick}>{children}</Link>;
}

/**
 * The portal header: brand, a category mega menu (areas on the left, their categories on the right), the main links, and a drawer on phones.
 * The mega menu opens on click or Enter and also on hover; Escape and a click outside close it. The drawer locks page scroll while open and closes on Escape.
 */
export default function Header({ links, packs, mainPrefix, active }: { links: HeaderLinks; packs: NavPack[]; mainPrefix: string; active: 'site' | 'directory' }) {
  const [menu, setMenu] = useState(false);
  const [pack, setPack] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawerButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setMenu(false), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setMenu(false); menuButton.current?.focus(); } };
    const onDown = (e: MouseEvent): void => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [menu]);

  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setDrawer(false); drawerButton.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [drawer]);

  const current = packs[pack] ?? null;
  const N = PORTAL.nav;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
      <div className={`${CONTAINER} flex h-16 items-center gap-2`}>
        <A href={links.home} className={`mr-2 flex items-center gap-2 rounded-lg ${FOCUS}`}>
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">G</span>
          <span className="text-lg font-bold tracking-tight text-ink-900">{PORTAL.brand}</span>
        </A>

        <nav aria-label={N.label} className="hidden flex-1 items-center gap-1 lg:flex">
          <div ref={menuRef} className="relative" onMouseLeave={closeMenu}>
            <button
              ref={menuButton}
              type="button"
              aria-expanded={menu}
              aria-controls="portal-mega"
              onClick={() => setMenu((v) => !v)}
              onMouseEnter={() => setMenu(true)}
              className={`${NAV_LINK} inline-flex items-center gap-1`}
            >
              {N.categories}
              <ChevronDown aria-hidden="true" className={`h-4 w-4 motion-safe:transition-transform ${menu ? 'rotate-180' : ''}`} />
            </button>
            {menu && current ? (
              <div id="portal-mega" className="absolute left-0 top-full z-50 w-[46rem] max-w-[90vw] pt-2">
                <div className="grid grid-cols-[14rem_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-premium">
                  <ul aria-label={N.chooseArea} className="max-h-[26rem] overflow-y-auto border-r border-slate-100 bg-slate-50 p-2">
                    {packs.map((p, i) => (
                      <li key={p.key}>
                        <button
                          type="button"
                          onMouseEnter={() => setPack(i)}
                          onFocus={() => setPack(i)}
                          onClick={() => setPack(i)}
                          aria-current={i === pack ? 'true' : undefined}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${FOCUS} ${i === pack ? 'bg-white text-brand-700 shadow-card' : 'text-slate-700 hover:bg-white'}`}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="max-h-[26rem] overflow-y-auto p-4">
                    <p className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-ink-900">{current.name}</span>
                      <A href={`${mainPrefix}${current.path}`} onClick={closeMenu} className={`text-sm font-medium text-brand-700 hover:underline ${FOCUS}`}>{`${N.categoriesOf}: ${current.categories.length}`}</A>
                    </p>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {current.categories.map((c) => (
                        <li key={c.id}>
                          <A href={`${mainPrefix}${c.path}`} onClick={closeMenu} className={`block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-800 ${FOCUS}`}>{c.name}</A>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 border-t border-slate-100 pt-3">
                      <A href={links.industries} onClick={closeMenu} className={`text-sm font-semibold text-brand-700 hover:underline ${FOCUS}`}>{N.allCategories}</A>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <A href={links.directory} className={`${NAV_LINK} ${active === 'directory' ? 'bg-brand-50 text-brand-800' : ''}`}>{N.directory}</A>
          <A href={links.product} className={NAV_LINK}>{N.product}</A>
          <A href={links.pricing} className={NAV_LINK}>{N.pricing}</A>
          <A href={links.how} className={NAV_LINK}>{N.how}</A>
          <A href={links.guides} className={NAV_LINK}>{N.guides}</A>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <A href={links.search} className={`hidden rounded-xl p-2 text-slate-600 hover:bg-slate-100 sm:inline-flex lg:hidden ${FOCUS}`}><Search aria-hidden="true" className="h-5 w-5" /><span className="sr-only">{PORTAL.search.label}</span></A>
          <A href={links.login} className={`${NAV_LINK} hidden sm:inline-flex`}>{N.signIn}</A>
          <A href={links.register} className={`${btn('primary', true)} hidden sm:inline-flex`}>{N.start}</A>
          <button
            ref={drawerButton}
            type="button"
            aria-expanded={drawer}
            aria-controls="portal-drawer"
            onClick={() => setDrawer(true)}
            className={`inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 lg:hidden ${FOCUS}`}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />{N.menu}
          </button>
        </div>
      </div>

      {drawer ? (
        <div id="portal-drawer" role="dialog" aria-modal="true" aria-label={N.menu} className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" aria-label={N.closeMenu} tabIndex={-1} onClick={() => setDrawer(false)} className="absolute inset-0 bg-ink-950/50" />
          <div className="relative ml-auto flex h-full w-[min(22rem,92vw)] flex-col overflow-y-auto bg-white p-4 shadow-premium">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-bold text-ink-900">{PORTAL.brand}</span>
              <button ref={closeButton} type="button" onClick={() => { setDrawer(false); drawerButton.current?.focus(); }} className={`rounded-xl p-2 text-slate-700 hover:bg-slate-100 ${FOCUS}`}>
                <X aria-hidden="true" className="h-6 w-6" /><span className="sr-only">{N.closeMenu}</span>
              </button>
            </div>
            <nav aria-label={N.label} className="flex flex-col gap-1">
              <A href={links.directory} onClick={() => setDrawer(false)} className={`${NAV_LINK} text-base`}>{N.directory}</A>
              <details className="group">
                <summary className={`flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 ${FOCUS}`}>
                  {N.categories}<ChevronDown aria-hidden="true" className="h-4 w-4 group-open:rotate-180" />
                </summary>
                <ul className="mt-1 space-y-1 border-l border-slate-200 pl-3">
                  {packs.map((p) => (
                    <li key={p.key}>
                      <details className="group/inner">
                        <summary className={`flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 ${FOCUS}`}>
                          {p.name}<ChevronDown aria-hidden="true" className="h-4 w-4 group-open/inner:rotate-180" />
                        </summary>
                        <ul className="mb-1 ml-2 space-y-0.5">
                          {p.categories.map((c) => (
                            <li key={c.id}><A href={`${mainPrefix}${c.path}`} onClick={() => setDrawer(false)} className={`block rounded-md px-2 py-1 text-sm text-slate-600 hover:text-brand-700 ${FOCUS}`}>{c.name}</A></li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                  <li><A href={links.industries} onClick={() => setDrawer(false)} className={`block rounded-md px-2 py-1.5 text-sm font-semibold text-brand-700 ${FOCUS}`}>{N.allCategories}</A></li>
                </ul>
              </details>
              <A href={links.product} onClick={() => setDrawer(false)} className={`${NAV_LINK} text-base`}>{N.product}</A>
              <A href={links.pricing} onClick={() => setDrawer(false)} className={`${NAV_LINK} text-base`}>{N.pricing}</A>
              <A href={links.how} onClick={() => setDrawer(false)} className={`${NAV_LINK} text-base`}>{N.how}</A>
              <A href={links.guides} onClick={() => setDrawer(false)} className={`${NAV_LINK} text-base`}>{N.guides}</A>
              <A href={links.partners} onClick={() => setDrawer(false)} className={`${NAV_LINK} text-base`}>{N.partners}</A>
            </nav>
            <div className="mt-auto flex flex-col gap-2 pt-6">
              <A href={links.claim} onClick={() => setDrawer(false)} className={btn('secondary')}>{N.claim}</A>
              <A href={links.login} onClick={() => setDrawer(false)} className={btn('secondary')}>{N.signIn}</A>
              <A href={links.register} onClick={() => setDrawer(false)} className={btn('primary')}>{N.start}</A>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
