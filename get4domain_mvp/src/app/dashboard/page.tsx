'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UserPlus, Phone, Sparkles, FileText, Wallet, Users, IndianRupee, CalendarClock,
  Loader2, ArrowRight, Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDashboardConfig } from '@/lib/dashboard-config';
import { getCategory } from '@/data/demo-site';
import { api } from '@/lib/api';

interface CrmLead { id: string; name: string; phone: string; source: string | null; status: string; createdAt: string; followUpDate: string | null }
interface GenericInvoice { id: string; invoiceNumber: string; total: number; status: string; paidAt: string | null; createdAt: string; contact?: { name?: string } }
interface ActivityItem { id: string; label: string; sub: string; at: string; href: string }

const rupees = (n: number): string => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const walletRupees = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const timeAgo = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function DashboardHome() {
  const { user } = useAuth();
  const cfg = useDashboardConfig(user?.industry);
  const skin = cfg.industry?.skin;
  const cover = getCategory(user?.industry ?? '')?.coverImage;
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [followups, setFollowups] = useState<CrmLead[]>([]);
  const [invoices, setInvoices] = useState<GenericInvoice[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      api.getCrmLeads().catch(() => ({ data: [] })),
      api.getTelecrmFollowups().catch(() => ({ data: [] })),
      api.getWalletBalance().catch(() => ({ data: { balance: 0 } })),
      api.daGetInvoices('?limit=50').catch(() => ({ data: { items: [] } })),
    ])
      .then(([leadsRes, followupsRes, walletRes, invRes]) => {
        if (cancelled) return;
        setLeads(leadsRes.data ?? []);
        setFollowups(followupsRes.data ?? []);
        setWalletBalance(walletRes.data?.balance ?? 0);
        setInvoices(invRes.data?.items ?? invRes.data ?? []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);

  const leadsToday = leads.filter((l) => new Date(l.createdAt) >= startToday).length;
  const monthlyRevenue = invoices
    .filter((i) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt) >= startMonth)
    .reduce((sum, i) => sum + (i.total ?? 0), 0);
  const pendingFollowups = followups.length;

  // Recent activity — merge newest leads and paid invoices.
  const activity: ActivityItem[] = [
    ...leads.slice(0, 5).map((l) => ({ id: `lead-${l.id}`, label: `New lead: ${l.name}`, sub: `${l.source ?? 'manual'} · ${l.phone}`, at: l.createdAt, href: '/dashboard/telecrm' })),
    ...invoices.filter((i) => i.status === 'PAID' && i.paidAt).slice(0, 5).map((i) => ({ id: `inv-${i.id}`, label: `Invoice ${i.invoiceNumber} paid`, sub: rupees(i.total), at: i.paidAt as string, href: '/dashboard/invoices' })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5);

  const upcoming = followups.slice(0, 3);

  // 2A — real KPI numbers, all vendorId-scoped (from the vendor's own data).
  const now = new Date();
  const thisMonth = (iso?: string | null) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
  const leadsThisMonth = leads.filter((l) => thisMonth(l.createdAt)).length;
  const wonCount = leads.filter((l) => /won/i.test(l.status)).length;
  const pipelineActive = leads.filter((l) => !/won|lost/i.test(l.status)).length;
  const revenueThisMonth = invoices.filter((i) => i.status === 'PAID' && thisMonth(i.paidAt)).reduce((s, i) => s + (i.total || 0), 0);
  const kpis = [
    { label: 'Leads this month', value: String(leadsThisMonth), sub: `${leads.length} total`, bg: 'from-blue-500 to-blue-600', href: '/dashboard/telecrm' },
    { label: 'Active pipeline', value: String(pipelineActive), sub: `${wonCount} won`, bg: 'from-indigo-500 to-indigo-600', href: '/dashboard/crm' },
    { label: 'Revenue this month', value: rupees(revenueThisMonth), sub: 'paid invoices', bg: 'from-emerald-500 to-emerald-600', href: '/dashboard/reports' },
    { label: 'Follow-ups due', value: String(followups.length), sub: 'to call back', bg: 'from-amber-500 to-amber-600', href: '/dashboard/telecrm' },
  ];

  const QUICK = [
    { label: 'New Lead', icon: UserPlus, href: '/dashboard/crm', bg: 'bg-primary-600' },
    { label: 'Call Next', icon: Phone, href: '/dashboard/telecrm', bg: 'bg-emerald-600' },
    { label: 'Create Content', icon: Sparkles, href: '/dashboard/ai-studio', bg: 'bg-indigo-600' },
    { label: 'New Invoice', icon: FileText, href: '/dashboard/invoices', bg: 'bg-amber-600' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const isSandbox = user?.plan === 'Demo Sandbox';

  return (
    <div className="space-y-6">
      {/* Sandbox → go-live banner (Phase 5). Shown only for demo sandbox sessions. */}
      {isSandbox && (
        <Link href="/dashboard/go-live" className="block rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 p-5 text-white transition-shadow hover:shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-base font-bold">You&apos;re exploring a demo sandbox</div>
              <div className="mt-0.5 text-sm text-white/90">Loved it? Go live with your real account — everything included for ₹999/month. Your demo data carries over.</div>
            </div>
            <span className="flex-shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary-700">Go live →</span>
          </div>
        </Link>
      )}

      {/* Industry skin banner (2.1) — accent + cover + welcome + quick actions, driven by industry config */}
      {skin && cfg.industry && !isSandbox && (
        <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${skin.accentColor}, ${skin.accentColorDark})` }}>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
          )}
          <div className="relative">
            <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">{cfg.industry.label}</span>
            <p className="mt-2 max-w-xl text-sm font-medium text-white/95">{skin.welcomeText}</p>
            {skin.quickActions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skin.quickActions.map((qa) => (
                  <Link key={qa.key} href={qa.href} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/25">
                    {qa.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2A — KPI cards (colorful, mirroring the admin overview) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className={`rounded-2xl bg-gradient-to-br ${k.bg} p-4 text-white transition-shadow hover:shadow-lg`}>
            <div className="text-2xl font-bold leading-none">{k.value}</div>
            <div className="mt-1 text-xs font-medium text-white/90">{k.label}</div>
            <div className="mt-0.5 text-[11px] text-white/70">{k.sub}</div>
          </Link>
        ))}
      </div>

      {/* Top */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{greeting}, {firstName} 👋</h2>
          <p className="mt-1 text-sm text-slate-500">{user?.businessName ?? 'Your business'}{user?.industry ? ` · ${user.industry.replace('-', ' & ')}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
            <Wallet className="h-4 w-4 text-primary-600" />{walletBalance !== null ? walletRupees(walletBalance) : '—'}
          </span>
          <Link href="/dashboard/wallet" className="rounded-xl bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">Top Up</Link>
        </div>
      </div>

      {/* Quick actions — horizontal scroll on mobile */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.label} href={q.href} className="flex min-w-[128px] flex-1 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${q.bg} text-white`}><Icon className="h-4 w-4" /></span>
              <span className="text-sm font-semibold text-slate-800">{q.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users, label: 'Leads Today', value: String(leadsToday), color: 'text-primary-600', bg: 'bg-primary-50' },
          { icon: IndianRupee, label: 'Monthly Revenue', value: rupees(monthlyRevenue), color: 'text-success-600', bg: 'bg-success-50' },
          { icon: CalendarClock, label: 'Pending Follow-ups', value: String(pendingFollowups), color: 'text-warning-600', bg: 'bg-warning-50' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg}`}><Icon className={`h-4 w-4 ${stat.color}`} /></div>
              <div className="truncate text-lg font-bold text-slate-900">{stat.value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-base font-bold text-slate-900">Recent Activity</h3>
        {activity.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">No activity yet.</p>
        ) : (
          <div className="space-y-2.5">
            {activity.map((a) => (
              <Link key={a.id} href={a.href} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 hover:bg-slate-100">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{a.label}</div>
                  <div className="text-xs text-slate-500">{a.sub}</div>
                </div>
                <span className="flex-shrink-0 text-xs text-slate-400">{timeAgo(a.at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming follow-ups */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Upcoming Follow-ups</h3>
          <Link href="/dashboard/telecrm" className="text-xs font-semibold text-primary-600 hover:underline">View all</Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">No follow-ups scheduled.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {upcoming.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-700">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </div>
                <div className="mt-1.5 truncate text-sm font-semibold text-slate-900">{lead.name}</div>
                <div className="text-xs text-slate-500">{lead.phone}</div>
                <a href={`tel:${lead.phone}`} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                  <Phone className="h-3.5 w-3.5" />Call Now
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 p-5">
        <div>
          <div className="text-sm font-bold text-slate-900">Need help or want to request changes?</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" />We respond within 24 hours on WhatsApp and email.</div>
        </div>
        <Link href="/dashboard/support" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Get Support <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    </div>
  );
}
