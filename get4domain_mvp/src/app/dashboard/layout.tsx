'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Rocket, LayoutDashboard, Globe, Megaphone, FileText,
  CreditCard, Bell, Settings, LogOut, Menu, X, ChevronRight, HelpCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import DashboardChatBot from '@/components/DashboardChatBot';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',          href: '/dashboard' },
  { icon: Globe,           label: 'My DomainApp',       href: '/dashboard/domain-app' },
  { icon: Megaphone,       label: 'My DomainCampaign',  href: '/dashboard/domain-campaign' },
  { icon: CreditCard,      label: 'Billing & Payments', href: '/dashboard/billing' },
  { icon: FileText,        label: 'Invoices',           href: '/dashboard/invoices' },
  { icon: Bell,            label: 'Notifications',      href: '/dashboard/notifications', badge: '1' },
  { icon: HelpCircle,      label: 'Support',            href: '/dashboard/support' },
  { icon: Settings,        label: 'Settings',           href: '/dashboard/settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && (user.role === 'admin' || user.role === 'super_admin')) {
      router.push('/admin');
    }
  }, [user, loading, router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white border-r border-slate-200 transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-primary-500">
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-slate-900">Get4<span className="text-primary-600">Domain</span></span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mt-4 rounded-xl bg-primary-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {user.initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
              <div className="truncate text-xs text-slate-500">{user.businessName ?? user.email}</div>
            </div>
          </div>
          {user.plan && (
            <div className="mt-2 rounded-lg bg-white px-2.5 py-1.5">
              <span className="text-xs font-semibold text-primary-700">{user.plan}</span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400'}`} />
                <span className="flex-1">{item.label}</span>
                {'badge' in item && item.badge && (
                  <span className="rounded-full bg-error-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">{item.badge}</span>
                )}
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <button onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-error-600 transition-colors">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
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
          <div className="flex items-center gap-3">
            <Link href="/dashboard/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error-500" />
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 select-none">
              {user.initials}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">{children}</main>
      </div>
      <DashboardChatBot vendorName={user.name} industry={user.industry} />
    </div>
  );
}
