'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, Loader2, FileText, Download, IndianRupee, TrendingUp, TrendingDown,
  Receipt, Percent, Wallet,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Modal } from '@/components/vendor/Modal';
import { Badge } from '@/components/vendor/Badge';
import { EmptyState } from '@/components/vendor/EmptyState';

interface Expense { id: string; description: string; category: string | null; amount: number; gstRate: number; gstAmount: number; total: number; paymentMethod: string; date: string }
interface Summary {
  revenueNet: number; outputGst: number; revenueGross: number;
  expensesNet: number; inputGst: number; expensesGross: number;
  expensesOnline: number; expensesOffline: number; profit: number; netGstPayable: number;
}

const rupees = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

export default function AccountsPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ description: '', category: '', amount: '', gstRate: '0', paymentMethod: 'offline', date: today(), attachment: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const q = `?from=${from}&to=${to}`;
    try {
      const [s, e] = await Promise.all([api.accountingSummary(q), api.getExpenses(q)]);
      setSummary(s.data ?? null);
      setExpenses(e.data ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  async function uploadReceipt(file: File) {
    setUploading(true);
    try { const r = await api.uploadImage(file); if (r.data?.url) setForm((f) => ({ ...f, attachment: r.data!.url })); }
    catch { /* optional */ } finally { setUploading(false); }
  }

  async function addExpense() {
    if (!form.description || !form.amount) return;
    setSaving(true); setError('');
    try {
      await api.createExpense({
        description: form.description, category: form.category || undefined,
        amount: parseFloat(form.amount), gstRate: parseFloat(form.gstRate) || 0,
        paymentMethod: form.paymentMethod, date: form.date, attachment: form.attachment || undefined,
      });
      setForm({ description: '', category: '', amount: '', gstRate: '0', paymentMethod: 'offline', date: today(), attachment: '' });
      setAddOpen(false);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); }
  }

  async function delExpense(id: string) { await api.deleteExpense(id).catch(() => {}); await load(); }

  async function printVoucher(id: string) {
    try {
      const r = await api.expenseVoucher(id);
      const html = r.data?.html;
      if (!html) return;
      const w = window.open('', '_blank');
      if (w) { w.document.write(`<html><head><title>Expense Voucher</title></head><body style="padding:24px;">${html}<script>window.onload=()=>window.print()</script></body></html>`); w.document.close(); }
    } catch { /* ignore */ }
  }

  // Real expense-by-category breakdown (derived from the vendor's own expenses).
  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category || 'Uncategorized', (map.get(e.category || 'Uncategorized') || 0) + e.total);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const maxCat = breakdown.length ? breakdown[0][1] : 0;

  const summaryCards = summary ? [
    { icon: TrendingUp, label: 'Revenue (net)', value: rupees(summary.revenueNet), badge: 'Sales', variant: 'success' as const, bg: 'bg-success/10 text-success' },
    { icon: TrendingDown, label: 'Expenses (net)', value: rupees(summary.expensesNet), badge: 'Costs', variant: 'error' as const, bg: 'bg-ruby-500/10 text-ruby-400' },
    { icon: IndianRupee, label: 'Profit / Loss', value: rupees(summary.profit), badge: summary.profit >= 0 ? 'Net' : 'Loss', variant: summary.profit >= 0 ? 'info' as const : 'warning' as const, bg: 'bg-brand-500/15 text-brand-400' },
    { icon: Percent, label: 'Net GST payable', value: rupees(summary.netGstPayable), badge: 'GST', variant: 'gold' as const, bg: 'bg-gold-500/10 text-gold-400' },
  ] : [];

  return (
    <div className="vendor-ui -m-5 min-h-[calc(100vh-4rem)] bg-ink-950 bg-radial-glow p-5 text-ink-100 lg:-m-8 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-ink-50 sm:text-2xl">Accounts</h2>
            <p className="mt-1 text-sm text-ink-500">Revenue, expenses, a simple P&amp;L and a GST statement — enough to hand to your accountant.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !w-auto !py-2" />
              <span className="text-ink-500">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-auto !py-2" />
            </div>
            <button onClick={() => setAddOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add Entry</span></button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-ruby-500/30 bg-ruby-500/10 px-4 py-3 text-sm text-ruby-300">{error}</div>}

        {loading || !summary ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink-500" /></div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {summaryCards.map((c) => {
                const Ic = c.icon;
                return (
                  <div key={c.label} className="card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}><Ic className="h-4 w-4" /></div>
                      <Badge variant={c.variant} size="xs">{c.badge}</Badge>
                    </div>
                    <div className="text-lg font-extrabold text-ink-50">{c.value}</div>
                    <div className="mt-0.5 text-[10px] text-ink-500">{c.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Breakdown + GST/sales */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="card p-5">
                <h3 className="mb-4 text-sm font-bold text-ink-100">Expense Breakdown</h3>
                {breakdown.length === 0 ? (
                  <p className="text-xs text-ink-500">No expenses in this period.</p>
                ) : (
                  <div className="space-y-3">
                    {breakdown.map(([cat, amt]) => (
                      <div key={cat}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-ink-300">{cat}</span>
                          <span className="font-semibold text-ink-200">{rupees(amt)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-ruby-500 to-ruby-600" style={{ width: `${maxCat ? (amt / maxCat) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="card p-5">
                  <div className="mb-3 flex items-center gap-2"><Percent className="h-4 w-4 text-gold-400" /><h3 className="text-sm font-bold text-ink-100">GST statement</h3></div>
                  <div className="space-y-1.5 text-sm">
                    <Row label="Output GST (on sales)" value={rupees(summary.outputGst)} />
                    <Row label="Input GST (on expenses)" value={`− ${rupees(summary.inputGst)}`} />
                    <div className="mt-1 flex justify-between border-t border-ink-700/40 pt-2 font-bold text-ink-50"><span>Net GST payable</span><span>{rupees(summary.netGstPayable)}</span></div>
                  </div>
                </div>
                <div className="card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-brand-400" /><h3 className="text-sm font-bold text-ink-100">Sales &amp; payments</h3></div>
                    <Link href="/dashboard/invoices" className="text-xs font-semibold text-brand-300 hover:text-brand-200">View invoices →</Link>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <Row label="Revenue (net of GST)" value={rupees(summary.revenueNet)} />
                    <Row label="Gross collected" value={rupees(summary.revenueGross)} />
                    <Row label="Expenses — online / cash" value={`${rupees(summary.expensesOnline)} / ${rupees(summary.expensesOffline)}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions / expense list */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-700/40 px-5 py-3">
                <h3 className="text-sm font-bold text-ink-100">Expenses</h3>
                <span className="text-xs text-ink-500">{expenses.length} in this period</span>
              </div>
              {expenses.length === 0 ? (
                <EmptyState icon="Receipt" title="No expenses logged" description="Log your business expenses to build an accurate P&L and GST statement."
                  action={<button onClick={() => setAddOpen(true)} className="btn-primary !py-2 !text-xs"><Plus className="h-3.5 w-3.5" /> Add an expense</button>} />
              ) : (
                <div className="divide-y divide-ink-700/30">
                  {expenses.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-ink-800/40">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ruby-500/10 text-ruby-400"><TrendingDown className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink-100">{e.description}
                          <span className="ml-1 text-xs font-normal text-ink-500">· {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {e.paymentMethod}{e.category ? ` · ${e.category}` : ''}</span>
                        </div>
                        <div className="text-xs text-ink-500">{rupees(e.amount)} + GST {rupees(e.gstAmount)} = <span className="font-semibold text-ink-300">{rupees(e.total)}</span></div>
                      </div>
                      <div className="ml-1 flex items-center gap-1">
                        <button onClick={() => printVoucher(e.id)} title="Voucher PDF" className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-800 hover:text-ink-200"><Download className="h-4 w-4" /></button>
                        <button onClick={() => delExpense(e.id)} title="Delete" className="rounded-lg p-2 text-ink-500 transition hover:bg-ruby-500/10 hover:text-ruby-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add expense modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Log an expense"
        subtitle="Record a business expense with GST"
        size="md"
        footer={
          <>
            <button onClick={() => setAddOpen(false)} className="btn-ghost">Cancel</button>
            <button onClick={addExpense} disabled={saving || !form.description || !form.amount} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add expense
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input sm:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="input" placeholder="Category (optional)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="input" type="number" placeholder="Amount ₹ (before GST)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <select className="input" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })}>
            {['0', '5', '12', '18', '28'].map((r) => <option key={r} value={r}>{r === '0' ? 'No GST' : `GST ${r}%`}</option>)}
          </select>
          <select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
            <option value="offline">Cash / offline</option>
            <option value="online">Online</option>
          </select>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink-700/60 px-3 py-2.5 text-xs font-semibold text-ink-300 transition hover:bg-ink-800/60">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}{form.attachment ? 'Receipt attached' : 'Attach receipt'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); }} />
          </label>
        </div>
        {error && <div className="mt-3 rounded-xl border border-ruby-500/30 bg-ruby-500/10 px-4 py-2.5 text-sm text-ruby-300">{error}</div>}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-ink-400"><span>{label}</span><span className="font-semibold text-ink-100">{value}</span></div>;
}
