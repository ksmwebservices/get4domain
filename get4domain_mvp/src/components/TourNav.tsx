'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Globe, LayoutDashboard, UserCircle, X, Rocket } from 'lucide-react';

interface TourCtx { industry: string; customerToken?: string | null }

/**
 * Unified demo-tour switcher. When a tour is active (localStorage `g4d_tour`),
 * this floating nav lets the lead move between the demo website, vendor dashboard,
 * and customer portal within the SAME sandbox session — no re-authentication.
 * Switching to the customer portal seats the pre-minted customer session token
 * (bridging the portal's separate auth to the same sandbox). Renders nothing when
 * no tour is active, so it's safe to mount on every surface.
 */
export default function TourNav() {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<TourCtx | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('g4d_tour');
      setCtx(raw ? (JSON.parse(raw) as TourCtx) : null);
    } catch { setCtx(null); }
  }, [pathname]);

  if (!ctx) return null;

  const go = (where: 'site' | 'dashboard' | 'portal') => {
    if (where === 'portal' && ctx.customerToken) localStorage.setItem('g4d_customer_token', ctx.customerToken);
    const url = where === 'site' ? `/demo/${ctx.industry}` : where === 'dashboard' ? '/dashboard' : '/customer';
    window.location.href = url;
  };
  // Leaving the demo returns to Get4Domain — the dashboard for a signed-in tour,
  // otherwise the marketing home. Answers "how do I get back to Get4Domain?".
  const exit = () => {
    localStorage.removeItem('g4d_tour');
    const backToDashboard = typeof window !== 'undefined' && !!localStorage.getItem('g4d_token');
    window.location.href = backToDashboard ? '/dashboard' : '/';
  };

  const tabs = [
    { key: 'site' as const, label: 'Website', icon: Globe, active: pathname.startsWith('/demo') },
    { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, active: pathname.startsWith('/dashboard') },
    { key: 'portal' as const, label: 'Customer', icon: UserCircle, active: pathname.startsWith('/customer') },
  ];

  return (
    <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 md:bottom-4">
      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur">
        <span className="hidden px-2 text-[10px] font-bold uppercase tracking-wide text-primary-600 sm:inline">Demo tour</span>
        {tabs.map((t) => {
          const Ic = t.icon;
          return (
            <button key={t.key} onClick={() => go(t.key)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors ${t.active ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Ic className="h-3.5 w-3.5" />{t.label}
            </button>
          );
        })}
        <Link href="/dashboard/go-live" className="flex items-center gap-1 rounded-xl bg-success-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-success-600">
          <Rocket className="h-3.5 w-3.5" />Go live
        </Link>
        <button onClick={exit} className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" title="Leave the demo and return to Get4Domain">
          <X className="h-3.5 w-3.5" />Exit
        </button>
      </div>
    </div>
  );
}
