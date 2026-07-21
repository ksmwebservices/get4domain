'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users, Megaphone, TrendingUp, Eye } from 'lucide-react';
import { api } from '@/lib/api';

interface CrmLead { status: string }
interface Campaign { status: string; walletCost: number }
interface CampaignPage { views: number }

const STATUS_ORDER = ['new', 'contacted', 'quoted', 'won', 'lost'];

export default function ReportsPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pages, setPages] = useState<CampaignPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getCrmLeads(), api.getCampaigns(), api.getCampaignPages()])
      .then(([leadsRes, campaignsRes, pagesRes]) => {
        setLeads(leadsRes.data ?? []);
        setCampaigns(campaignsRes.data ?? []);
        setPages(pagesRes.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const totalViews = pages.reduce((sum, p) => sum + p.views, 0);
  const wonLeads = leads.filter((l) => l.status === 'won').length;
  const conversion = leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) : '0.0';
  const totalSpend = campaigns.reduce((sum, c) => sum + c.walletCost, 0);

  const statusCounts = STATUS_ORDER.map((s) => ({ status: s, count: leads.filter((l) => l.status === s).length }));
  const maxCount = Math.max(1, ...statusCounts.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Reports</h2>
        <p className="mt-1 text-sm text-slate-500">Performance summary across your leads, page and campaigns.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Eye, label: 'Page Views', value: totalViews, color: 'text-primary-600', bg: 'bg-primary-50' },
          { icon: Users, label: 'Total Leads', value: leads.length, color: 'text-secondary-600', bg: 'bg-secondary-50' },
          { icon: TrendingUp, label: 'Conversion Rate', value: `${conversion}%`, color: 'text-success-600', bg: 'bg-success-50' },
          { icon: Megaphone, label: 'Campaign Spend', value: `₹${(totalSpend / 100).toLocaleString('en-IN')}`, color: 'text-warning-600', bg: 'bg-warning-50' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="text-lg font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Lead Funnel</h3>
        <div className="space-y-3">
          {statusCounts.map((s) => (
            <div key={s.status} className="flex items-center gap-3">
              <span className="w-20 flex-shrink-0 text-xs font-medium text-slate-600 capitalize">{s.status}</span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-primary-500" style={{ width: `${(s.count / maxCount) * 100}%` }} />
              </div>
              <span className="w-8 flex-shrink-0 text-right text-xs font-bold text-slate-900">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Campaigns by Status</h3>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No campaigns yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['draft', 'pending_approval', 'approved', 'running'].map((status) => (
              <div key={status} className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-lg font-bold text-slate-900">{campaigns.filter((c) => c.status === status).length}</div>
                <div className="text-xs text-slate-500 capitalize mt-0.5">{status.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
