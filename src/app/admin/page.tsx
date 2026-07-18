'use client';

import Link from 'next/link';
import {
  Users, FileText, CreditCard, CalendarCheck, TrendingUp,
  Globe, Megaphone, ArrowRight, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';

const stats = [
  { label: 'Total Customers',     value: '1',       sub: '+1 this month',      icon: Users,         color: 'text-primary-400',   bg: 'bg-primary-500/10' },
  { label: 'Demo Bookings',       value: '3',       sub: '2 pending call',      icon: CalendarCheck, color: 'text-secondary-400', bg: 'bg-secondary-500/10' },
  { label: 'Active Subscriptions',value: '1',       sub: 'DomainApp Enterprise',icon: Globe,         color: 'text-success-400',   bg: 'bg-success-500/10' },
  { label: 'Revenue This Month',  value: '₹29,499', sub: 'INV-001 paid',        icon: CreditCard,    color: 'text-emerald-400',   bg: 'bg-emerald-500/10' },
  { label: 'Pending Invoices',    value: '1',       sub: '₹35,399 due 25 Jan',  icon: FileText,      color: 'text-warning-400',   bg: 'bg-warning-500/10' },
  { label: 'Open Support Tickets',value: '0',       sub: 'All resolved',        icon: AlertCircle,   color: 'text-slate-400',     bg: 'bg-slate-500/10' },
];

const recentDemos = [
  { id: 'D001', name: 'Ravi Kumar',   business: 'Spice Garden',     industry: 'Restaurant', interest: 'DomainApp Startup',    status: 'pending', date: '18 Jan' },
  { id: 'D002', name: 'Priya Sharma', business: 'Himalayan Tours',  industry: 'Travel',     interest: 'DomainApp Enterprise', status: 'called',  date: '17 Jan' },
  { id: 'D003', name: 'Anil Mehta',   business: 'CareWell Clinic',  industry: 'Healthcare', interest: 'DomainApp Startup',    status: 'pending', date: '16 Jan' },
];

const recentCustomers = [
  { id: 'C001', name: 'Muthukumar R', business: 'MR Travels', plan: 'DomainApp Enterprise', status: 'active', since: '15 Jan 2026' },
];

const statusColors: Record<string, string> = {
  pending: 'bg-warning-500/20 text-warning-400',
  called:  'bg-primary-500/20 text-primary-400',
  active:  'bg-success-500/20 text-success-400',
};

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Platform Overview</h2>
        <p className="mt-1 text-sm text-slate-400">All customers, demo bookings and revenue at a glance.</p>
      </div>

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
        {/* Demo bookings */}
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
                  <div className="text-xs text-slate-400 mt-0.5">{c.business}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Since {c.since}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-slate-300">{c.plan}</div>
                  <span className="mt-1 inline-block rounded-full bg-success-500/20 px-2.5 py-0.5 text-xs font-semibold text-success-400">Active</span>
                </div>
              </div>
            ))}
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-slate-600">More customers will appear here as they sign up.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-sm font-bold text-white mb-4">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/admin/leads',     icon: CalendarCheck, label: 'Review Demo Bookings',  desc: '3 pending calls',      color: 'text-secondary-400' },
            { href: '/admin/invoices',  icon: FileText,       label: 'Send Payment Link',    desc: '1 pending invoice',    color: 'text-warning-400' },
            { href: '/admin/customers', icon: Users,          label: 'Activate Subscription',desc: 'After payment confirmed', color: 'text-success-400' },
            { href: '/admin/support',   icon: AlertCircle,    label: 'Check Support',        desc: '0 open tickets',       color: 'text-slate-400' },
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
