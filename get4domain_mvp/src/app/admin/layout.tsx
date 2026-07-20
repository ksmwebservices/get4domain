'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, Bell,
  Settings, LogOut, Menu, X, MessageSquare, RefreshCw,
  BarChart3, Globe, Megaphone, CalendarCheck
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { requestNotificationPermission, subscribeToPush } from '@/lib/push-notifications';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview',      href: '/admin' },
  { icon: CalendarCheck,   label: 'Demo Bookings', href: '/admin/leads' },
  { icon: Users,           label: 'Vendors',       href: '/admin/customers' },
  { icon: FileText,        label: 'Invoices',      href: '/admin/invoices' },
  { icon: RefreshCw,       label: 'Renewals',      href: '/admin/renewals' },
  { icon: BarChart3,       label: 'Accounting',    href: '/admin/accounting' },
  { icon: Megaphone,       label: 'Campaigns',     href: '/admin/campaigns' },
  { icon: MessageSquare,   label: 'Support',       href: '/admin/support' },
  { icon: Globe,           label: 'Website CMS',   href: '/admin/cms' },
  { icon: Settings,        label: 'API Settings',  href: '/admin/api-settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role === 'vendor') router.push('/dashboard');
  }, [user, loading, router]);

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
            api.subscribeToPushNotifications(subscription).catch(() => {});
          }
        });
      }
    });
  }, [user]);

  useEffect(() => {
    const check = async () => {
      try {
        const result = await api.getUnreadNotifications();
        setNotifCount(result.data?.count ?? 0);
      } catch {
        // Backend notifications endpoint not implemented yet — stay at 0
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
              className="h-12 w-auto object-contain"
              style={{ maxHeight: '48px', maxWidth: '180px' }}
            />
            <div>
              <div className="text-xs text-slate-500 leading-none">Admin Panel</div>
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
              <div className="text-xs text-slate-400">Super Admin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
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

        <div className="border-t border-slate-800 p-3 space-y-1">
          <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <Globe className="h-4 w-4" />View Public Site
          </Link>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-slate-500 hover:text-error-400 transition-colors">
            <LogOut className="h-4 w-4" />Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-5 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block">
            <h1 className="text-sm font-semibold text-white">Get4Domain Admin Panel</h1>
            <p className="text-xs text-slate-500">Manage customers, invoices and demo bookings</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/support" className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800">
              <Bell className="h-5 w-5" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error-500 text-[10px] font-bold text-white">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {user.initials}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-950 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
