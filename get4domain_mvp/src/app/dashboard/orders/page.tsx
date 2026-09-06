'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Loader2, Package, CreditCard } from 'lucide-react';
import Card from '@/components/ui/Card';
import { api } from '@/lib/api';

interface OrderLine { name: string; qty: number; price: number }
interface WebOrder { id: string; items: OrderLine[]; total: number; paymentMethod: string; status: string; createdAt: string }

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/**
 * Public web orders — sales customers paid for directly on the vendor's website
 * (recorded as PosSale type 'web'). The buyer's contact for each order is captured in
 * TeleCRM (source 'web-order'), so this view focuses on what was bought + paid.
 */
export default function OrdersPage() {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.engineWebOrders()
      .then((r) => setOrders(((r.data ?? r) as WebOrder[]) ?? []))
      .catch(() => setError('Could not load your orders.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><ShoppingBag className="h-6 w-6 text-primary-600" /> Website orders</h1>
        <p className="mt-1 text-sm text-slate-500">Orders customers paid for on your website — the money went straight to your Razorpay account. Buyer contacts are saved in TeleCRM.</p>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card padded><div className="text-xs text-slate-500">Orders</div><div className="text-2xl font-bold text-slate-900">{orders.length}</div></Card>
          <Card padded><div className="text-xs text-slate-500">Revenue</div><div className="text-2xl font-bold text-slate-900">{rupees(revenue)}</div></Card>
        </div>
      )}

      {orders.length === 0 && !error ? (
        <Card padded className="text-center text-sm text-slate-500">
          <Package className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          No website orders yet. Turn on payments in <Link href="/dashboard/payments" className="font-semibold text-primary-600">Payments</Link>, then add a Buy option on your site.
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} padded>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono text-slate-400">#{o.id.slice(-8)}</div>
                <div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString('en-IN')}</div>
              </div>
              <div className="mt-2 space-y-1">
                {(Array.isArray(o.items) ? o.items : []).map((l, i) => (
                  <div key={i} className="flex justify-between text-sm text-slate-700"><span>{l.qty}× {l.name}</span><span>{rupees((l.price || 0) * (l.qty || 1))}</span></div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success-600"><CreditCard className="h-3.5 w-3.5" /> {o.paymentMethod} · {o.status}</span>
                <span className="text-sm font-bold text-slate-900">{rupees(o.total)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
