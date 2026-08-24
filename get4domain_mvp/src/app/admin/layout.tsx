'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, Bell,
  Settings, LogOut, Menu, X, MessageSquare, RefreshCw,
  BarChart3, Globe, Megaphone, CalendarCheck, SlidersHorizontal,
  Phone, Sparkles, FileSignature, ShieldCheck, Lock, HelpCircle, IndianRupee,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import type { AdminRole } from '@/lib/auth';
import { api } from '@/lib/api';
import { requestNotificationPermission, subscribeToPush } from '@/lib/push-notifications';
import AdminAccessModal from '@/components/AdminAccessModal';
import BottomSheet from '@/components/ui/BottomSheet';

// Role visibility groups (locked-tab pattern, same as vendor Stage 2).
const SUPER: AdminRole[] = ['SUPER_ADMIN'];
const SUPER_MKT: AdminRole[] = ['SUPER_ADMIN', 'MARKETING'];
const SUPER_OPS: AdminRole[] = ['SUPER_ADMIN', 'OPERATIONS'];

interface AdminNavItem {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  roles: AdminRole[];
}

const navItems: AdminNavItem[] = [
  { icon: LayoutDashboard,   label: 'Overview',      href: '/admin',              roles: SUPER },
  { icon: Phone,             label: 'TeleCRM',       href: '/admin/telecrm',      roles: SUPER_MKT },
  { icon: Sparkles,          label: 'AI Studio',     href: '/admin/ai-studio',    roles: SUPER_MKT },
  { icon: Sparkles,          label: 'Content Library', href: '/admin/library',    roles: SUPER_MKT },
  { icon: FileSignature,     label: 'Send Quote',    href: '/admin/send-quote',   roles: SUPER_MKT },
  { icon: CalendarCheck,     label: 'Demo Bookings', href: '/admin/leads',        roles: SUPER },
  { icon: Users,             label: 'Vendors',       href: '/admin/customers',    roles: SUPER },
  { icon: FileText,          label: 'Invoices',      href: '/admin/invoices',     roles: SUPER_OPS },
  { icon: RefreshCw,         label: 'Renewals',      href: '/admin/renewals',     roles: SUPER_OPS },
  { icon: BarChart3,         label: 'Accounting',    href: '/admin/accounting',   roles: SUPER },
  { icon: BarChart3,         label: 'Utilization',   href: '/admin/utilization',  roles: SUPER },
  { icon: Megaphone,         label: 'Campaigns',     href: '/admin/campaigns',    roles: SUPER },
  { icon: MessageSquare,     label: 'Support',       href: '/admin/support',      roles: SUPER_OPS },
  { icon: Globe,             label: 'Website CMS',   href: '/admin/cms',          roles: SUPER_OPS },
  { icon: SlidersHorizontal, label: 'Vendor Access', href: '/admin/vendor-access', roles: SUPER },
  { icon: IndianRupee,       label: 'Pricing Manager', href: '/admin/pricing',    roles: SUPER },
  { icon: Settings,          label: 'Integrations',  href: '/admin/api-settings', roles: SUPER },
  { icon: ShieldCheck,       label: 'Team',          href: '/admin/team',         roles: SUPER },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'work' | 'more'>(null);

  // Resolve the internal staff role. Legacy admin sessions (no adminRole yet)
  // and the bootstrap admin@get4domain.com are treated as SUPER_ADMIN.
  const adminRole: AdminRole = user?.adminRole ?? (user?.role === 'vendor' ? 'OPERATIONS' : 'SUPER_ADMIN');
  const canAccess = (item: AdminNavItem) => item.roles.includes(adminRole);
  const allowedItems = navItems.filter(canAccess);
  const firstAllowedHref = allowedItems[0]?.href ?? '/admin';
  const byHref = (href: string) => navItems.find((i) => i.href === href);
  const workItems = ['/admin/customers', '/admin/invoices', '/admin/support', '/admin/renewals'].map(byHref).filter(Boolean) as AdminNavItem[];

  // A fixed bottom-nav tab: navigates if allowed, else opens the access modal.
  const renderTabLink = (href: string, label: string, IconC: typeof LayoutDashboard) => {
    const item = byHref(href);
    const allowed = item ? canAccess(item) : true;
    const active = isItemActive(href);
    if (!allowed) {
      return (
        <button onClick={() => setAccessDenied(item?.label ?? label)} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-600">
          <IconC className="h-5 w-5" />{label}
        </button>
      );
    }
    return (
      <Link href={href} className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-primary-400' : 'text-slate-400'}`}>
        <IconC className="h-5 w-5" />{label}
      </Link>
    );
  };

  // Sheet renders on a white BottomSheet panel → use light-on-white styling.
  const renderSheetItem = (item: AdminNavItem) => {
    const Ic = item.icon;
    if (!canAccess(item)) {
      return (
        <button key={item.href} onClick={() => { setSheet(null); setAccessDenied(item.label); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-50">
          <Ic className="h-4 w-4 flex-shrink-0 text-slate-300" /><span className="flex-1 text-left">{item.label}</span><Lock className="h-3.5 w-3.5" />
        </button>
      );
    }
    return (
      <Link key={item.href} href={item.href} onClick={() => setSheet(null)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isItemActive(item.href) ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50'}`}>
        <Ic className={`h-4 w-4 flex-shrink-0 ${isItemActive(item.href) ? 'text-primary-600' : 'text-slate-400'}`} /><span className="flex-1">{item.label}</span>
      </Link>
    );
  };

  const isItemActive = (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(href));

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role === 'vendor') router.push('/dashboard');
  }, [user, loading, router]);

  // Redirect a staff member who lands directly on a section outside their role.
  useEffect(() => {
    if (loading || !user || user.role === 'vendor') return;
    const current = navItems.find((i) => isItemActive(i.href));
    if (current && !current.roles.includes(adminRole)) {
      router.replace(firstAllowedHref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loading, user, adminRole]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    requestNotificationPermission().then((granted) => {
      if (granted) {
        subscribeToPush().then((subscription) => {
          if (subscription) {
            const { endpoint, keys } = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            api.subscribeToPush({ endpoint, keys, device: 'web', userType: 'ADMIN' }).catch(() => {});
          }
        });
      }
    });
  }, [user]);

  useEffect(() => {
    const check = async () => {
      try {
        const result = await api.getNotifications();
        const items = (result.data ?? []) as Array<{ read: boolean }>;
        setNotifCount(items.filter((n) => !n.read).length);
      } catch {
        // Stay at 0 if the request fails
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-primary-500" />
          <p className="text-sm text-slate-400">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Dark sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 border-r border-slate-800 transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Get4Domain"
              className="h-[72px] w-auto object-contain"
              style={{ maxHeight: '72px', maxWidth: '240px' }}
            />
            <div>
              <div className="text-xs text-slate-500 leading-none">Admin Platform</div>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Admin user */}
        <div className="mx-3 mt-4 rounded-xl bg-slate-800 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {user.initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{user.name}</div>
              <div className="text-xs text-slate-400">{adminRole.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</div>
            </div>
          </div>
        </div>

        <nav
          className="flex-1 px-3 py-4 space-y-0.5"
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.href);
            const locked = !canAccess(item);
            if (locked) {
              return (
                <button key={`${item.href}-${item.label}`} onClick={() => { setAccessDenied(item.label); setSidebarOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-800/60"
                >
                  <Icon className="h-4 w-4 flex-shrink-0 text-slate-600" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <Lock className="h-3.5 w-3.5 text-slate-600" />
                </button>
              );
            }
            return (
              <Link key={`${item.href}-${item.label}`} href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-primary-600/20 text-primary-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary-400' : 'text-slate-500'}`} />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <Globe className="h-4 w-4" />View Public Site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-5 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block">
            <h1 className="text-sm font-semibold text-white">Get4Domain Admin Platform</h1>
            <p className="text-xs text-slate-500">Manage customers, invoices and demo bookings</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/admin/support" title="Help & Support" aria-label="Help & Support" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
              <HelpCircle className="h-5 w-5" />
            </Link>
            <Link href="/admin/support" aria-label="Notifications" className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800">
              <Bell className="h-5 w-5" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error-500 text-[10px] font-bold text-white">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </Link>
            <button onClick={logout} title="Sign Out" aria-label="Sign Out" className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-error-400">
              <LogOut className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {user.initials}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-950 p-5 pb-24 lg:p-8 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom nav — fixed 5 tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-slate-800 bg-slate-900 lg:hidden">
        {renderTabLink('/admin', 'Overview', LayoutDashboard)}
        {renderTabLink('/admin/telecrm', 'TeleCRM', Phone)}
        {renderTabLink('/admin/ai-studio', 'AI', Sparkles)}
        <button onClick={() => setSheet('work')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-400">
          <FileText className="h-5 w-5" />Work
        </button>
        <button onClick={() => setSheet('more')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-400">
          <Menu className="h-5 w-5" />More
        </button>
      </nav>

      <BottomSheet isOpen={sheet === 'work'} onClose={() => setSheet(null)} title="Work">
        <div className="space-y-0.5">{workItems.map(renderSheetItem)}</div>
      </BottomSheet>
      <BottomSheet isOpen={sheet === 'more'} onClose={() => setSheet(null)} title="Admin Menu">
        <div className="space-y-0.5">
          {navItems.map(renderSheetItem)}
          <button onClick={() => { setSheet(null); logout(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-error-400">
            <LogOut className="h-4 w-4" />Sign Out
          </button>
        </div>
      </BottomSheet>

      <AdminAccessModal isOpen={accessDenied !== null} onClose={() => setAccessDenied(null)} feature={accessDenied ?? ''} />
    </div>
  );
}
