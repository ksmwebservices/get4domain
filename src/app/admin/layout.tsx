'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Rocket, LayoutDashboard, Users, FileText, CreditCard, Bell,
  Settings, LogOut, Menu, X, ChevronRight, MessageSquare,
  Package, BarChart3, Globe, Megaphone, CalendarCheck
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview',      href: '/admin' },
  { icon: CalendarCheck,   label: 'Demo Bookings', href: '/admin/leads',     badge: '3' },
  { icon: Users,           label: 'Customers',     href: '/admin/customers' },
  { icon: FileText,        label: 'Invoices',      href: '/admin/invoices' },
  { icon: CreditCard,      label: 'Payments',      href: '/admin/invoices' },
  { icon: Globe,           label: 'DomainApp',     href: '/admin/plans' },
  { icon: Megaphone,       label: 'DomainCampaign',href: '/admin/plans' },
  { icon: MessageSquare,   label: 'Support',       href: '/admin/support',   badge: '2' },
  { icon: BarChart3,       label: 'Analytics',     href: '/admin' },
  { icon: Settings,        label: 'Settings',      href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role === 'vendor') router.push('/dashboard');
  }, [user, loading, router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (loading || !user) {
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-500">
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-white">Get4Domain</span>
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
                {'badge' in item && item.badge && (
                  <span className="rounded-full bg-error-600 px-1.5 py-0.5 text-xs font-bold text-white leading-none">{item.badge}</span>
                )}
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
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error-500" />
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
