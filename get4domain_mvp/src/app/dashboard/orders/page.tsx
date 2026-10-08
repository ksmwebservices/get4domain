'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Loader2, Package, Phone, MapPin, RefreshCw, Check, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { api } from '@/lib/api';
import { ORDER_FILTERS, orderBucket, orderTotals, type OrderBucket } from '@/lib/orders-ui';

interface OrderLine { name: string; qty: number; price: number }
interface WebOrder {
  id: string; items: OrderLine[]; total: number; paymentMethod: string; status: string; createdAt: string;
  customerName?: string | null; customerPhone?: string | null; customerEmail?: string | null; deliveryAddress?: string | null; orderNote?: string | null;
  paidAt?: string | null; cancelledAt?: string | null;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const CHIP: Record<OrderBucket, { label: string; cls: string }> = {
  awaiting: { label: 'Waiting for payment', cls: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Paid', cls: 'bg-success-50 text-success-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

/**
 * Website orders. Two kinds arrive here:
 *  - ORDER REQUESTS (no online payment): the customer's name, phone and delivery address are shown; you call them, collect payment yourself,
 *    then press "Mark as paid" — or "Cancel order", which puts the stock back.
 *  - ONLINE orders the customer already paid through your Razorpay account.
 */
export default function OrdersPage() {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | OrderBucket>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.engineWebOrders();
      setOrders(((r.data ?? r) as WebOrder[]) ?? []);
      setError('');
    } catch { setError('Could not load your orders.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id); setError('');
    try { await fn(); setConfirmCancel(null); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'That did not work. Please try again.'); }
    finally { setBusyId(null); }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const totals = orderTotals(orders);
  const shown = orders.filter((o) => filter === 'all' || orderBucket(o.status) === filter);

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><ShoppingBag className="h-6 w-6 text-primary-600" /> Orders</h1>
          <p className="mt-1 text-sm text-slate-500">Orders from your website. For an order request, call the customer, collect payment, then mark it paid. Cancelling puts the stock back.</p>
        </div>
        <Button size="sm" variant="outline" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => { setLoading(true); void load(); }}>Refresh</Button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card padded><div className="text-xs text-slate-500">Waiting for payment</div><div className="text-2xl font-bold text-amber-600">{totals.awaiting.count}</div><div className="text-xs text-slate-400">{rupees(totals.awaiting.amount)}</div></Card>
          <Card padded><div className="text-xs text-slate-500">Paid</div><div className="text-2xl font-bold text-slate-900">{totals.paid.count}</div><div className="text-xs text-slate-400">{rupees(totals.paid.amount)}</div></Card>
          <Card padded><div className="text-xs text-slate-500">Cancelled</div><div className="text-2xl font-bold text-slate-500">{totals.cancelled.count}</div></Card>
          <Card padded><div className="text-xs text-slate-500">Revenue (paid)</div><div className="text-2xl font-bold text-slate-900">{rupees(totals.paid.amount)}</div></Card>
        </div>
      )}

      {orders.length > 0 && (
        <div role="tablist" aria-label="Filter orders" className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {ORDER_FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === f.key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}>{f.label}</button>
          ))}
        </div>
      )}

      {orders.length === 0 && !error ? (
        <Card padded className="text-center text-sm text-slate-500">
          <Package className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          No orders yet. When a customer places an order on your website it appears here with their name, phone and address.
          <div className="mt-2 text-xs">How customers order is set in <Link href="/dashboard/payments" className="font-semibold text-primary-600">Payments</Link>.</div>
        </Card>
      ) : shown.length === 0 ? (
        <Card padded className="text-center text-sm text-slate-500">No orders in this view.</Card>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => {
            const bucket = orderBucket(o.status);
            const chip = CHIP[bucket];
            const request = o.paymentMethod === 'order_request';
            return (
              <Card key={o.id} padded>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.cls}`}>{chip.label}</span>
                    <span className="font-mono text-xs text-slate-400">#{o.id.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString('en-IN')}</div>
                </div>

                {(o.customerName || o.customerPhone || o.deliveryAddress) && (
                  <div className="mt-3 space-y-1 rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
                    {o.customerName && <div className="font-semibold text-slate-800">{o.customerName}</div>}
                    {o.customerPhone && <a href={`tel:${o.customerPhone}`} className="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:underline"><Phone className="h-3.5 w-3.5" />{o.customerPhone}</a>}
                    {o.deliveryAddress && <div className="flex items-start gap-1.5 text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /><span className="whitespace-pre-line">{o.deliveryAddress}</span></div>}
                    {o.orderNote && <div className="text-xs text-slate-500">Note: {o.orderNote}</div>}
                  </div>
                )}

                <div className="mt-3 space-y-1">
                  {(Array.isArray(o.items) ? o.items : []).map((l, i) => (
                    <div key={i} className="flex justify-between text-sm text-slate-700"><span>{l.qty}× {l.name}</span><span>{rupees((l.price || 0) * (l.qty || 1))}</span></div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <span className="text-xs text-slate-500">{request ? 'Order request — payment to the shop' : `Paid online (${o.paymentMethod})`}</span>
                  <span className="text-sm font-bold text-slate-900">{rupees(o.total)}</span>
                </div>

                {bucket !== 'cancelled' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {bucket === 'awaiting' && (
                      <Button size="sm" leftIcon={<Check className="h-3.5 w-3.5" />} loading={busyId === o.id} disabled={busyId !== null} onClick={() => act(o.id, () => api.markOrderPaid(o.id))}>Mark as paid</Button>
                    )}
                    {confirmCancel === o.id ? (
                      <span className="flex flex-wrap items-center gap-2 rounded-xl bg-error-50 px-3 py-1.5 text-xs text-error-700">
                        {bucket === 'paid' && !request ? 'This puts the stock back but does NOT refund the customer — refund from Razorpay yourself.' : 'Cancel this order and put the stock back?'}
                        <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => setConfirmCancel(null)}>Keep it</Button>
                        <Button size="sm" loading={busyId === o.id} disabled={busyId !== null} onClick={() => act(o.id, () => api.cancelOrder(o.id))}>Yes, cancel</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" leftIcon={<X className="h-3.5 w-3.5" />} disabled={busyId !== null} onClick={() => setConfirmCancel(o.id)}>Cancel order</Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
