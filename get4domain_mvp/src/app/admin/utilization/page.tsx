'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, IndianRupee, Receipt } from 'lucide-react';
import { api } from '@/lib/api';

interface UsageRow { vendorId: string; businessName: string; industry: string | null; leads: number; calls: number; aiGenerations: number; messages: number; campaigns: number; listings: number; total: number }
interface PlatformAcct { invoicesIssued: number; paidCount: number; gstCollected: number; revenueGross: number }

const rupees = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminUtilizationPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [acct, setAcct] = useState<PlatformAcct | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([api.getAllUsage(`?from=${from}&to=${to}`), api.getPlatformAccounting()]);
      setRows(u.data ?? []);
      setAcct(a.data ?? null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const cols: { key: keyof UsageRow; label: string }[] = [
    { key: 'leads', label: 'Leads' }, { key: 'calls', label: 'Calls' }, { key: 'aiGenerations', label: 'AI' },
    { key: 'messages', label: 'Msgs' }, { key: 'campaigns', label: 'Campaigns' }, { key: 'listings', label: 'Listings' }, { key: 'total', label: 'Total' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Utilization &amp; Platform Accounting</h2>
          <p className="mt-1 text-sm text-slate-400">Which vendors use which tools, plus platform-wide invoice/GST totals. Individual vendors&apos; private expense books are never shown here.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5" />
          <span className="text-slate-500">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5" />
        </div>
      </div>

      {/* Aggregate accounting */}
      {acct && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><FileText className="h-5 w-5 text-primary-400" /><div className="mt-2 text-xl font-bold text-white">{acct.invoicesIssued}</div><div className="text-xs text-slate-400">Invoices issued</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><Receipt className="h-5 w-5 text-emerald-400" /><div className="mt-2 text-xl font-bold text-white">{acct.paidCount}</div><div className="text-xs text-slate-400">Paid</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><IndianRupee className="h-5 w-5 text-blue-400" /><div className="mt-2 text-xl font-bold text-white">{rupees(acct.revenueGross)}</div><div className="text-xs text-slate-400">Gross revenue (platform)</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><Receipt className="h-5 w-5 text-violet-400" /><div className="mt-2 text-xl font-bold text-white">{rupees(acct.gstCollected)}</div><div className="text-xs text-slate-400">GST collected</div></div>
        </div>
      )}

      {/* Cross-vendor utilization */}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 bg-slate-900 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3 font-semibold">Vendor</th>
              {cols.map((c) => <th key={c.key} className="px-3 py-3 text-right font-semibold">{c.label}</th>)}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={cols.length + 1} className="px-4 py-6 text-center text-slate-500">No vendors.</td></tr> : rows.map((r) => (
                <tr key={r.vendorId} className={`border-b border-slate-800/60 ${r.total === 0 ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3"><div className="font-semibold text-white">{r.businessName}</div><div className="text-xs text-slate-500">{r.industry ?? '—'}</div></td>
                  {cols.map((c) => <td key={c.key} className={`px-3 py-3 text-right ${c.key === 'total' ? 'font-bold text-white' : 'text-slate-300'}`}>{r[c.key] as number}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">Vendors with 0 total activity are dimmed — useful for spotting low-engagement accounts (including existing-website vendors on landing-page/CRM/AI-only usage).</p>
    </div>
  );
}
