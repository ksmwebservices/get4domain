'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, TrendingUp, Download, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Invoice {
  description: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
}

const PROGRESS = [
  { label: 'Social Posts', done: 45, total: 120 },
  { label: 'Posters', done: 32, total: 150 },
  { label: 'Blog Articles', done: 3, total: 10 },
  { label: 'GBP Updates', done: 4, total: 12 },
];

const PAST_REPORTS = [
  { month: 'June 2026' },
  { month: 'May 2026' },
];

const KEYWORDS = [
  { keyword: 'best travel agency chennai', position: 8 },
  { keyword: 'tour packages near me', position: 14 },
  { keyword: 'chennai to ooty package', position: 5 },
];

export default function MyCampaignPage() {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getVendorInvoices(user.id)
      .then((res: { data?: Invoice[] }) => {
        const invoices = res.data ?? [];
        setSubscribed(invoices.some((i) => i.status === 'PAID' && /domaincampaign/i.test(i.description)));
      })
      .catch(() => setSubscribed(false));
  }, [user]);

  if (subscribed === null) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  if (!subscribed) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <Megaphone className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">You're not on DomainCampaign yet</h2>
        <p className="mt-2 text-sm text-slate-500">We manage your social media, SEO and Google Business Profile — 120 posts a month, done for you.</p>
        <Link href="/dashboard/my-services" className="mt-6 inline-block">
          <Button rightIcon={<ArrowRight className="h-4 w-4" />}>View DomainCampaign Plans</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">July 2026 Campaign</h2>
        <p className="mt-1 text-sm text-slate-500">Your managed marketing activity this month.</p>
      </div>

      {/* Progress */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PROGRESS.map((p) => (
          <div key={p.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-900">{p.label}</span>
              <span className="text-xs text-slate-500">{p.done}/{p.total}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.min(100, (p.done / p.total) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Reports */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Monthly Reports</h3>
        <div className="space-y-2">
          {PAST_REPORTS.map((r) => (
            <div key={r.month} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
              <span className="text-sm text-slate-700">{r.month}</span>
              <Button size="sm" variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />}>Download PDF</Button>
            </div>
          ))}
        </div>
      </div>

      {/* SEO */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary-600" />SEO Keyword Tracking</h3>
        <p className="text-xs text-slate-400 mb-3">Sample data — live tracking connects soon.</p>
        <div className="space-y-2">
          {KEYWORDS.map((k) => (
            <div key={k.keyword} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
              <span className="text-sm text-slate-700">{k.keyword}</span>
              <span className="text-xs font-semibold text-primary-600">#{k.position}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-primary-50 p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-medium text-slate-900">Want more products featured in this month's posts?</span>
        </div>
        <Link href="/dashboard/my-products">
          <Button size="sm" variant="outline" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Manage My Products</Button>
        </Link>
      </div>
    </div>
  );
}
