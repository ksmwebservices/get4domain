'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, Wallet, Plus, ArrowUpRight, TrendingUp, TrendingDown, Minus, ChevronRight,
  UserPlus, Phone, FileText, Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDashboardConfig } from '@/lib/dashboard-config';
import { api } from '@/lib/api';
import { Badge } from '@/components/vendor/Badge';
import { Icon } from '@/components/vendor/Icon';
import { EmptyState } from '@/components/vendor/EmptyState';

interface CrmLead { id: string; name: string; phone: string; source: string | null; status: string; createdAt: string; followUpDate: string | null }
interface GenericInvoice { id: string; invoiceNumber: string; total: number; status: string; paidAt: string | null; createdAt: string; contact?: { name?: string } }
interface ActivityItem { id: string; icon: string; label: string; sub: string; at: string; href: string; tone: 'positive' | 'negative' | 'neutral' }

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

const trendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus };
const trendColor = { up: 'text-success', down: 'text-ruby-400', flat: 'text-ink-500' };
const toneColor: Record<string, string> = {
  positive: 'text-success bg-success/10',
  negative: 'text-ruby-400 bg-ruby-500/10',
  neutral: 'text-ink-400 bg-ink-800/60',
};

interface RecentCall { id?: string; name?: string; phone?: string; outcome?: string; createdAt?: string }
interface Notification { id?: string; title?: string; body?: string; createdAt?: string; href?: string }

export default function DashboardHome() {
  const { user } = useAuth();
  const cfg = useDashboardConfig(user?.industry);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [followups, setFollowups] = useState<CrmLead[]>([]);
  const [invoices, setInvoices] = useState<GenericInvoice[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [usage, setUsage] = useState<{ leads: number; calls: number; aiGenerations: number; messages: number; campaigns: number; listings: number } | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    // Existing endpoints + the dispatch's dashboard endpoints (all vendorId-scoped via the API).
    Promise.all([
      api.getCrmLeads().catch(() => ({ data: [] })),
      api.getTelecrmFollowups().catch(() => ({ data: [] })),
      api.getWalletBalance().catch(() => ({ data: { balance: 0 } })),
      api.daGetInvoices('?limit=50').catch(() => ({ data: { items: [] } })),
      api.getUsage(`?from=${monthStart}`).catch(() => ({ data: null })),
      api.getRecentCalls().catch(() => ({ data: [] })),
      api.getNotifications().catch(() => ({ data: [] })),
    ])
      .then(([leadsRes, followupsRes, walletRes, invRes, usageRes, callsRes, notifRes]) => {
        if (cancelled) return;
        setLeads(leadsRes.data ?? []);
        setFollowups(followupsRes.data ?? []);
        setWalletBalance(walletRes.data?.balance ?? 0);
        setInvoices(invRes.data?.items ?? invRes.data ?? []);
        setUsage(usageRes.data ?? null);
        setRecentCalls((callsRes.data as RecentCall[]) ?? []);
        setNotifications((notifRes.data as Notification[]) ?? []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isSandbox = user?.plan === 'Demo Sandbox';

  const now = new Date();
  const thisMonth = (iso?: string | null) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

  const leadsThisMonth = leads.filter((l) => thisMonth(l.createdAt)).length;
  const leadsToday = leads.filter((l) => new Date(l.createdAt) >= startToday).length;
  const wonCount = leads.filter((l) => /won/i.test(l.status)).length;
  const pipelineActive = leads.filter((l) => !/won|lost/i.test(l.status)).length;
  const revenueThisMonth = invoices.filter((i) => i.status === 'PAID' && thisMonth(i.paidAt)).reduce((s, i) => s + (i.total || 0), 0);
  const pendingInvoices = invoices.filter((i) => i.status !== 'PAID').length;

  // Real KPIs — all derived from the vendor's own data.
  const kpis = [
    { label: 'Leads this month', value: String(leadsThisMonth), delta: `${leadsToday} today`, trend: (leadsToday > 0 ? 'up' : 'flat') as 'up' | 'down' | 'flat', icon: 'Users' },
    { label: 'Active pipeline', value: String(pipelineActive), delta: `${wonCount} won`, trend: (pipelineActive > 0 ? 'up' : 'flat') as 'up' | 'down' | 'flat', icon: 'Filter' },
    { label: 'Revenue this month', value: rupees(revenueThisMonth), delta: 'paid invoices', trend: (revenueThisMonth > 0 ? 'up' : 'flat') as 'up' | 'down' | 'flat', icon: 'IndianRupee' },
    { label: 'Follow-ups due', value: String(followups.length), delta: 'to call back', trend: (followups.length > 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat', icon: 'CalendarClock' },
  ];

  // Real alerts.
  const alerts = [
    followups.length > 0 && { label: `${followups.length} follow-up${followups.length === 1 ? '' : 's'} due`, count: followups.length, severity: 'warning' as const, icon: 'BellRing', href: '/dashboard/telecrm' },
    pendingInvoices > 0 && { label: `${pendingInvoices} unpaid invoice${pendingInvoices === 1 ? '' : 's'}`, count: pendingInvoices, severity: 'urgent' as const, icon: 'FileClock', href: '/dashboard/invoices' },
    walletBalance !== null && walletBalance < 20000 && { label: 'Low wallet balance', count: 1, severity: 'info' as const, icon: 'Wallet', href: '/dashboard/wallet' },
  ].filter(Boolean) as { label: string; count: number; severity: 'info' | 'warning' | 'urgent'; icon: string; href: string }[];
  const severityStyle: Record<string, { variant: 'info' | 'warning' | 'error'; ring: string; color: string }> = {
    info: { variant: 'info', ring: 'border-brand-500/20 bg-brand-500/5', color: 'text-brand-400' },
    warning: { variant: 'warning', ring: 'border-gold-500/20 bg-gold-500/5', color: 'text-gold-400' },
    urgent: { variant: 'error', ring: 'border-ruby-500/20 bg-ruby-500/5', color: 'text-ruby-400' },
  };

  // Real activity — merge newest leads, paid invoices, recent calls and notifications.
  const activity: ActivityItem[] = [
    ...leads.slice(0, 5).map((l) => ({ id: `lead-${l.id}`, icon: 'UserPlus', label: `New lead — ${l.name}`, sub: `${l.source ?? 'manual'} · ${l.phone}`, at: l.createdAt, href: '/dashboard/telecrm', tone: 'positive' as const })),
    ...invoices.filter((i) => i.status === 'PAID' && i.paidAt).slice(0, 5).map((i) => ({ id: `inv-${i.id}`, icon: 'IndianRupee', label: `Invoice ${i.invoiceNumber} paid`, sub: rupees(i.total), at: i.paidAt as string, href: '/dashboard/invoices', tone: 'positive' as const })),
    ...recentCalls.slice(0, 4).map((c, idx) => ({ id: `call-${c.id ?? idx}`, icon: c.outcome === 'missed' ? 'PhoneMissed' : 'Phone', label: `Call ${c.outcome ?? 'logged'} — ${c.name ?? c.phone ?? 'lead'}`, sub: c.phone ?? '', at: c.createdAt ?? new Date().toISOString(), href: '/dashboard/telecrm', tone: (c.outcome === 'missed' ? 'negative' : 'neutral') as 'negative' | 'neutral' })),
    ...notifications.slice(0, 4).map((n, idx) => ({ id: `notif-${n.id ?? idx}`, icon: 'Bell', label: n.title ?? 'Notification', sub: n.body ?? '', at: n.createdAt ?? new Date().toISOString(), href: n.href ?? '/dashboard/notifications', tone: 'neutral' as const })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);

  const recentCustomers = leads.slice(0, 3);
  const quickActions = [
    { label: 'New Lead', icon: 'UserPlus', href: '/dashboard/crm' },
    { label: 'Call Next', icon: 'Phone', href: '/dashboard/telecrm' },
    { label: 'Create Content', icon: 'Sparkles', href: '/dashboard/ai-studio' },
    { label: 'New Invoice', icon: 'FileText', href: '/dashboard/invoices' },
  ];

  return (
    <div className="vendor-ui -m-5 min-h-[calc(100vh-4rem)] bg-ink-950 bg-radial-glow p-5 text-ink-100 lg:-m-8 lg:p-8">
      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-ink-500" /></div>
      ) : (
        <div className="space-y-5 animate-fade-in">
          {/* Greeting */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-ink-50 sm:text-2xl">{greeting}, {firstName}</h2>
              <p className="mt-1 text-sm text-ink-500">
                {user?.businessName ?? 'Your business'}{cfg.industry ? ` · ${cfg.industry.label}` : ''} · {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <Link href="/dashboard/ai-studio" className="btn-gold self-start sm:self-auto"><Sparkles className="h-4 w-4" /> Create with AI</Link>
          </div>

          {/* Sandbox → go-live banner */}
          {isSandbox && (
            <Link href="/dashboard/go-live" className="block rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-600/20 to-brand-900/20 p-5 transition hover:border-brand-500/50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-base font-bold text-ink-50">You&apos;re exploring a demo sandbox</div>
                  <div className="mt-0.5 text-sm text-ink-300">Loved it? Go live with your real account — everything included for ₹999/month. Your demo data carries over.</div>
                </div>
                <span className="btn-gold shrink-0">Go live <ArrowUpRight className="h-4 w-4" /></span>
              </div>
            </Link>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((kpi, i) => {
              const TrendI = trendIcon[kpi.trend];
              return (
                <div key={i} className="card card-hover p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400"><Icon name={kpi.icon} className="h-[18px] w-[18px]" /></div>
                    <div className={`flex items-center gap-0.5 text-xs font-semibold ${trendColor[kpi.trend]}`}><TrendI className="h-3 w-3" />{kpi.delta}</div>
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight text-ink-50">{kpi.value}</div>
                  <div className="mt-1 text-xs text-ink-500">{kpi.label}</div>
                </div>
              );
            })}
          </div>

          {/* Wallet banner (mobile) */}
          <div className="card flex items-center justify-between bg-gradient-to-br from-ink-800/80 to-brand-900/30 p-4 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15"><Wallet className="h-5 w-5 text-gold-400" /></div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Wallet Balance</div>
                <div className="text-xl font-extrabold text-ink-50">{walletBalance !== null ? walletRupees(walletBalance) : '—'}</div>
              </div>
            </div>
            <Link href="/dashboard/wallet" className="btn-gold !py-2 !text-xs"><Plus className="h-3.5 w-3.5" /> Add</Link>
          </div>

          {/* Main grid: quick actions + alerts / activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-100">Quick Actions</h3>
                <span className="hidden items-center gap-1.5 rounded-xl border border-ink-700/60 px-3 py-1.5 text-xs font-semibold text-ink-200 lg:inline-flex">
                  <Wallet className="h-3.5 w-3.5 text-gold-400" />{walletBalance !== null ? walletRupees(walletBalance) : '—'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {quickActions.map((a) => (
                  <Link key={a.label} href={a.href} className="group flex flex-col items-start gap-2.5 rounded-xl border border-ink-700/30 bg-ink-900/40 p-3 text-left transition-all hover:border-brand-500/30 hover:bg-brand-500/5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400 transition-transform group-hover:scale-110"><Icon name={a.icon} className="h-4 w-4" /></div>
                    <span className="text-xs font-semibold leading-tight text-ink-200">{a.label}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-5 border-t border-ink-700/30 pt-5">
                <h3 className="mb-3 text-sm font-bold text-ink-100">Alerts</h3>
                {alerts.length === 0 ? (
                  <p className="text-xs text-ink-500">All clear — nothing needs attention.</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((alert, i) => {
                      const s = severityStyle[alert.severity];
                      return (
                        <Link key={i} href={alert.href} className={`flex items-center gap-3 rounded-xl border p-2.5 ${s.ring}`}>
                          <Icon name={alert.icon} className={`h-4 w-4 shrink-0 ${s.color}`} />
                          <span className="flex-1 text-xs text-ink-300">{alert.label}</span>
                          <Badge variant={s.variant} size="xs">{alert.count}</Badge>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-100">Recent Activity</h3>
                <Link href="/dashboard/notifications" className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-200">View all <ChevronRight className="h-3 w-3" /></Link>
              </div>
              {activity.length === 0 ? (
                <EmptyState icon="Activity" title="No activity yet" description="New leads, payments and calls will show up here as they happen." />
              ) : (
                <div className="space-y-1">
                  {activity.map((act) => (
                    <Link key={act.id} href={act.href} className="group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-ink-800/40">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneColor[act.tone]}`}><Icon name={act.icon} className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="truncate text-sm leading-snug text-ink-200">{act.label}</p>
                        <span className="text-xs text-ink-600">{act.sub ? `${act.sub} · ` : ''}{timeAgo(act.at)}</span>
                      </div>
                      <ArrowUpRight className="mt-1.5 h-4 w-4 text-ink-700 transition group-hover:text-ink-400" />
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-700/30 pt-5">
                <div className="text-center">
                  <div className="text-lg font-extrabold text-ink-50">{rupees(revenueThisMonth)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">Month Revenue</div>
                </div>
                <div className="border-x border-ink-700/30 text-center">
                  <div className="text-lg font-extrabold text-ink-50">{leads.length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">Total Leads</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-extrabold text-success">{leads.length ? Math.round((wonCount / leads.length) * 100) : 0}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">Win Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent customers */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-100">Recent Leads</h3>
              <Link href="/dashboard/telecrm" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">Manage in TeleCRM <ChevronRight className="h-3 w-3" /></Link>
            </div>
            {recentCustomers.length === 0 ? (
              <EmptyState icon="Users" title="No leads yet" description="Leads captured from your website and campaigns will appear here."
                action={<Link href="/dashboard/crm" className="btn-primary !py-2 !text-xs"><UserPlus className="h-3.5 w-3.5" /> Add your first lead</Link>} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentCustomers.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border border-ink-700/30 bg-ink-900/40 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white ring-2 ring-ink-900/50">
                      {c.name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink-100">{c.name}</div>
                      <div className="truncate text-xs text-ink-500">{c.source ?? 'manual'} · {c.phone}</div>
                    </div>
                    <a href={`tel:${c.phone}`} className="btn-ghost-soft !px-2 !py-1.5 text-brand-400"><Phone className="h-4 w-4" /></a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
