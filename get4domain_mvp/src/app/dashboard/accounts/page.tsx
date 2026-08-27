'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, Loader2, FileText, Download, IndianRupee, TrendingUp, TrendingDown,
  Receipt, Percent, Wallet, ArrowLeftRight, PieChart, CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Modal } from '@/components/vendor/Modal';
import { Badge } from '@/components/vendor/Badge';
import { EmptyState } from '@/components/vendor/EmptyState';

interface Expense { id: string; description: string; category: string | null; amount: number; gstRate: number; gstAmount: number; total: number; paymentMethod: string; date: string }
interface Summary {
  revenueNet: number; outputGst: number; revenueGross: number;
  expensesNet: number; inputGst: number; expensesGross: number;
  expensesOnline: number; expensesOffline: number; profit: number; netGstPayable: number;
}
interface Payment { id: string; party: string; method: string; direction: 'inward' | 'outward'; amount: number; reference: string | null; status: string; date: string }
interface GstFiling { id: string; period: string; formType: string; status: string; dueDate: string | null; filedAt: string | null }
interface TravelSummary { tripCount: number; totalPackageCost: number; totalSellPrice: number; grossMargin: number; marginPct: number; supplierPaymentsTotal: number; supplierPaymentsCount: number }

const rupees = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

type Tab = 'overview' | 'expenses' | 'payments' | 'gst';
const TABS: { key: Tab; label: string; icon: typeof PieChart }[] = [
  { key: 'overview', label: 'Overview', icon: PieChart },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'payments', label: 'Payments', icon: IndianRupee },
  { key: 'gst', label: 'GST', icon: Percent },
];
const METHODS = ['upi', 'cash', 'card', 'cheque', 'bank'] as const;
const GST_FORMS = [
  { form: 'GSTR-1', desc: 'Outward supplies' },
  { form: 'GSTR-3B', desc: 'Summary return' },
  { form: 'GSTR-2B', desc: 'Auto-drafted ITC' },
  { form: 'Annual', desc: 'GSTR-9' },
];
const FILING_STATUSES = ['pending', 'in_progress', 'filed', 'not_due'] as const;

export default function AccountsPage() {
  const { user } = useAuth();
  const isTravel = user?.industry === 'travel';
  const [travel, setTravel] = useState<TravelSummary | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filings, setFilings] = useState<GstFiling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [form, setForm] = useState({ description: '', category: '', amount: '', gstRate: '0', paymentMethod: 'offline', date: today(), attachment: '' });
  const [payForm, setPayForm] = useState({ party: '', method: 'upi', direction: 'inward' as 'inward' | 'outward', amount: '', reference: '', status: 'cleared', date: today() });

  const period = from.slice(0, 7); // YYYY-MM

  const load = useCallback(async () => {
    setLoading(true);
    const q = `?from=${from}&to=${to}`;
    try {
      const [s, e, p, g] = await Promise.all([
        api.accountingSummary(q),
        api.getExpenses(q),
        api.getPaymentRecords(q).catch(() => ({ data: [] })),
        api.getGstFilings().catch(() => ({ data: [] })),
      ]);
      setSummary(s.data ?? null);
      setExpenses(e.data ?? []);
      setPayments((p.data as Payment[]) ?? []);
      setFilings((g.data as GstFiling[]) ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  // Travel accounts depth (industry-aware): trip markup + supplier payments.
  useEffect(() => {
    if (!isTravel) return;
    api.accountingTravelSummary().then((r) => setTravel(r.data ?? null)).catch(() => setTravel(null));
  }, [isTravel]);

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

  async function addPayment() {
    if (!payForm.party || !payForm.amount) return;
    setSaving(true); setError('');
    try {
      await api.createPaymentRecord({
        party: payForm.party, method: payForm.method, direction: payForm.direction,
        amount: parseFloat(payForm.amount), reference: payForm.reference || undefined,
        status: payForm.status, date: payForm.date,
      });
      setPayForm({ party: '', method: 'upi', direction: 'inward', amount: '', reference: '', status: 'cleared', date: today() });
      setPayOpen(false);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); }
  }

  async function delPayment(id: string) { await api.deletePaymentRecord(id).catch(() => {}); await load(); }

  async function setFilingStatus(formType: string, status: string) {
    try { await api.upsertGstFiling({ period, formType, status }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category || 'Uncategorized', (map.get(e.category || 'Uncategorized') || 0) + e.total);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const maxCat = breakdown.length ? breakdown[0][1] : 0;

  const inwardTotal = payments.filter((p) => p.direction === 'inward').reduce((s, p) => s + p.amount, 0);
  const outwardTotal = payments.filter((p) => p.direction === 'outward').reduce((s, p) => s + p.amount, 0);
  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of payments) m[p.method] = (m[p.method] || 0) + p.amount;
    return m;
  }, [payments]);
  const maxMethod = Math.max(1, ...Object.values(byMethod));
  const filingFor = (formType: string) => filings.find((f) => f.period === period && f.formType === formType);
  const filingVariant: Record<string, 'success' | 'warning' | 'info' | 'default'> = { filed: 'success', in_progress: 'info', pending: 'warning', not_due: 'default' };

  const summaryCards = summary ? [
    { icon: TrendingUp, label: 'Revenue (net)', value: rupees(summary.revenueNet), badge: 'Sales', variant: 'success' as const, bg: 'bg-success/10 text-success' },
    { icon: TrendingDown, label: 'Expenses (net)', value: rupees(summary.expensesNet), badge: 'Costs', variant: 'error' as const, bg: 'bg-ruby-500/10 text-ruby-400' },
    { icon: IndianRupee, label: 'Profit / Loss', value: rupees(summary.profit), badge: summary.profit >= 0 ? 'Net' : 'Loss', variant: summary.profit >= 0 ? 'info' as const : 'warning' as const, bg: 'bg-brand-500/15 text-brand-400' },
    { icon: Percent, label: 'Net GST payable', value: rupees(summary.netGstPayable), badge: 'GST', variant: 'gold' as const, bg: 'bg-gold-500/10 text-gold-400' },
  ] : [];

  const inputCls = 'input';

  return (
    <div className="vendor-ui -m-5 min-h-[calc(100vh-4rem)] bg-ink-950 bg-radial-glow p-5 text-ink-100 lg:-m-8 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-ink-50 sm:text-2xl">Accounts</h2>
            <p className="mt-1 text-sm text-ink-500">Revenue, expenses, payments, a simple P&amp;L and GST — enough to hand to your accountant.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !w-auto !py-2" />
            <span className="text-ink-500">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-auto !py-2" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-ink-700/40 bg-ink-850/60 p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition sm:px-4 ${tab === t.key ? 'bg-brand-600/20 text-brand-300' : 'text-ink-400 hover:text-ink-200'}`}>
              <t.icon className="h-4 w-4" /><span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {error && <div className="rounded-xl border border-ruby-500/30 bg-ruby-500/10 px-4 py-3 text-sm text-ruby-300">{error}</div>}

        {loading || !summary ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink-500" /></div>
        ) : (
          <>
            {/* Summary cards — always shown */}
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

            {/* OVERVIEW */}
            {tab === 'overview' && isTravel && travel && (
              <div className="card p-5">
                <div className="mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /><h3 className="text-sm font-bold text-ink-100">Travel margin &amp; supplier payments</h3><Badge variant="info" size="xs">Travel</Badge></div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><div className="text-lg font-extrabold text-ink-50">{rupees(travel.totalSellPrice)}</div><div className="text-[10px] uppercase tracking-wider text-ink-500">Trip sell value · {travel.tripCount} trips</div></div>
                  <div><div className="text-lg font-extrabold text-ink-200">{rupees(travel.totalPackageCost)}</div><div className="text-[10px] uppercase tracking-wider text-ink-500">Package cost</div></div>
                  <div><div className="text-lg font-extrabold text-success">{rupees(travel.grossMargin)}</div><div className="text-[10px] uppercase tracking-wider text-ink-500">Gross margin · {travel.marginPct}%</div></div>
                  <div><div className="text-lg font-extrabold text-gold-300">{rupees(travel.supplierPaymentsTotal)}</div><div className="text-[10px] uppercase tracking-wider text-ink-500">Supplier payments · {travel.supplierPaymentsCount}</div></div>
                </div>
                <p className="mt-3 text-[11px] text-ink-500">Markup/commission is sell price − package cost across all trips. Record hotel/transport supplier payments as “outward” in the Payments tab.</p>
              </div>
            )}

            {tab === 'overview' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="card p-5">
                  <h3 className="mb-4 text-sm font-bold text-ink-100">Expense Breakdown</h3>
                  {breakdown.length === 0 ? <p className="text-xs text-ink-500">No expenses in this period.</p> : (
                    <div className="space-y-3">
                      {breakdown.map(([cat, amt]) => (
                        <div key={cat}>
                          <div className="mb-1 flex items-center justify-between text-xs"><span className="text-ink-300">{cat}</span><span className="font-semibold text-ink-200">{rupees(amt)}</span></div>
                          <div className="h-2 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-gradient-to-r from-ruby-500 to-ruby-600" style={{ width: `${maxCat ? (amt / maxCat) * 100 : 0}%` }} /></div>
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
                    <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-brand-400" /><h3 className="text-sm font-bold text-ink-100">Sales</h3></div><Link href="/dashboard/invoices" className="text-xs font-semibold text-brand-300 hover:text-brand-200">View invoices →</Link></div>
                    <div className="space-y-1.5 text-sm">
                      <Row label="Revenue (net of GST)" value={rupees(summary.revenueNet)} />
                      <Row label="Gross collected" value={rupees(summary.revenueGross)} />
                      <Row label="Expenses — online / cash" value={`${rupees(summary.expensesOnline)} / ${rupees(summary.expensesOffline)}`} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EXPENSES */}
            {tab === 'expenses' && (
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-ink-700/40 px-5 py-3">
                  <h3 className="text-sm font-bold text-ink-100">Expenses</h3>
                  <button onClick={() => setAddOpen(true)} className="btn-primary !py-1.5 !text-xs"><Plus className="h-3.5 w-3.5" /> Add expense</button>
                </div>
                {expenses.length === 0 ? (
                  <EmptyState icon="Receipt" title="No expenses logged" description="Log business expenses to build an accurate P&L and GST statement."
                    action={<button onClick={() => setAddOpen(true)} className="btn-primary !py-2 !text-xs"><Plus className="h-3.5 w-3.5" /> Add an expense</button>} />
                ) : (
                  <div className="divide-y divide-ink-700/30">
                    {expenses.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-ink-800/40">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ruby-500/10 text-ruby-400"><TrendingDown className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink-100">{e.description}<span className="ml-1 text-xs font-normal text-ink-500">· {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {e.paymentMethod}{e.category ? ` · ${e.category}` : ''}</span></div>
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
            )}

            {/* PAYMENTS */}
            {tab === 'payments' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="card bg-success/5 p-4"><div className="mb-1 flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-success" /><span className="text-xs font-bold uppercase tracking-wider text-success">Inward</span></div><div className="text-xl font-extrabold text-ink-50">{rupees(inwardTotal)}</div><div className="text-[10px] text-ink-500">{payments.filter((p) => p.direction === 'inward').length} transactions</div></div>
                  <div className="card bg-ruby-500/5 p-4"><div className="mb-1 flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 rotate-180 text-ruby-400" /><span className="text-xs font-bold uppercase tracking-wider text-ruby-400">Outward</span></div><div className="text-xl font-extrabold text-ink-50">{rupees(outwardTotal)}</div><div className="text-[10px] text-ink-500">{payments.filter((p) => p.direction === 'outward').length} transactions</div></div>
                </div>

                {Object.keys(byMethod).length > 0 && (
                  <div className="card p-5">
                    <h3 className="mb-3 text-sm font-bold text-ink-100">By method</h3>
                    <div className="space-y-2.5">
                      {METHODS.filter((m) => byMethod[m]).map((m) => (
                        <div key={m}>
                          <div className="mb-1 flex items-center justify-between text-xs"><span className="uppercase text-ink-300">{m}</span><span className="font-semibold text-ink-200">{rupees(byMethod[m])}</span></div>
                          <div className="h-2 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${(byMethod[m] / maxMethod) * 100}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-ink-700/40 px-5 py-3">
                    <h3 className="text-sm font-bold text-ink-100">Payment records</h3>
                    <button onClick={() => setPayOpen(true)} className="btn-primary !py-1.5 !text-xs"><Plus className="h-3.5 w-3.5" /> Record payment</button>
                  </div>
                  {payments.length === 0 ? (
                    <EmptyState icon="IndianRupee" title="No payments recorded" description="Track inward and outward payments (UPI, cash, card, cheque, bank) with their status."
                      action={<button onClick={() => setPayOpen(true)} className="btn-primary !py-2 !text-xs"><Plus className="h-3.5 w-3.5" /> Record a payment</button>} />
                  ) : (
                    <div className="divide-y divide-ink-700/30">
                      {payments.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-ink-800/40">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400"><IndianRupee className="h-4 w-4" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-ink-100">{p.party}<span className="ml-1 text-xs font-normal text-ink-500">· {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {p.method.toUpperCase()}{p.reference ? ` · ${p.reference}` : ''}</span></div>
                            <div className="text-xs"><Badge variant={p.status === 'cleared' ? 'success' : p.status === 'pending' ? 'warning' : 'error'} size="xs">{p.status}</Badge></div>
                          </div>
                          <span className={`text-sm font-bold ${p.direction === 'inward' ? 'text-success' : 'text-ruby-400'}`}>{p.direction === 'inward' ? '+' : '−'}{rupees(p.amount)}</span>
                          <button onClick={() => delPayment(p.id)} title="Delete" className="rounded-lg p-2 text-ink-500 transition hover:bg-ruby-500/10 hover:text-ruby-400"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* GST */}
            {tab === 'gst' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="card p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Output GST</div><div className="text-lg font-extrabold text-ink-50">{rupees(summary.outputGst)}</div><div className="text-[10px] text-ink-600">from sales</div></div>
                  <div className="card p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Input GST</div><div className="text-lg font-extrabold text-ink-50">{rupees(summary.inputGst)}</div><div className="text-[10px] text-ink-600">on expenses</div></div>
                  <div className="card p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Net payable</div><div className={`text-lg font-extrabold ${summary.netGstPayable >= 0 ? 'text-gold-400' : 'text-success'}`}>{rupees(Math.abs(summary.netGstPayable))}</div><div className="text-[10px] text-ink-600">{summary.netGstPayable >= 0 ? 'to pay' : 'refund'}</div></div>
                </div>

                <div className="card p-5">
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-ink-100">Return filing — {period}</h3></div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {GST_FORMS.map((g) => {
                      const cur = filingFor(g.form)?.status ?? 'pending';
                      return (
                        <div key={g.form} className="rounded-xl border border-ink-700/30 bg-ink-900/40 p-3">
                          <div className="flex items-center justify-between"><div className="text-xs font-bold text-ink-100">{g.form}</div><Badge variant={filingVariant[cur] ?? 'default'} size="xs">{cur.replace('_', ' ')}</Badge></div>
                          <div className="mt-0.5 text-[10px] text-ink-500">{g.desc}</div>
                          <select value={cur} onChange={(e) => setFilingStatus(g.form, e.target.value)} className="input mt-2 !py-1.5 !text-xs">
                            {FILING_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-500"><CheckCircle2 className="h-3.5 w-3.5 text-brand-400" /> Filing status is tracked per period + form. Set to &quot;filed&quot; once submitted on the GST portal.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add expense modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Log an expense" subtitle="Record a business expense with GST" size="md"
        footer={<><button onClick={() => setAddOpen(false)} className="btn-ghost">Cancel</button><button onClick={addExpense} disabled={saving || !form.description || !form.amount} className="btn-primary">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add expense</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={`${inputCls} sm:col-span-2`} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className={inputCls} placeholder="Category (optional)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className={inputCls} type="number" placeholder="Amount ₹ (before GST)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <select className={inputCls} value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })}>{['0', '5', '12', '18', '28'].map((r) => <option key={r} value={r}>{r === '0' ? 'No GST' : `GST ${r}%`}</option>)}</select>
          <select className={inputCls} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}><option value="offline">Cash / offline</option><option value="online">Online</option></select>
          <input className={inputCls} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink-700/60 px-3 py-2.5 text-xs font-semibold text-ink-300 transition hover:bg-ink-800/60">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}{form.attachment ? 'Receipt attached' : 'Attach receipt'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); }} />
          </label>
        </div>
      </Modal>

      {/* Add payment modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record a payment" subtitle="Inward or outward, with method + status" size="md"
        footer={<><button onClick={() => setPayOpen(false)} className="btn-ghost">Cancel</button><button onClick={addPayment} disabled={saving || !payForm.party || !payForm.amount} className="btn-primary">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save payment</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={`${inputCls} sm:col-span-2`} placeholder="Party (name)" value={payForm.party} onChange={(e) => setPayForm({ ...payForm, party: e.target.value })} />
          <select className={inputCls} value={payForm.direction} onChange={(e) => setPayForm({ ...payForm, direction: e.target.value as 'inward' | 'outward' })}><option value="inward">Inward (received)</option><option value="outward">Outward (paid)</option></select>
          <select className={inputCls} value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>{METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select>
          <input className={inputCls} type="number" placeholder="Amount ₹" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          <select className={inputCls} value={payForm.status} onChange={(e) => setPayForm({ ...payForm, status: e.target.value })}><option value="cleared">Cleared</option><option value="pending">Pending</option><option value="bounced">Bounced</option></select>
          <input className={inputCls} placeholder="Reference (optional)" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
          <input className={inputCls} type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-ink-400"><span>{label}</span><span className="font-semibold text-ink-100">{value}</span></div>;
}
