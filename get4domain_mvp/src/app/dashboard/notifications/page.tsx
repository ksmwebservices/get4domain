'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, Info, AlertCircle, Loader2, ShoppingBag, PackageX, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { notificationMeta, notificationLink, timeAgo, type VendorNotification } from '@/lib/notifications-ui';

const ICONS = { order: ShoppingBag, stock: PackageX, lead: UserPlus, success: CheckCircle2, info: Info, warning: AlertCircle } as const;
const TONE = {
  order: 'bg-success-50 text-success-600', stock: 'bg-amber-50 text-amber-600', lead: 'bg-primary-50 text-primary-600',
  success: 'bg-success-50 text-success-600', info: 'bg-primary-50 text-primary-600', warning: 'bg-amber-50 text-amber-600',
} as const;

/** The vendor's own in-app notifications (new order, low stock, new lead, billing, support). Only this vendor's rows ever reach this page. */
export default function NotificationsPage() {
  const [items, setItems] = useState<VendorNotification[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { const r = await api.getNotifications(); setItems((r.data ?? r ?? []) as VendorNotification[]); setError(''); }
    catch { setError('Could not load your notifications.'); setItems([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function markAll() {
    try { await api.markAllNotificationsRead(); await load(); } catch { setError('Could not update your notifications.'); }
  }
  async function open(n: VendorNotification) {
    if (!n.read) { try { await api.markNotificationRead(n.id); } catch { /* the link still works */ } setItems((cur) => (cur ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x))); }
  }

  const unread = (items ?? []).filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500">New orders, low stock, new leads and account updates.</p>
        </div>
        {unread > 0 && <button onClick={markAll} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Mark all as read ({unread})</button>}
      </div>

      {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {items === null ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          Nothing yet. You will see new orders, low-stock alerts and new leads here as they happen.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const kind = notificationMeta(n.type);
            const Icon = ICONS[kind];
            const href = notificationLink(n);
            const body = (
              <div className={`flex gap-4 rounded-2xl border bg-white p-5 ${n.read ? 'border-slate-200' : 'border-primary-200 ring-1 ring-primary-200'}`}>
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONE[kind]}`}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-500">{n.message}</div>
                  <div className="mt-2 text-xs text-slate-400">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" aria-label="Unread" />}
              </div>
            );
            return href
              ? <Link key={n.id} href={href} onClick={() => open(n)} className="block">{body}</Link>
              : <button key={n.id} type="button" onClick={() => open(n)} className="block w-full text-left">{body}</button>;
          })}
        </div>
      )}
    </div>
  );
}
