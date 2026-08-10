'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, FileText, CalendarCheck, AlertCircle, IndianRupee, Loader2,
  Phone, MessageCircle, Plus, ArrowRight, Send,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Vendor { id: string; name: string; businessName: string; createdAt: string }
interface Invoice {
  id: string; invoiceNumber: string; totalAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt: string | null; dueDate: string | null;
  vendor?: { businessName: string; name: string };
}
interface Ticket { id: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' }
interface DemoLead { id: string; name: string; phone: string; business: string; industry: string; interest: string; status: string; createdAt: string }

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function AdminHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [leads, setLeads] = useState<DemoLead[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getVendors().catch(() => ({ data: [] })),
      api.getInvoices().catch(() => ({ data: [] })),
      api.getTickets().catch(() => ({ data: [] })),
      api.getLeads().catch(() => ({ data: [] })),
    ])
      .then(([vRes, iRes, tRes, lRes]) => {
        if (cancelled) return;
        setVendors(vRes.data ?? []);
        setInvoices(iRes.data ?? []);
        setTickets(tRes.data ?? []);
        setLeads(lRes.data ?? []);
      })
      .catch(() => { if (!cancelled) setError('Could not load live data — showing what we have.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const revenueThisMonth = invoices
    .filter((i) => i.status === 'PAID' && i.paidAt && new Date(i.paidAt).getMonth() === now.getMonth() && new Date(i.paidAt).getFullYear() === now.getFullYear())
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const pendingInvoices = invoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE');
  const pendingTotal = pendingInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const openTickets = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');

  const stats = [
    { label: 'Total Vendors', value: String(vendors.length), sub: 'On the platform', icon: Users, color: 'text-primary-400', bg: 'bg-primary-500/10' },
    { label: 'Revenue This Month', value: formatCurrency(revenueThisMonth), sub: `${invoices.filter((i) => i.status === 'PAID').length} paid invoices`, icon: IndianRupee, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Pending Invoices', value: String(pendingInvoices.length), sub: pendingInvoices.length ? `${formatCurrency(pendingTotal)} due` : 'None pending', icon: FileText, color: 'text-warning-400', bg: 'bg-warning-500/10' },
    { label: 'Open Support Tickets', value: String(openTickets.length), sub: openTickets.length ? 'Needs attention' : 'All resolved', icon: AlertCircle, color: 'text-slate-300', bg: 'bg-slate-500/10' },
  ];

  const QUICK = [
    { label: 'Create Vendor', icon: Plus, href: '/admin/customers' },
    { label: 'Call Enquiry', icon: Phone, href: '/admin/telecrm' },
    { label: 'Create Invoice', icon: FileText, href: '/admin/invoices' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Platform Overview</h2>
        <p className="mt-1 text-sm text-slate-400">Vendors, revenue, invoices and demo bookings at a glance.</p>
      </div>

      {error && <div className="rounded-xl border border-error-800 bg-error-950/50 px-4 py-3 text-sm text-error-400">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
      ) : (
        <>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-3">
            {QUICK.map((q) => {
              const Icon = q.icon;
              return (
                <Link key={q.label} href={q.href} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500">
                  <Icon className="h-4 w-4" />{q.label}
                </Link>
              );
            })}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg}`}><Icon className={`h-4 w-4 ${stat.color}`} /></div>
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{stat.label}</div>
                  <div className="mt-1 text-xs text-slate-600">{stat.sub}</div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent demo bookings */}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <h3 className="text-sm font-bold text-white">Recent Demo Bookings</h3>
                <Link href="/admin/leads" className="text-xs font-semibold text-primary-400 hover:text-primary-300">View all →</Link>
              </div>
              <div className="divide-y divide-slate-800">
                {leads.slice(0, 5).map((demo) => (
                  <div key={demo.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{demo.name}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">{demo.business} · {demo.industry}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{demo.interest}</div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <a href={`tel:${demo.phone}`} title="Call" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-primary-400"><Phone className="h-4 w-4" /></a>
                      <a href={`https://wa.me/${demo.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-success-400"><MessageCircle className="h-4 w-4" /></a>
                    </div>
                  </div>
                ))}
                {leads.length === 0 && <div className="px-5 py-8 text-center text-xs text-slate-600">Demo bookings will appear here as they come in.</div>}
              </div>
            </div>

            {/* Pending invoices */}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <h3 className="text-sm font-bold text-white">Pending Invoices</h3>
                <Link href="/admin/invoices" className="text-xs font-semibold text-primary-400 hover:text-primary-300">View all →</Link>
              </div>
              <div className="divide-y divide-slate-800">
                {pendingInvoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{inv.vendor?.businessName ?? inv.invoiceNumber}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{formatCurrency(inv.totalAmount)} · due {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</div>
                    </div>
                    <Link href="/admin/invoices" className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"><Send className="h-3.5 w-3.5" />Send Link</Link>
                  </div>
                ))}
                {pendingInvoices.length === 0 && <div className="px-5 py-8 text-center text-xs text-slate-600">No pending invoices. All caught up.</div>}
              </div>
              <div className="border-t border-slate-800 px-5 py-3">
                <Link href="/admin/invoices" className="flex items-center gap-1 text-xs font-medium text-primary-400 hover:text-primary-300">Manage invoices <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
