'use client';

import { Download, Home, LayoutGrid, MoreHorizontal, Search, Tag, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeaderLinks } from '@/components/portal/Header';
import { FOCUS } from '@/components/portal/ui';
import { activeTab, installMode, isIosDevice, showAppNav, type AppTab, type AppTabLink } from '@/lib/v3-public/app-nav';
import { PORTAL } from '@/lib/v3-public/portal-strings';

/** The event Chrome and Edge send when the app can be installed (not in the standard type definitions). */
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const T = PORTAL.app;
const SAFE = 'pb-[env(safe-area-inset-bottom)]';

/** Links that stay on this host use the router; links to the other host are plain anchors. */
function A({ href, className, children, onClick, current }: { href: string; className?: string; children: React.ReactNode; onClick?: () => void; current?: boolean }) {
  const aria = current ? { 'aria-current': 'page' as const } : {};
  return /^https?:\/\//.test(href)
    ? <a href={href} className={className} onClick={onClick} {...aria}>{children}</a>
    : <Link href={href} className={className} onClick={onClick} {...aria}>{children}</Link>;
}

const standaloneNow = (): boolean => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * The bottom bar of phones (below the md breakpoint): Home, Search, Categories, Plans and a More sheet. It sits above the page's own footer (a spacer of the same height keeps the
 * footer, forms and buttons reachable), is safe-area aware, steps aside while a field has focus (the on-screen keyboard) and is not shown on policy pages or in print.
 * The More sheet also holds the Install item: the browser's own prompt where it exists, a short Add to Home Screen hint on iOS, nothing when the app is already installed.
 */
export default function MobileNav({ links }: { links: HeaderLinks }) {
  const pathname = usePathname() ?? '/';
  const [sheet, setSheet] = useState(false);
  const [typing, setTyping] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [hint, setHint] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStandalone(standaloneNow());
    setIos(isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    const onPrompt = (e: Event): void => { e.preventDefault(); setPrompt(e as InstallPromptEvent); };
    const onInstalled = (): void => { setPrompt(null); setStandalone(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  // the bar steps aside while a text field has focus, so the on-screen keyboard never leaves it floating over what is being typed
  useEffect(() => {
    const field = (t: EventTarget | null): boolean => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !['checkbox', 'radio', 'button', 'submit'].includes((t as HTMLInputElement).type);
    const on = (e: FocusEvent): void => { if (field(e.target)) setTyping(true); };
    const off = (e: FocusEvent): void => { if (field(e.target)) setTyping(false); };
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); };
  }, []);

  const closeSheet = useCallback(() => { setSheet(false); setHint(false); setNote(null); moreButton.current?.focus(); }, []);

  useEffect(() => { setSheet(false); setHint(false); setNote(null); }, [pathname]);

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { closeSheet(); return; }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [sheet, closeSheet]);

  if (!showAppNav(pathname)) return null;

  const tabLinks: AppTabLink[] = [{ key: 'home', href: links.home }, { key: 'search', href: links.search }, { key: 'categories', href: links.industries }, { key: 'plans', href: links.pricing }];
  const active: AppTab | null = sheet ? 'more' : activeTab(pathname, tabLinks);
  const mode = installMode({ standalone, hasPrompt: prompt !== null, ios });

  async function install(): Promise<void> {
    if (mode === 'prompt' && prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      setPrompt(null);
      if (choice?.outcome === 'accepted') setNote(T.installDone);
    } else if (mode === 'ios') setHint(true);
  }

  const tab = (k: AppTab): string => `relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium ${FOCUS} focus-visible:ring-inset ${active === k ? 'text-brand-700' : 'text-slate-600'}`;
  const mark = (k: AppTab): React.ReactNode => <span aria-hidden="true" className={`absolute inset-x-4 top-0 h-0.5 rounded-b-full ${active === k ? 'bg-brand-600' : 'bg-transparent'}`} />;
  const ROW = `flex min-h-12 items-center rounded-xl px-4 text-base font-medium text-slate-800 hover:bg-slate-100 ${FOCUS}`;

  return (
    <>
      {/* keeps the page's footer and last controls above the fixed bar: 4rem plus the safe area, the same as the bar */}
      <div aria-hidden="true" className={`h-16 ${SAFE} md:hidden print:hidden`} style={{ boxSizing: 'content-box' }} />
      <nav aria-label={T.barLabel} data-app-nav className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur ${SAFE} transition-transform duration-200 motion-reduce:transition-none md:hidden print:hidden ${typing && !sheet ? 'translate-y-full' : 'translate-y-0'}`}>
        <ul className="mx-auto flex max-w-lg items-stretch">
          <li className="flex min-w-0 flex-1"><A href={links.home} className={tab('home')} current={active === 'home'}>{mark('home')}<Home aria-hidden="true" className="h-6 w-6" /><span>{T.home}</span></A></li>
          <li className="flex min-w-0 flex-1"><A href={links.search} className={tab('search')} current={active === 'search'}>{mark('search')}<Search aria-hidden="true" className="h-6 w-6" /><span>{T.search}</span></A></li>
          <li className="flex min-w-0 flex-1"><A href={links.industries} className={tab('categories')} current={active === 'categories'}>{mark('categories')}<LayoutGrid aria-hidden="true" className="h-6 w-6" /><span>{T.categories}</span></A></li>
          <li className="flex min-w-0 flex-1"><A href={links.pricing} className={tab('plans')} current={active === 'plans'}>{mark('plans')}<Tag aria-hidden="true" className="h-6 w-6" /><span>{T.plans}</span></A></li>
          <li className="flex min-w-0 flex-1">
            <button ref={moreButton} type="button" aria-haspopup="dialog" aria-expanded={sheet} onClick={() => setSheet(true)} className={tab('more')}>{mark('more')}<MoreHorizontal aria-hidden="true" className="h-6 w-6" /><span>{T.more}</span></button>
          </li>
        </ul>
      </nav>

      {sheet ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink-900/50" onClick={closeSheet} aria-hidden="true" />
          <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={T.moreTitle} className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-4 shadow-premium ${SAFE}`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900">{T.moreTitle}</h2>
              <button ref={closeButton} type="button" onClick={closeSheet} aria-label={T.close} className={`flex h-12 w-12 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 ${FOCUS}`}><X aria-hidden="true" className="h-6 w-6" /></button>
            </div>
            <ul className="pb-4">
              <li><A href={links.login} className={ROW} onClick={closeSheet}>{PORTAL.nav.signIn}</A></li>
              <li><A href={links.register} className={`${ROW} text-brand-700`} onClick={closeSheet}>{PORTAL.nav.start}</A></li>
              <li><A href={links.product} className={ROW} onClick={closeSheet}>{PORTAL.nav.product}</A></li>
              <li><A href={links.how} className={ROW} onClick={closeSheet}>{PORTAL.nav.how}</A></li>
              <li><A href={links.guides} className={ROW} onClick={closeSheet}>{PORTAL.nav.guides}</A></li>
              <li><A href={links.partners} className={ROW} onClick={closeSheet}>{PORTAL.nav.partners}</A></li>
              {mode !== 'hidden' ? (
                <li>
                  <button type="button" onClick={() => void install()} className={`${ROW} w-full gap-3 text-left`}><Download aria-hidden="true" className="h-5 w-5" /><span>{T.install}</span></button>
                  {hint ? (
                    <div role="status" className="mx-4 mb-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-slate-800">
                      <p className="font-semibold text-ink-900">{T.iosTitle}</p>
                      <p className="mt-1">{T.iosSteps}</p>
                      <button type="button" onClick={() => setHint(false)} className={`mt-2 min-h-11 rounded-lg px-3 text-sm font-semibold text-brand-700 ${FOCUS}`}>{T.iosGotIt}</button>
                    </div>
                  ) : null}
                </li>
              ) : null}
              {note ? <li role="status" className="px-4 py-2 text-sm text-slate-700">{note}</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
