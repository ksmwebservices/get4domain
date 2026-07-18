'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, FileText, CreditCard, CalendarCheck, TrendingUp,
  Globe, Megaphone, ArrowRight, Clock, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';

interface Vendor {
  id: string;
  name: string;
  businessName: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt: string | null;
  dueDate: string | null;
  vendor: { businessName: string; name: string };
}

interface Subscription {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  plan: string;
}

interface Ticket {
  id: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
}

const recentDemos = [
  { id: 'D001', name: 'Ravi Kumar',   business: 'Spice Garden',     industry: 'Restaurant', interest: 'DomainApp Startup',    status: 'pending', date: '18 Jan' },
  { id: 'D002', name: 'Priya Sharma', business: 'Himalayan Tours',  industry: 'Travel',     interest: 'DomainApp Enterprise', status: 'called',  date: '17 Jan' },
  { id: 'D003', name: 'Anil Mehta',   business: 'CareWell Clinic',  industry: 'Healthcare', interest: 'DomainApp Startup',    status: 'pending', date: '16 Jan' },
];

const statusColors: Record<string, string> = {
  pending: 'bg-warning-500/20 text-warning-400',
  called:  'bg-primary-500/20 text-primary-400',
};

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function AdminHome() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function loadStats() {
      try {
        const [vendorsRes, invoicesRes, subscriptionsRes, ticketsRes] = await Promise.all([
          api.getVendors(),
          api.getInvoices(),
          api.getSubscriptions(),
          api.getTickets(),
        ]);
        if (cancelled) return;
        setVendors(vendorsRes.data ?? []);
        setInvoices(invoicesRes.data ?? []);
        setSubscriptions(subscriptionsRes.data ?? []);
        setTickets(ticketsRes.data ?? []);
      } catch {
        // Network/server errors show as an empty state below, not a raw error message.
        // 401s are handled globally in api.ts (redirects to /login).
        if (!cancelled) setError('Could not load live data — showing what we have.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();
    return () => { cancelled = true; };
  }, [mounted]);

  const now = new Date();
  const revenueThisMonth = invoices
    .filter(i => i.status === 'PAID' && i.paidAt && new Date(i.paidAt).getMonth() === now.getMonth() && new Date(i.paidAt).getFullYear() === now.getFullYear())
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const pendingInvoices = invoices.filter(i => i.status === 'PENDING');
  const pendingTotal = pendingInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE');
  const openTickets = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');

  const stats = [
    { label: 'Total Customers',     value: String(vendors.length),  sub: 'Vendors on the platform', icon: Users,         color: 'text-primary-400',   bg: 'bg-primary-500/10' },
    { label: 'Demo Bookings',       value: '3',                      sub: '2 pending call',          icon: CalendarCheck, color: 'text-secondary-400', bg: 'bg-secondary-500/10' },
    { label: 'Active Subscriptions',value: String(activeSubscriptions.length), sub: activeSubscriptions[0]?.plan ?? 'None yet', icon: Globe, color: 'text-success-400', bg: 'bg-success-500/10' },
    { label: 'Revenue This Month',  value: formatCurrency(revenueThisMonth), sub: `${invoices.filter(i => i.status === 'PAID').length} paid invoices`, icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Pending Invoices',    value: String(pendingInvoices.length), sub: pendingInvoices.length ? `${formatCurrency(pendingTotal)} due` : 'None pending', icon: FileText, color: 'text-warning-400', bg: 'bg-warning-500/10' },
    { label: 'Open Support Tickets',value: String(openTickets.length), sub: openTickets.length ? 'Needs attention' : 'All resolved', icon: AlertCircle, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  ];

  const recentCustomers = vendors.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Platform Overview</h2>
        <p className="mt-1 text-sm text-slate-400">All customers, demo bookings and revenue at a glance.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-error-800 bg-error-950/50 px-4 py-3 text-sm text-error-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{stat.label}</div>
                  <div className="text-xs text-slate-600 mt-1">{stat.sub}</div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Demo bookings — no backend yet, still mocked */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Demo Bookings</h3>
                <Link href="/admin/leads" className="text-xs font-semibold text-primary-400 hover:text-primary-300">View all →</Link>
              </div>
              <div className="divide-y divide-slate-800">
                {recentDemos.map((demo) => (
                  <div key={demo.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/50 transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-white">{demo.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{demo.business} · {demo.industry}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{demo.interest}</div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[demo.status]}`}>
                        {demo.status === 'pending' ? '📞 Pending call' : '✓ Called'}
                      </span>
                      <div className="text-xs text-slate-600 mt-1">{demo.date}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-slate-800">
                <Link href="/admin/leads" className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 font-medium">
                  Manage all bookings <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Customers */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Active Customers</h3>
                <Link href="/admin/customers" className="text-xs font-semibold text-primary-400 hover:text-primary-300">View all →</Link>
              </div>
              <div className="divide-y divide-slate-800">
                {recentCustomers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <div className="text-sm font-semibold text-white">{c.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{c.businessName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Since {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                  </div>
                ))}
                {recentCustomers.length === 0 && (
                  <div className="px-5 py-8 text-center">
                    <p className="text-xs text-slate-600">More customers will appear here as they sign up.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick actions */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-white mb-4">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/admin/leads',     icon: CalendarCheck, label: 'Review Demo Bookings',  desc: '3 pending calls',      color: 'text-secondary-400' },
            { href: '/admin/invoices',  icon: FileText,       label: 'Send Payment Link',    desc: `${pendingInvoices.length} pending invoice${pendingInvoices.length === 1 ? '' : 's'}`, color: 'text-warning-400' },
            { href: '/admin/customers', icon: Users,          label: 'Activate Subscription',desc: 'After payment confirmed', color: 'text-success-400' },
            { href: '/admin/support',   icon: AlertCircle,    label: 'Check Support',        desc: `${openTickets.length} open ticket${openTickets.length === 1 ? '' : 's'}`, color: 'text-slate-400' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href + action.label} href={action.href}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/50 p-4 hover:border-slate-700 hover:bg-slate-800 transition-all group">
                <Icon className={`h-5 w-5 flex-shrink-0 ${action.color}`} />
                <div>
                  <div className="text-sm font-semibold text-white">{action.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
