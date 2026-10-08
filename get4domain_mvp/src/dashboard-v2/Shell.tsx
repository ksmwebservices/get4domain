'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronDown, ChevronRight, HelpCircle, LogOut, Lock, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useDashboardConfig } from '@/lib/dashboard-config';
import { resolveView } from '@/domainapp/tab-registry';
import { openMyWebsite } from '@/lib/view-website';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import BottomSheet from '@/components/ui/BottomSheet';
import InstallPrompt from '@/components/InstallPrompt';
import DashboardSplash from '@/components/DashboardSplash';
import { DEPARTMENTS, FEATURES, PRIMARY_WORK_LABEL, labelFor, planDisplayName, resolveLegacyRoute, tabOwner, type Feature, type FeatureState } from '@/lib/nav.generated';
import { V2Provider, stateFor, useV2 } from '@/dashboard-v2/context';
import { UpgradeCard } from '@/dashboard-v2/UpgradeCard';
import PaymentDueBanner from '@/dashboard-v2/PaymentDueBanner';

interface Item { feature: Feature; label: string; state: Exclude<FeatureState, 'HIDDEN'> }

const COOKIE = 'g4d_nav_v2';
const setCookie = (on: boolean): void => {
  try { document.cookie = `${COOKIE}=${on ? '1' : ''}; path=/; max-age=${on ? 60 * 60 * 24 * 30 : 0}; SameSite=Lax`; } catch { /* cookies blocked: the in-app fallback redirect still works */ }
};

/** The Dashboard v2 sidebar items for this vendor, grouped by department (HIDDEN items and empty departments dropped). */
export function useMenu(): { id: string; label: string; icon: string; items: Item[] }[] {
  const v2 = useV2();
  const { user } = useAuth();
  const cfg = useDashboardConfig(user?.industry);
  // "Industry workspace" is only offered when this business's industry really has operation tabs for it (retail has none: no empty screen in the menu).
  const hasOperationTabs = !cfg.loading && (cfg.industry?.dashboardTabs ?? []).some((t) => tabOwner(t.key) === 'workspace' && resolveView(t.key) !== 'addon');
  return useMemo(() => {
    if (!v2?.ctx) return [];
    const profile = v2.ctx.profile;
    return DEPARTMENTS.map((d) => ({
      id: d.id, label: d.label, icon: d.icon,
      items: FEATURES.filter((f) => f.department === d.id).flatMap((f): Item[] => {
        const state = stateFor(f, v2);
        if (f.id === 'commerce.workspace' && !hasOperationTabs) return [];
        return state === 'HIDDEN' ? [] : [{ feature: f, label: labelFor(f, profile), state }];
      }),
    })).filter((d) => d.items.length > 0);
  }, [v2, hasOperationTabs]);
}

const isActive = (pathname: string, route: string): boolean => (route === '/dashboard' ? pathname === '/dashboard' : pathname === route || pathname.startsWith(`${route}/`));

function MenuList({ onNavigate, onLocked }: { onNavigate?: () => void; onLocked: (i: Item) => void }) {
  const pathname = usePathname();
  const menu = useMenu();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setCollapsed(JSON.parse(localStorage.getItem('g4d_v2_collapsed') || '{}')); } catch { /* ignore */ } }, []);
  const toggle = (id: string): void => setCollapsed((c) => { const n = { ...c, [id]: !c[id] }; try { localStorage.setItem('g4d_v2_collapsed', JSON.stringify(n)); } catch { /* ignore */ } return n; });

  return (
    <nav aria-label="Dashboard" className="space-y-3">
      {menu.map((d) => {
        const hasActive = d.items.some((i) => i.state === 'OPEN' && isActive(pathname, i.feature.route));
        const open = !collapsed[d.id] || hasActive;
        return (
          <div key={d.id}>
            <button type="button" onClick={() => toggle(d.id)} aria-expanded={open} className="flex w-full items-center justify-between px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600">
              <span>{d.label}</span>{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {open && (
              <ul className="space-y-0.5">
                {d.items.map((i) => {
                  const active = i.state === 'OPEN' && isActive(pathname, i.feature.route);
                  const badge = planDisplayName(i.feature.minPlan);
                  if (i.state === 'OPEN') {
                    return (
                      <li key={i.feature.id}>
                        <Link href={i.feature.route} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${active ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                          <Icon name={i.feature.icon} className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary-600' : 'text-slate-400'}`} />
                          <span className="flex-1">{i.label}</span>
                        </Link>
                      </li>
                    );
                  }
                  if (i.state === 'LOCKED') {
                    return (
                      <li key={i.feature.id}>
                        <button type="button" onClick={() => onLocked(i)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-400 hover:bg-slate-50">
                          <Icon name={i.feature.icon} className="h-4 w-4 flex-shrink-0 text-slate-300" />
                          <span className="flex-1">{i.label}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"><Lock className="h-3 w-3" aria-hidden />{badge}</span>
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li key={i.feature.id} aria-disabled="true" title="Coming soon" className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300">
                      <Icon name={i.feature.icon} className="h-4 w-4 flex-shrink-0 text-slate-200" />
                      <span className="flex-1">{i.label}</span>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Coming soon · {badge}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const v2 = useV2();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [locked, setLocked] = useState<Item | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => { setCookie(true); }, []);
  useEffect(() => { setSidebarOpen(false); setUserMenu(false); setMore(false); }, [pathname]);
  // Old addresses (bookmarks, links) go to their new home. The server does this too (middleware); this covers in-app navigation to an old path.
  useEffect(() => {
    const to = resolveLegacyRoute(FEATURES, pathname, typeof window === 'undefined' ? '' : window.location.search);
    if (to) router.replace(to);
  }, [pathname, router]);
  useEffect(() => {
    api.getNotifications().then((r) => setUnread(((r?.data ?? r ?? []) as { read: boolean }[]).filter((n) => !n.read).length)).catch(() => setUnread(0));
  }, [pathname]);

  const onLocked = useCallback((i: Item) => { setSidebarOpen(false); setMore(false); setLocked(i); }, []);
  const ctx = v2?.ctx;
  const profile = ctx?.profile ?? 'SERVICES';
  const open = (id: string): Feature | undefined => FEATURES.find((f) => f.id === id);
  const tabs: { label: string; href: string; icon: string; feature?: Feature }[] = [
    { label: 'Home', href: '/dashboard', icon: 'Home' },
    { label: PRIMARY_WORK_LABEL[profile], href: open('commerce.orders')?.route ?? '/dashboard', icon: 'ClipboardList', feature: open('commerce.orders') },
    { label: 'Website', href: open('website.content')?.route ?? '/dashboard', icon: 'Globe', feature: open('website.content') },
    { label: 'Marketing', href: open('marketing.ai-studio')?.route ?? '/dashboard', icon: 'Sparkles', feature: open('marketing.ai-studio') },
  ];

  if (v2?.loading || !user) {
    return <div className="vendor-ui flex min-h-screen items-center justify-center bg-ink-950"><div className="flex flex-col items-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-700 border-t-brand-500" /><p className="text-sm text-slate-500">Loading your dashboard…</p></div></div>;
  }
  if (!ctx) {
    return <div className="vendor-ui flex min-h-screen items-center justify-center bg-ink-950 p-6 text-center text-sm text-slate-300"><div><p>We could not load your dashboard.</p><button onClick={() => v2?.reload()} className="mt-3 rounded-xl bg-primary-600 px-4 py-2 font-semibold text-white">Try again</button></div></div>;
  }

  return (
    <div className="vendor-ui flex min-h-screen bg-ink-950">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <Link href="/dashboard" className="truncate text-lg font-extrabold text-slate-900">{ctx.businessName || user.businessName || 'Dashboard'}</Link>
          <button onClick={() => setSidebarOpen(false)} aria-label="Close menu" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <div className="mx-3 mt-3 flex-shrink-0 rounded-xl bg-primary-50 p-3 text-xs">
          <div className="font-semibold text-slate-900">{user.name}</div>
          <div className="mt-0.5 text-primary-700">{ctx.planDisplay} plan{ctx.custom ? ' · Custom client' : ''}</div>
        </div>
        <button onClick={() => openMyWebsite(user)} className="mx-3 mt-3 flex flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-700">
          <Icon name="Globe" className="h-4 w-4" /> View website
        </button>
        <div className="flex-1 overflow-y-auto px-3 py-4" style={{ overscrollBehavior: 'contain' }}><MenuList onNavigate={() => setSidebarOpen(false)} onLocked={onLocked} /></div>
        <a href="https://get4domain.com" target="_blank" rel="noopener noreferrer" className="flex flex-shrink-0 items-center justify-center gap-1.5 border-t border-slate-100 px-5 py-3 text-[11px] font-medium text-slate-400 hover:text-slate-600">
          Powered by <img src="/logo.png" alt="Get4Domain" className="h-4 w-auto object-contain opacity-70" />
        </a>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
          <h1 className="hidden text-base font-semibold text-slate-900 lg:block">{ctx.businessName || 'Your'} dashboard</h1>
          <div className="flex items-center gap-1">
            <Link href="/dashboard/account/help" title="Help and support" aria-label="Help and support" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><HelpCircle className="h-5 w-5" /></Link>
            <Link href="/dashboard/communication/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <div className="relative ml-0.5">
              <button onClick={() => setUserMenu((x) => !x)} aria-haspopup="menu" aria-expanded={userMenu} title={user.name} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 hover:ring-2 hover:ring-primary-300">{user.initials}</button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    <div className="px-2.5 py-2"><div className="truncate text-sm font-semibold text-slate-900">{user.name}</div><div className="truncate text-xs text-slate-500">{user.email}</div></div>
                    <div className="my-1 border-t border-slate-100" />
                    <Link href="/dashboard/account/profile" onClick={() => setUserMenu(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Business profile</Link>
                    <button onClick={() => { setUserMenu(false); setCookie(false); logout(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-error-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Sign out</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <PaymentDueBanner />
        <main className="flex-1 overflow-y-auto bg-radial-glow p-5 pb-24 lg:p-8 lg:pb-8">{children}</main>
      </div>

      <nav aria-label="Main tabs" className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-slate-200 bg-white lg:hidden">
        {tabs.map((t) => (
          <Link key={t.label} href={t.href} className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${isActive(pathname, t.href) ? 'text-primary-600' : 'text-slate-500'}`}>
            <Icon name={t.icon} className="h-5 w-5" />{t.label}
          </Link>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"><Menu className="h-5 w-5" />More</button>
      </nav>
      <BottomSheet isOpen={more} onClose={() => setMore(false)} title="Menu"><MenuList onNavigate={() => setMore(false)} onLocked={onLocked} /></BottomSheet>

      <Modal isOpen={locked !== null} onClose={() => setLocked(null)} title={locked?.label} maxWidth="max-w-md">
        {locked && <UpgradeCard feature={locked.feature} label={locked.label} compact />}
      </Modal>
      <InstallPrompt />
      <DashboardSplash />
    </div>
  );
}

/** Dashboard v2: ten departments, each item Open / Locked / Coming soon. Only mounted for vendors with the nav_v2 switch on. */
export default function DashboardV2Shell({ children }: { children: ReactNode }) {
  return <V2Provider><ShellInner>{children}</ShellInner></V2Provider>;
}
