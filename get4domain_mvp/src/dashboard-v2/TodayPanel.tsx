'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Circle, ShoppingBag, UserPlus } from 'lucide-react';
import { checklistDone, goLiveChecklist } from '@/lib/nav.generated';
import { useV2 } from '@/dashboard-v2/context';

const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Dashboard v2 "Today": what needs attention now. Every number comes from the vendor's own data (GET /dashboard/context).
 * Shown above the existing Overview, only for vendors on Dashboard v2.
 */
export default function TodayPanel() {
  const v2 = useV2();
  const ctx = v2?.ctx;
  if (!ctx) return null;
  const { signals, paymentDue } = ctx;
  const checklist = goLiveChecklist(ctx.profile);
  const done = checklist.filter((c) => checklistDone(c.id, signals)).length;
  const attention = [
    signals.pendingOrders > 0 && { href: '/dashboard/commerce/orders', icon: ShoppingBag, text: `${signals.pendingOrders} order${signals.pendingOrders === 1 ? '' : 's'} waiting for you` },
    signals.newLeads7d > 0 && { href: '/dashboard/sales/leads', icon: UserPlus, text: `${signals.newLeads7d} new lead${signals.newLeads7d === 1 ? '' : 's'} this week` },
    signals.lowStock > 0 && ctx.profile === 'COMMERCE' && { href: '/dashboard/commerce/stock', icon: AlertTriangle, text: `${signals.lowStock} product${signals.lowStock === 1 ? '' : 's'} low on stock` },
    paymentDue && { href: '/dashboard/account/billing?tab=billing', icon: AlertTriangle, text: `${rupees(paymentDue.totalPaise)} due for your plan` },
  ].filter(Boolean) as { href: string; icon: typeof AlertTriangle; text: string }[];

  return (
    <section aria-label="Today" className="mb-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
        <h2 className="text-sm font-bold text-ink-50">Needs your attention</h2>
        {attention.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">Nothing waiting. New orders, leads and low stock will show up here.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attention.map((a) => (
              <li key={a.text}><Link href={a.href} className="flex items-center gap-3 rounded-xl border border-ink-800 px-3 py-2 text-sm text-ink-100 hover:border-brand-500/50"><a.icon className="h-4 w-4 flex-shrink-0 text-brand-400" aria-hidden />{a.text}</Link></li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-50">Get ready to go live</h2>
          <span className="text-xs text-ink-400" aria-label={`${done} of ${checklist.length} done`}>{done} of {checklist.length} done</span>
        </div>
        <ul className="mt-3 space-y-2">
          {checklist.map((c) => {
            const ok = checklistDone(c.id, signals);
            return (
              <li key={c.id}>
                <Link href={c.route} className="flex items-start gap-3 rounded-xl px-1 py-1 text-sm hover:bg-ink-800/60">
                  {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-400" aria-label="Done" /> : <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-500" aria-label="Not done yet" />}
                  <span><span className={ok ? 'text-ink-400 line-through' : 'font-medium text-ink-100'}>{c.label}</span>{!ok && <span className="block text-xs text-ink-500">{c.hint}</span>}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
