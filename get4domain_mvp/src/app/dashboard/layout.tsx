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
import InstallPrompt from '@/components/InstallPrompt';

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
          { label: 'Customer Hub', href: '/dashboard/customer-hub', icon: 'UserCircle', moduleKey: 'customer_hub' },
          { label: 'Analytics Hub', href: '/dashboard/reports', icon: 'BarChart3', moduleKey: 'analytics_hub' },
        ],
      },
      {
        title: 'Account',
        items: [
          { label: 'Wallet & Billing', href: '/dashboard/wallet', icon: 'Wallet' },
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

  const openUpgrade = (item: NavItem) => {
    setUpgrade({
      feature: item.label,
      module: item.moduleKey ?? item.label,
      kind: item.walletGated ? 'wallet' : 'plan',
    });
    setSidebarOpen(false);
  };

  // Mobile bottom nav: Home + up to 3 top active modules + More.
  const mobileItems = useMemo<NavItem[]>(() => {
    const candidates: NavItem[] = [
      { label: 'Home', href: '/dashboard', icon: 'Home' },
      ...(cfg.industry?.dashboardTabs?.[0]
        ? [{
            label: cfg.industry.dashboardTabs[0].label,
            href: `/dashboard/domain-app/${cfg.industry.dashboardTabs[0].key}`,
            icon: cfg.industry.dashboardTabs[0].icon,
            moduleKey: 'domainapp',
          }]
        : []),
      { label: 'Growth', href: '/dashboard/campaigns', icon: 'Megaphone', moduleKey: 'growth_hub' },
      { label: 'TeleCRM', href: '/dashboard/telecrm', icon: 'Phone', moduleKey: 'telecrm' },
      { label: 'AI', href: '/dashboard/ai-studio', icon: 'Sparkles', walletGated: true },
    ];
    return candidates.filter((c) => !isLocked(c)).slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.industry, cfg.modules, cfg.addons, cfg.loading]);

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
            <img src="/logo.png" alt="Get4Domain" className="h-12 w-auto object-contain" style={{ maxHeight: '48px', maxWidth: '180px' }} />
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

        <nav
          className="flex-1 px-3 py-4 space-y-4"
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          {sections.map((section, si) => (
            section.items.length === 0 ? null : (
              <div key={section.title ?? si}>
                {section.title && (
                  <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
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
            )
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
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

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-slate-200 bg-white lg:hidden">
        {mobileItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${isActive(item.href) ? 'text-primary-600' : 'text-slate-500'}`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      <UpgradeModal
        isOpen={upgrade !== null}
        onClose={() => setUpgrade(null)}
        feature={upgrade?.feature ?? ''}
        requiredModule={upgrade?.module ?? ''}
        kind={upgrade?.kind ?? 'plan'}
      />

      <InstallPrompt />
    </div>
  );
}
