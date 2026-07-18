'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

interface Invoice {
  description: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt: string | null;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod: string;
  gstCredit: boolean;
}

const EXPENSE_CATEGORIES = ['Server/API', 'Salary', 'Marketing', 'Office', 'Other'];
const PAYMENT_METHODS = ['GPay', 'Bank Transfer', 'Card', 'Cash'];
const STORAGE_KEY = 'g4d_expenses';

const formatCurrency = (rupees: number): string => `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function loadExpenses(): Expense[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export default function AccountingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: '', paymentMethod: PAYMENT_METHODS[0], gstCredit: false });

  useEffect(() => {
    setExpenses(loadExpenses());
    api.getInvoices().then((res) => setInvoices(res.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function persistExpenses(next: Expense[]) {
    setExpenses(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.amount || !form.date) return;
    const expense: Expense = {
      id: `exp_${Date.now()}`,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      date: form.date,
      paymentMethod: form.paymentMethod,
      gstCredit: form.gstCredit,
    };
    persistExpenses([expense, ...expenses]);
    setForm({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: '', paymentMethod: PAYMENT_METHODS[0], gstCredit: false });
  }

  function removeExpense(id: string) {
    persistExpenses(expenses.filter((e) => e.id !== id));
  }

  const now = new Date();
  const thisMonth = invoices.filter((i) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt).getMonth() === now.getMonth() && new Date(i.paidAt).getFullYear() === now.getFullYear());
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
  const lastMonth = invoices.filter((i) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt).getMonth() === lastMonthDate.getMonth() && new Date(i.paidAt).getFullYear() === lastMonthDate.getFullYear());
  const allPaid = invoices.filter((i) => i.status === 'PAID');

  const sumTotal = (list: Invoice[]) => list.reduce((s, i) => s + i.totalAmount, 0) / 100;
  const sumGst = (list: Invoice[]) => list.reduce((s, i) => s + i.gstAmount, 0) / 100;
  const domainAppRevenue = allPaid.filter((i) => /domainapp/i.test(i.description)).reduce((s, i) => s + i.totalAmount, 0) / 100;
  const domainCampaignRevenue = allPaid.filter((i) => /domaincampaign/i.test(i.description)).reduce((s, i) => s + i.totalAmount, 0) / 100;

  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalExpenses = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const expensesByCategory = EXPENSE_CATEGORIES.map((cat) => ({
    category: cat,
    total: thisMonthExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);

  const inputTaxCredit = thisMonthExpenses.filter((e) => e.gstCredit).reduce((s, e) => s + Math.round(e.amount * 0.18), 0);
  const gstCollected = sumGst(thisMonth);
  const netGstPayable = Math.max(0, gstCollected - inputTaxCredit);

  const totalIncome = sumTotal(thisMonth);
  const netProfit = totalIncome - totalExpenses;

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Accounting</h2>
        <p className="mt-1 text-sm text-slate-400">Revenue, expenses, GST and profit — auto-calculated from invoices.</p>
      </div>

      {/* Revenue summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'This Month', value: formatCurrency(sumTotal(thisMonth)) },
          { label: 'Last Month', value: formatCurrency(sumTotal(lastMonth)) },
          { label: 'DomainApp Revenue', value: formatCurrency(domainAppRevenue) },
          { label: 'DomainCampaign Revenue', value: formatCurrency(domainCampaignRevenue) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Expense entry */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-white mb-4">Add Expense</h3>
        <form onSubmit={addExpense} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none" />
          <input required type="number" min="1" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none" />
          <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none" />
          <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none">
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-400 px-1">
            <input type="checkbox" checked={form.gstCredit} onChange={(e) => setForm({ ...form, gstCredit: e.target.checked })} />
            GST input credit (18%)
          </label>
          <Button type="submit" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} className="lg:col-span-3 w-fit">Save Expense</Button>
        </form>

        {thisMonthExpenses.length > 0 && (
          <div className="mt-4 space-y-2">
            {thisMonthExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2.5 text-sm">
                <div>
                  <span className="text-white font-medium">{e.description}</span>
                  <span className="text-slate-500 ml-2">{e.category} · {e.paymentMethod}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold">{formatCurrency(e.amount)}</span>
                  <button onClick={() => removeExpense(e.id)} aria-label="Delete expense" className="text-slate-500 hover:text-error-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GST report */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Monthly GST Report</h3>
          <Button size="sm" variant="outline" leftIcon={<Download className="h-3.5 w-3.5" />} className="border-slate-700 text-slate-300"
            onClick={() => window.print()}>Export for Filing</Button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Total sales</span><span className="text-white font-medium">{formatCurrency(totalIncome)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">GST collected (18%)</span><span className="text-white font-medium">{formatCurrency(gstCollected)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Input tax credit</span><span className="text-white font-medium">{formatCurrency(inputTaxCredit)}</span></div>
          <div className="flex justify-between border-t border-slate-800 pt-2 font-bold"><span className="text-white">Net GST payable</span><span className="text-primary-400">{formatCurrency(netGstPayable)}</span></div>
        </div>
      </div>

      {/* P&L */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-white mb-4">P&amp;L Statement — This Month</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Income</div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">DomainApp</span><span className="text-white">{formatCurrency(domainAppRevenue)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">DomainCampaign</span><span className="text-white">{formatCurrency(domainCampaignRevenue)}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-800 pt-1.5"><span className="text-white">Total</span><span className="text-success-400">{formatCurrency(totalIncome)}</span></div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Expenses</div>
            <div className="space-y-1.5 text-sm">
              {expensesByCategory.length === 0 && <p className="text-slate-500 text-xs">No expenses logged this month.</p>}
              {expensesByCategory.map((c) => (
                <div key={c.category} className="flex justify-between"><span className="text-slate-400">{c.category}</span><span className="text-white">{formatCurrency(c.total)}</span></div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-800 pt-1.5"><span className="text-white">Total</span><span className="text-error-400">{formatCurrency(totalExpenses)}</span></div>
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-primary-950/40 border border-primary-800 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">Net Profit</span>
          <span className={`text-lg font-bold ${netProfit >= 0 ? 'text-success-400' : 'text-error-400'}`}>{formatCurrency(netProfit)}</span>
        </div>
      </div>
    </div>
  );
}
