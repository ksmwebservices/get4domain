'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ClipboardList, Utensils, Receipt, X, Minus } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface MenuItem { id: string; name: string; price: number }
interface TableRef { id: string; name: string; status: string }
interface OrderItem { id: string; name: string; quantity: number; price: number; status: string; station: string }
interface Order {
  id: string; tableId?: string; tableName?: string; orderType: string; customerName?: string; status: string;
  subtotal: number; taxAmount: number; total: number; paymentMethod?: string; items?: OrderItem[];
}
interface CartLine { catalogItemId?: string; name: string; price: number; quantity: number }

const TYPES = ['Dine-in', 'Takeaway', 'Delivery'];
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: '#64748b' }, preparing: { label: 'Preparing', color: '#f59e0b' },
  ready: { label: 'Ready', color: '#2563eb' }, served: { label: 'Served', color: '#16a34a' },
  billed: { label: 'Billed', color: '#8b5cf6' }, cancelled: { label: 'Cancelled', color: '#dc2626' },
};
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

export default function OrdersView() {
  const [rows, setRows] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableRef[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  // new-order form
  const [nOrder, setNOrder] = useState<{ orderType: string; tableId: string; customerName: string }>({ orderType: 'Dine-in', tableId: '', customerName: '' });
  const [cart, setCart] = useState<CartLine[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api.getRestaurantOrders().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
    api.getRestaurantTables().then((r) => setTables((r.data ?? []).map((t: TableRef) => ({ id: t.id, name: t.name, status: t.status })))).catch(() => setTables([]));
    api.daGetCatalog().then((r) => setMenu((r.data ?? []).map((m: any) => ({ id: m.id, name: m.name, price: Number(m.price) || 0 })))).catch(() => setMenu([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((o) => o.status === filter)), [rows, filter]);
  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.quantity, 0), [cart]);

  function addToCart(m: MenuItem) {
    setCart((c) => {
      const i = c.findIndex((l) => l.catalogItemId === m.id);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], quantity: n[i].quantity + 1 }; return n; }
      return [...c, { catalogItemId: m.id, name: m.name, price: m.price, quantity: 1 }];
    });
  }
  function bump(idx: number, d: 1 | -1) {
    setCart((c) => { const n = [...c]; const q = n[idx].quantity + d; if (q <= 0) return n.filter((_, i) => i !== idx); n[idx] = { ...n[idx], quantity: q }; return n; });
  }

  function openNew() { setNOrder({ orderType: 'Dine-in', tableId: '', customerName: '' }); setCart([]); setOpen(true); }

  async function createOrder() {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const table = tables.find((t) => t.id === nOrder.tableId);
      await api.createRestaurantOrder({
        orderType: nOrder.orderType,
        tableId: nOrder.tableId || undefined,
        tableName: table?.name,
        customerName: nOrder.customerName || undefined,
        items: cart.map((l) => ({ catalogItemId: l.catalogItemId, name: l.name, price: l.price, quantity: l.quantity })),
      });
      setOpen(false); load();
    } finally { setSaving(false); }
  }
  async function remove(o: Order) { if (confirm('Delete this order?')) { await api.deleteRestaurantOrder(o.id); load(); } }

  async function refreshDetail(id: string) { const r = await api.getRestaurantOrder(id); setDetail(r.data ?? null); load(); }
  async function advance(o: Order) {
    const flow = ['new', 'preparing', 'ready', 'served']; const i = flow.indexOf(o.status);
    if (i < 0 || i === flow.length - 1) return;
    await api.updateRestaurantOrder(o.id, { status: flow[i + 1] }); if (detail) refreshDetail(o.id); else load();
  }
  async function bill(o: Order, method: string) { await api.billRestaurantOrder(o.id, { paymentMethod: method }); setDetail(null); load(); }
  async function delItem(it: OrderItem) { if (!detail) return; await api.deleteRestaurantItem(it.id); refreshDetail(detail.id); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Orders</h1><p className="mt-0.5 text-sm text-slate-500">Menu-linked orders, kitchen flow and billing.</p></div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openNew}>New Order</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(['all', 'new', 'preparing', 'ready', 'served', 'billed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === f ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{f === 'all' ? 'All' : STATUS[f].label}</button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="ClipboardList" title={rows.length ? 'Nothing here' : 'No orders yet'} subtitle="Take an order from the menu and send it to the kitchen." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openNew}>New Order</Button>} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((o) => {
              const s = STATUS[o.status] ?? STATUS.new; const canAdvance = ['new', 'preparing', 'ready'].includes(o.status);
              return (
                <Card key={o.id} padded className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Utensils className="h-5 w-5" /></div>
                      <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{o.tableName ? `Table ${o.tableName}` : o.orderType}{o.customerName ? ` · ${o.customerName}` : ''}</div><div className="truncate text-xs text-slate-500">{o.orderType} · {(o.items ?? []).length} items</div></div>
                    </div>
                    <Badge color={s.color}>{s.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Total</span><span className="font-bold text-slate-900">{inr(o.total)}</span></div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button onClick={() => setDetail(o)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"><Receipt className="h-3.5 w-3.5" />Details</button>
                      {canAdvance && <Button size="sm" variant="outline" onClick={() => advance(o)}>Mark {STATUS[({ new: 'preparing', preparing: 'ready', ready: 'served' } as Record<string, string>)[o.status]].label}</Button>}
                    </div>
                    <button onClick={() => remove(o)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      {/* New order — menu picker + cart */}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="New Order" maxWidth="max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select label="Type" value={nOrder.orderType} onChange={(e) => setNOrder({ ...nOrder, orderType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
              <Select label="Table" value={nOrder.tableId} onChange={(e) => setNOrder({ ...nOrder, tableId: e.target.value })}>
                <option value="">—</option>
                {tables.map((t) => <option key={t.id} value={t.id} disabled={t.status === 'occupied'}>{t.name}{t.status === 'occupied' ? ' (occupied)' : ''}</option>)}
              </Select>
            </div>
            <Input label="Customer (optional)" value={nOrder.customerName} onChange={(e) => setNOrder({ ...nOrder, customerName: e.target.value })} />
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Menu</p>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {menu.length === 0 ? <p className="text-xs text-slate-400">No menu items. Add them under the Menu tab.</p>
                  : menu.map((m) => (
                    <button key={m.id} onClick={() => addToCart(m)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-left text-sm hover:border-primary-300 hover:bg-primary-50">
                      <span className="truncate text-slate-800">{m.name}</span><span className="font-semibold text-slate-600">{inr(m.price)}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Order</p>
            <div className="flex-1 space-y-1.5">
              {cart.length === 0 ? <p className="text-sm text-slate-400">Tap menu items to add them.</p>
                : cart.map((l, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-slate-800">{l.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => bump(i, -1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-5 text-center font-semibold">{l.quantity}</span>
                      <button onClick={() => bump(i, 1)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><Plus className="h-3.5 w-3.5" /></button>
                      <span className="w-14 text-right font-semibold text-slate-700">{inr(l.price * l.quantity)}</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm"><span className="font-medium text-slate-500">Total</span><span className="font-bold text-slate-900">{inr(cartTotal)}</span></div>
            <Button className="mt-3" loading={saving} disabled={cart.length === 0} onClick={createOrder}>Send to Kitchen</Button>
          </div>
        </div>
      </Modal>

      {/* Order detail — items, advance, bill */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? (detail.tableName ? `Table ${detail.tableName}` : detail.orderType) : ''} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {(detail.items ?? []).map((it) => (
                <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div className="min-w-0"><span className="text-slate-800">{it.quantity}× {it.name}</span><span className="ml-2 text-xs text-slate-400">{STATUS[it.status]?.label ?? it.status}</span></div>
                  <div className="flex items-center gap-2"><span className="font-semibold text-slate-700">{inr(it.price * it.quantity)}</span>{detail.status !== 'billed' && <button onClick={() => delItem(it)} className="text-slate-300 hover:text-error-500"><X className="h-3.5 w-3.5" /></button>}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-2 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{inr(detail.subtotal)}</span></div>
              {detail.taxAmount > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{inr(detail.taxAmount)}</span></div>}
              <div className="flex justify-between font-bold text-slate-900"><span>Total</span><span>{inr(detail.total)}</span></div>
            </div>
            {detail.status === 'billed' ? (
              <div className="rounded-lg bg-success-50 px-3 py-2 text-center text-sm font-semibold text-success-700">Billed · {detail.paymentMethod}</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {['new', 'preparing', 'ready'].includes(detail.status) && <Button variant="outline" onClick={() => advance(detail)}>Advance status</Button>}
                <div className="flex-1" />
                <Button variant="outline" onClick={() => bill(detail, 'cash')}>Bill · Cash</Button>
                <Button onClick={() => bill(detail, 'upi')}>Bill · UPI</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
