'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import InstallPrompt from '@/components/InstallPrompt';
import LeadSpaceApp from './LeadSpaceApp';

/**
 * The dashboard for a LeadSpace-only vendor: a small header and the five tabs. No invoices, stock, accounts or TeleCRM. The few other pages a vendor
 * may still need (buying a plan, notifications, help, the website and domain they chose to set up) open inside this frame with a way back.
 */
export default function LeadSpaceShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    api.getNotifications().then((r) => setUnread(((r?.data ?? r ?? []) as { read: boolean }[]).filter((n) => !n.read).length)).catch(() => setUnread(0));
  }, [pathname]);
  const home = pathname === '/dashboard' || pathname.startsWith('/dashboard/leadspace');

  return (
    <div className="vendor-ui min-h-screen bg-ink-950">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <Link href="/dashboard" className="truncate text-base font-extrabold text-slate-900">{user?.businessName || 'LeadSpace'}</Link>
        <div className="flex items-center gap-1">
          <Link href="/dashboard/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </Link>
          <button onClick={() => logout()} aria-label="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>
      {home ? <LeadSpaceApp mode="app" /> : (
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4" /> Back to LeadSpace</Link>
          {children}
        </div>
      )}
      <InstallPrompt />
    </div>
  );
}
