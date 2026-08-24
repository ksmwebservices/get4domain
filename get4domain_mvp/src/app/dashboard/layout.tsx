'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X, ChevronRight, Bell, HelpCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDashboardConfig, TAB_ADDON_REQUIREMENT } from '@/lib/dashboard-config';
import { api } from '@/lib/api';
import { requestNotificationPermission, subscribeToPush } from '@/lib/push-notifications';
import Icon from '@/components/ui/Icon';
import LockedBadge from '@/components/ui/LockedBadge';
import UpgradeModal from '@/components/UpgradeModal';
import BottomSheet from '@/components/ui/BottomSheet';
import InstallPrompt from '@/components/InstallPrompt';
import TourNav from '@/components/TourNav';
import DashboardSplash from '@/components/DashboardSplash';

// Maps a nav item → the team-access area that gates it for a vendor team member
// (mirrors the backend's team-access areas). Base items have no mapping → visible.
const TEAM_AREA_BY_MODULE: Record<string, string> = {
  growth_hub: 'campaigns', telecrm: 'telecrm', communication_hub: 'communication',
  website_manager: 'website', analytics_hub: 'reports',
};
const TEAM_AREA_BY_HREF: Record<string, string> = {
  '/dashboard/accounts': 'accounts', '/dashboard/wallet': 'wallet', '/dashboard/invoices': 'wallet',
  '/dashboard/campaigns': 'campaigns', '/dashboard/telecrm': 'telecrm',
  '/dashboard/communication': 'communication', '/dashboard/my-website': 'website',
  '/dashboard/reports': 'reports', '/dashboard/ai-studio': 'ai_studio',
};

interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name
  moduleKey?: string; // gated by this module
  addonKey?: string; // additionally gated by this addon
  walletGated?: boolean; // available to all, prompts wallet top-up
}
interface NavSection {
  title?: string;
  items: NavItem[];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheet, setSheet] = useState<null | 'business' | 'campaign' | 'more'>(null);
  const [mounted, setMounted] = useState(false);
  const [upgrade, setUpgrade] = useState<{ feature: string; module: string; kind: 'wallet' | 'plan' } | null>(null);

  const cfg = useDashboardConfig(user?.industry);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && (user.role === 'admin' || user.role === 'super_admin')) router.push('/admin');
  }, [user, loading, router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  useEffect(() => { setMounted(true); }, []);

  // Register push for the vendor (reuses existing VAPID/Web Push implementation).
  useEffect(() => {
    if (!user || user.role !== 'vendor') return;
    requestNotificationPermission().then((granted) => {
      if (!granted) return;
      subscribeToPush().then((sub) => {
        if (!sub) return;
        const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        api.subscribeToPush({ endpoint, keys, device: 'web', userType: 'VENDOR' }).catch(() => {});
      });
    });
  }, [user]);

  const sections = useMemo<NavSection[]>(() => {
    const industryTabs: NavItem[] = (cfg.industry?.dashboardTabs ?? []).map((tab) => ({
      label: tab.label,
      href: `/dashboard/domain-app/${tab.key}`,
      icon: tab.icon,
      moduleKey: 'domainapp',
      addonKey: TAB_ADDON_REQUIREMENT[tab.key],
    }));

    return [
      { items: [{ label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' }] },
      {
        title: cfg.industry ? cfg.industry.label : 'DomainApp',
        items: industryTabs,
      },
      {
        title: 'Grow',
        items: [
          { label: 'Growth Hub', href: '/dashboard/campaigns', icon: 'Megaphone', moduleKey: 'growth_hub' },
          { label: 'TeleCRM', href: '/dashboard/telecrm', icon: 'Phone', moduleKey: 'telecrm' },
          { label: 'AI Studio', href: '/dashboard/ai-studio', icon: 'Sparkles', walletGated: true },
          { label: 'Communication Hub', href: '/dashboard/communication', icon: 'MessagesSquare', moduleKey: 'communication_hub' },
        ],
      },
      {
        title: 'Manage',
        items: [
          { label: 'Website Manager', href: '/dashboard/my-website', icon: 'Globe', moduleKey: 'website_manager' },
          { label: 'Embed / Widget', href: '/dashboard/embed', icon: 'Code', moduleKey: 'website_manager' },
          { label: 'Domain', href: '/dashboard/domain-management', icon: 'Link' },
          { label: 'Customer Hub', href: '/dashboard/customer-hub', icon: 'UserCircle', moduleKey: 'customer_hub' },
          { label: 'Analytics Hub', href: '/dashboard/reports', icon: 'BarChart3', moduleKey: 'analytics_hub' },
        ],
      },
      {
        title: 'Account',
        items: [
          { label: 'Wallet & Billing', href: '/dashboard/wallet', icon: 'Wallet' },
          { label: 'Invoices', href: '/dashboard/invoices', icon: 'FileText' },
          { label: 'Accounts', href: '/dashboard/accounts', icon: 'Receipt' },
          { label: 'Stationery', href: '/dashboard/stationery', icon: 'Package' },
          { label: 'Team', href: '/dashboard/team', icon: 'UserPlus' },
          { label: 'Support', href: '/dashboard/support', icon: 'HelpCircle' },
          { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
        ],
      },
    ];
  }, [cfg.industry]);

  // A gated item is only locked once config has loaded (avoid a locked flash).
  const isLocked = (item: NavItem): boolean => {
    if (cfg.loading) return false;
    if (item.walletGated) return false;
    if (item.moduleKey && cfg.modules[item.moduleKey] === false) return true;
    if (item.addonKey && cfg.addons[item.addonKey] === false) return true;
    return false;
  };

  // A vendor's team member only sees the areas their department/modules grant.
  // Items with no team-area mapping are base items (always visible). Server-side
  // enforcement (backend ModuleGuard) is the real boundary — this just hides the nav.
  const hiddenForTeam = (item: NavItem): boolean => {
    if (user?.kind !== 'team_member') return false;
    if (item.href === '/dashboard/team') return true; // team management is owner-only
    const area =
      (item.moduleKey && TEAM_AREA_BY_MODULE[item.moduleKey]) || TEAM_AREA_BY_HREF[item.href];
    if (!area) return false;
    return !(user.modules ?? []).includes(area);
  };
  const visibleItems = (items: NavItem[]): NavItem[] => items.filter((i) => !hiddenForTeam(i));

  const openUpgrade = (item: NavItem) => {
    setUpgrade({
      feature: item.label,
      module: item.moduleKey ?? item.label,
      kind: item.walletGated ? 'wallet' : 'plan',
    });
    setSidebarOpen(false);
  };

  // Sheet contents for the fixed mobile bottom nav.
  const businessItems = visibleItems(sections[1]?.items ?? []);
  const campaignItems = visibleItems((sections.find((s) => s.title === 'Grow')?.items ?? []).filter((i) => i.label !== 'AI Studio'));

  // Renders a nav item respecting the locked/upgrade pattern; closes the sheet on tap.
  const renderSheetItem = (item: NavItem) => {
    const locked = isLocked(item);
    if (locked) {
      return (
        <button key={item.href} onClick={() => { openUpgrade(item); setSheet(null); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-50">
          <Icon name={item.icon} className="h-4 w-4 flex-shrink-0 text-slate-300" />
          <span className="flex-1 text-left">{item.label}</span>
          <LockedBadge />
        </button>
      );
    }
    return (
      <Link key={item.href} href={item.href} onClick={() => setSheet(null)}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive(item.href) ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}>
        <Icon name={item.icon} className={`h-4 w-4 flex-shrink-0 ${isActive(item.href) ? 'text-primary-600' : 'text-slate-400'}`} />
        <span className="flex-1">{item.label}</span>
      </Link>
    );
  };

  if (!mounted || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-slate-500">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white border-r border-slate-200 transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Get4Domain" className="h-[72px] w-auto object-contain" style={{ maxHeight: '72px', maxWidth: '240px' }} />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mt-4 flex-shrink-0 rounded-xl bg-primary-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {user.initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
              <div className="truncate text-xs text-slate-500">{user.businessName ?? user.email}</div>
              {cfg.industry && <div className="mt-0.5 text-xs text-primary-600">{cfg.industry.label}</div>}
            </div>
          </div>
          {user.plan && (
            <div className="mt-2 rounded-lg bg-white px-2.5 py-1.5">
              <span className="text-xs font-semibold text-primary-700">{user.plan}</span>
            </div>
          )}
        </div>

        {/* Persistent link to the public website (opens in a new tab) */}
        <a href={`/demo/${user.industry ?? 'general'}`} target="_blank" rel="noopener noreferrer"
          className="mx-3 mt-3 flex flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-700">
          <Icon name="Globe" className="h-4 w-4" /> View Website
        </a>

        <nav
          className="flex-1 px-3 py-4 space-y-4"
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          {sections.map((section, si) => {
            const items = visibleItems(section.items);
            return items.length === 0 ? null : (
              <div key={section.title ?? si}>
                {section.title && (
                  <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const locked = isLocked(item);
                    const active = isActive(item.href);
                    if (locked) {
                      return (
                        <button
                          key={item.href}
                          onClick={() => openUpgrade(item)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-50 transition-colors"
                        >
                          <Icon name={item.icon} className="h-4 w-4 flex-shrink-0 text-slate-300" />
                          <span className="flex-1 text-left">{item.label}</span>
                          <LockedBadge />
                        </button>
                      );
                    }
                    return (
                      <Link key={item.href} href={item.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                      >
                        <Icon name={item.icon} className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary-600' : 'text-slate-400'}`} />
                        <span className="flex-1">{item.label}</span>
                        {active && <ChevronRight className="h-3.5 w-3.5 text-primary-400" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
          <button onClick={() => setSheet('more')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block">
            <h1 className="text-base font-semibold text-slate-900">{user.businessName ?? 'Vendor'} Dashboard</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/dashboard/support" title="Help & Support" aria-label="Help & Support" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <HelpCircle className="h-5 w-5" />
            </Link>
            <Link href="/dashboard/notifications" aria-label="Notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error-500" />
            </Link>
            <button onClick={logout} title="Sign Out" aria-label="Sign Out" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-error-600">
              <LogOut className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 select-none">
              {user.initials}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 pb-24 lg:p-8 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom nav — fixed 5 tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-slate-200 bg-white lg:hidden">
        <Link href="/dashboard" className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${pathname === '/dashboard' ? 'text-primary-600' : 'text-slate-500'}`}>
          <Icon name="Home" className="h-5 w-5" />Home
        </Link>
        <button onClick={() => setSheet('business')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <Icon name="ClipboardList" className="h-5 w-5" />Business
        </button>
        <button onClick={() => setSheet('campaign')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <Icon name="Megaphone" className="h-5 w-5" />Campaign
        </button>
        <Link href="/dashboard/ai-studio" className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${isActive('/dashboard/ai-studio') ? 'text-primary-600' : 'text-slate-500'}`}>
          <Icon name="Sparkles" className="h-5 w-5" />AI
        </Link>
        <button onClick={() => setSheet('more')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500">
          <Menu className="h-5 w-5" />More
        </button>
      </nav>

      {/* Bottom-sheet menus for the mobile nav */}
      <BottomSheet isOpen={sheet === 'business'} onClose={() => setSheet(null)} title={cfg.industry?.label ?? 'Business'}>
        <div className="space-y-0.5">{businessItems.length ? businessItems.map(renderSheetItem) : <p className="px-3 py-4 text-sm text-slate-400">No business tabs available.</p>}</div>
      </BottomSheet>
      <BottomSheet isOpen={sheet === 'campaign'} onClose={() => setSheet(null)} title="Campaign">
        <div className="space-y-0.5">{campaignItems.map(renderSheetItem)}</div>
      </BottomSheet>
      <BottomSheet isOpen={sheet === 'more'} onClose={() => setSheet(null)} title="Menu">
        <div className="space-y-4">
          {sections.map((section, si) => {
            const items = visibleItems(section.items);
            return items.length === 0 ? null : (
              <div key={section.title ?? si}>
                {section.title && <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</div>}
                <div className="space-y-0.5">{items.map(renderSheetItem)}</div>
              </div>
            );
          })}
          <button onClick={() => { setSheet(null); logout(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-error-600">
            <LogOut className="h-4 w-4" />Sign Out
          </button>
        </div>
      </BottomSheet>

      <UpgradeModal
        isOpen={upgrade !== null}
        onClose={() => setUpgrade(null)}
        feature={upgrade?.feature ?? ''}
        requiredModule={upgrade?.module ?? ''}
        kind={upgrade?.kind ?? 'plan'}
      />

      <InstallPrompt />
      <TourNav />
      <DashboardSplash />
    </div>
  );
}
