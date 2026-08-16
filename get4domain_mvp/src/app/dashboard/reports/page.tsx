'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users, TrendingUp, IndianRupee, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';

interface CrmLead { status: string }
interface Campaign { status: string; walletCost: number }
interface Invoice { total: number; status: string; createdAt: string }
interface WalletTxn { type: string; amount: number; service: string }
interface Summary { revenue: { paid: number; pending: number }; counts: { records: number; contacts: number } }

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'];

function monthKey(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export default function AnalyticsHubPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [usage, setUsage] = useState<{ leads: number; calls: number; aiGenerations: number; messages: number; campaigns: number; listings: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    Promise.all([
      api.getCrmLeads().catch(() => ({ data: [] })),
      api.getCampaigns().catch(() => ({ data: [] })),
      api.daGetInvoices('?limit=100').catch(() => ({ data: { items: [] } })),
      api.getWalletTransactions(1, 100).catch(() => ({ data: { items: [] } })),
      api.daGetSummary().catch(() => ({ data: null })),
      api.getUsage(`?from=${monthStart}`).catch(() => ({ data: null })),
    ])
      .then(([l, c, inv, w, s, u]) => {
        setLeads(l.data ?? []);
        setCampaigns(c.data ?? []);
        setInvoices(inv.data?.items ?? []);
        setTxns(w.data?.items ?? []);
        setSummary(s.data ?? null);
        setUsage(u.data ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const wonLeads = leads.filter((l) => l.status === 'won').length;
  const conversion = leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) : '0.0';
  const revenuePaid = summary?.revenue.paid ?? invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const walletSpent = txns.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  // Revenue by month (paid invoices)
  const revByMonth = new Map<string, number>();
  invoices.filter((i) => i.status === 'PAID').forEach((i) => {
    const k = monthKey(i.createdAt);
    revByMonth.set(k, (revByMonth.get(k) ?? 0) + i.total);
  });
  const revSeries = Array.from(revByMonth.entries()).slice(-6);
  const maxRev = Math.max(1, ...revSeries.map(([, v]) => v));

  // Lead funnel
  const statusCounts = STATUS_ORDER.map((s) => ({ status: s, count: leads.filter((l) => l.status === s).length }));
  const maxCount = Math.max(1, ...statusCounts.map((s) => s.count));

  // Wallet usage by service
  const byService = new Map<string, number>();
  txns.filter((t) => t.type === 'debit').forEach((t) => byService.set(t.service, (byService.get(t.service) ?? 0) + t.amount));
  const serviceSeries = Array.from(byService.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxService = Math.max(1, ...serviceSeries.map(([, v]) => v));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Analytics Hub</h1>
        <p className="mt-1 text-sm text-slate-500">Cross-module performance — revenue, leads, campaigns, wallet.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue (paid)" value={`₹${revenuePaid.toLocaleString('en-IN')}`} icon={<IndianRupee className="h-5 w-5" />} tone="success" />
        <StatCard label="Total Leads" value={leads.length} icon={<Users className="h-5 w-5" />} tone="primary" />
        <StatCard label="Conversion" value={`${conversion}%`} icon={<TrendingUp className="h-5 w-5" />} tone="warning" />
        <StatCard label="Wallet Spent" value={`₹${walletSpent.toLocaleString('en-IN')}`} icon={<Wallet className="h-5 w-5" />} tone="neutral" />
      </div>

      {/* 2E — tool usage this month (feeds the overview KPIs) */}
      {usage && (
        <Card>
          <h3 className="mb-4 text-base font-bold text-slate-900">Your tool usage this month</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: 'Leads', value: usage.leads }, { label: 'Calls', value: usage.calls },
              { label: 'AI generations', value: usage.aiGenerations }, { label: 'Messages', value: usage.messages },
              { label: 'Campaigns', value: usage.campaigns }, { label: 'Listings', value: usage.listings },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-xl font-bold text-slate-900">{m.value}</div>
                <div className="mt-0.5 text-[11px] font-medium text-slate-500">{m.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="mb-4 text-base font-bold text-slate-900">Revenue (last 6 months)</h3>
        {revSeries.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">No paid invoices yet.</p>
        ) : (
          <div className="flex h-48 items-end gap-3">
            {revSeries.map(([month, val]) => (
              <div key={month} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-primary-500" style={{ height: `${(val / maxRev) * 100}%` }} title={`₹${val.toLocaleString('en-IN')}`} />
                </div>
                <span className="text-[11px] text-slate-500">{month}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-base font-bold text-slate-900">Lead Funnel</h3>
          <div className="space-y-3">
            {statusCounts.map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <span className="w-20 flex-shrink-0 text-xs font-medium capitalize text-slate-600">{s.status}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary-500" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                </div>
                <span className="w-8 flex-shrink-0 text-right text-xs font-bold text-slate-900">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-bold text-slate-900">Wallet Usage by Service</h3>
          {serviceSeries.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">No wallet usage yet.</p>
          ) : (
            <div className="space-y-3">
              {serviceSeries.map(([service, val]) => (
                <div key={service} className="flex items-center gap-3">
                  <span className="w-24 flex-shrink-0 truncate text-xs font-medium capitalize text-slate-600">{service}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-secondary-500" style={{ width: `${(val / maxService) * 100}%` }} />
                  </div>
                  <span className="w-16 flex-shrink-0 text-right text-xs font-bold text-slate-900">₹{val.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 text-base font-bold text-slate-900">Campaigns by Status</h3>
        {campaigns.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">No campaigns yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['draft', 'pending_review', 'approved', 'active'].map((status) => (
              <div key={status} className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-lg font-bold text-slate-900">{campaigns.filter((c) => c.status === status).length}</div>
                <div className="mt-0.5 text-xs capitalize text-slate-500">{status.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
