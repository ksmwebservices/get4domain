'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Loader2, FileText, Download, IndianRupee, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

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

  const field = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Accounts</h2>
          <p className="mt-1 text-sm text-slate-500">Revenue, expenses, simple P&amp;L and a GST statement — enough to hand to your accountant.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5" />
          <span className="text-slate-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5" />
        </div>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {loading || !summary ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* P&L cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white">
              <TrendingUp className="h-5 w-5 opacity-80" /><div className="mt-2 text-xl font-bold">{rupees(summary.revenueNet)}</div><div className="text-xs text-white/85">Revenue (net)</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 p-4 text-white">
              <TrendingDown className="h-5 w-5 opacity-80" /><div className="mt-2 text-xl font-bold">{rupees(summary.expensesNet)}</div><div className="text-xs text-white/85">Expenses (net)</div>
            </div>
            <div className={`rounded-2xl bg-gradient-to-br p-4 text-white ${summary.profit >= 0 ? 'from-blue-500 to-blue-600' : 'from-amber-500 to-amber-600'}`}>
              <IndianRupee className="h-5 w-5 opacity-80" /><div className="mt-2 text-xl font-bold">{rupees(summary.profit)}</div><div className="text-xs text-white/85">Profit / Loss</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 p-4 text-white">
              <Receipt className="h-5 w-5 opacity-80" /><div className="mt-2 text-xl font-bold">{rupees(summary.netGstPayable)}</div><div className="text-xs text-white/85">Net GST payable</div>
            </div>
          </div>

          {/* GST statement */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-bold text-slate-900">GST statement</div>
              <div className="mt-3 space-y-1.5 text-sm">
                <Row label="Output GST (on sales)" value={rupees(summary.outputGst)} />
                <Row label="Input GST (on expenses)" value={`− ${rupees(summary.inputGst)}`} />
                <div className="mt-1 flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900"><span>Net GST payable</span><span>{rupees(summary.netGstPayable)}</span></div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-900">Sales invoices</div>
                <Link href="/dashboard/invoices" className="text-xs font-semibold text-primary-600 hover:underline">View all →</Link>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <Row label="Revenue (net of GST)" value={rupees(summary.revenueNet)} />
                <Row label="Gross collected" value={rupees(summary.revenueGross)} />
                <Row label="Expenses — online / cash" value={`${rupees(summary.expensesOnline)} / ${rupees(summary.expensesOffline)}`} />
              </div>
            </div>
          </div>

          {/* Add expense */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-sm font-bold text-slate-900">Log an expense</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input className={field} placeholder="Category (optional)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input className={field} type="number" placeholder="Amount ₹ (before GST)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <select className={field} value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })}>
                {['0', '5', '12', '18', '28'].map((r) => <option key={r} value={r}>{r === '0' ? 'No GST' : `GST ${r}%`}</option>)}
              </select>
              <select className={field} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="offline">Cash / offline</option>
                <option value="online">Online</option>
              </select>
              <input className={field} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}{form.attachment ? 'Receipt attached' : 'Attach receipt'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); }} />
              </label>
              <button onClick={addExpense} disabled={saving || !form.description || !form.amount} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add expense</button>
            </div>
          </div>

          {/* Expense list */}
          <div className="space-y-2">
            {expenses.length === 0 ? <p className="text-sm text-slate-400">No expenses in this period.</p> : expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{e.description} <span className="text-xs font-normal text-slate-400">· {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {e.paymentMethod}{e.category ? ` · ${e.category}` : ''}</span></div>
                  <div className="text-xs text-slate-500">{rupees(e.amount)} + GST {rupees(e.gstAmount)} = <span className="font-semibold">{rupees(e.total)}</span></div>
                </div>
                <div className="ml-3 flex items-center gap-1">
                  <button onClick={() => printVoucher(e.id)} title="Voucher PDF" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Download className="h-4 w-4" /></button>
                  <button onClick={() => delExpense(e.id)} title="Delete" className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-slate-600"><span>{label}</span><span className="font-semibold text-slate-900">{value}</span></div>;
}
