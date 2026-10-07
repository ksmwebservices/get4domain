'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { commerceApi } from '@/lib/commerce';
import { useAuth } from '@/lib/auth-context';
import { canSeeCommerce } from '@/lib/admin-nav';
import type { AdminRole } from '@/lib/auth';

const TABS = [
  { href: '/admin/commerce/deals', label: 'Deal builder' },
  { href: '/admin/commerce/invoices', label: 'Invoices' },
  { href: '/admin/commerce/payments', label: 'Payments to confirm', badge: 'payments' as const },
  { href: '/admin/commerce/promos', label: 'Promo codes' },
  { href: '/admin/commerce/plan-changes', label: 'Plan changes', badge: 'plans' as const },
  { href: '/admin/commerce/payee', label: 'Payee & QR' },
];

export default function CommerceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const adminRole: AdminRole = user?.adminRole ?? 'SUPER_ADMIN';
  const allowed = canSeeCommerce(adminRole);
  const [counts, setCounts] = useState({ payments: 0, plans: 0 });
  useEffect(() => {
    if (!allowed) return; // never call the commerce API for a role the server would refuse
    let alive = true;
    const load = () => commerceApi.summary().then((r) => { if (alive) setCounts({ payments: r.data?.paymentsToConfirm ?? 0, plans: r.data?.planChangeRequests ?? 0 }); }).catch(() => undefined);
    load();
    const t = setInterval(load, 45000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname, allowed]);

  // Opening a /admin/commerce URL directly as MARKETING staff shows nothing from this area.
  if (!loading && user && !allowed) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300" role="alert">
        Your staff role does not include billing and payments. Ask a Super Admin if you need access.
      </div>
    );
  }
  if (loading || !user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Commerce</h2>
        <p className="mt-1 text-sm text-slate-400">Custom deals, invoices, pay links, UPI QR payments and promo codes. Every amount is computed on the server.</p>
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Commerce sections">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          const n = t.badge ? counts[t.badge] : 0;
          return (
            <Link key={t.href} href={t.href} className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium ${active ? 'bg-primary-600/20 text-primary-300' : 'text-slate-400 hover:bg-slate-800/70'}`}>
              {t.label}
              {n > 0 && <span className="rounded-full bg-warning-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">{n}</span>}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
