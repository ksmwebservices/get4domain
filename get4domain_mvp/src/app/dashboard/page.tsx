'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Globe, Megaphone, CreditCard, FileText, Bell, ArrowRight,
  CheckCircle2, Clock, ExternalLink, CalendarCheck, Zap, BarChart3, Users, Loader2
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface VendorCms {
  businessName: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  description: string;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  createdAt: string;
  dueDate: string | null;
}

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function DashboardHome() {
  const { user } = useAuth();
  const [cms, setCms] = useState<VendorCms | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([api.getVendorCMS(user.id), api.getVendorInvoices(user.id)])
      .then(([cmsRes, invoicesRes]) => {
        if (cancelled) return;
        setCms(cmsRes.data ?? null);
        setInvoices(invoicesRes.data ?? []);
      })
      .catch(() => {
        // Non-fatal — dashboard still renders with whatever loaded
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const pendingInvoices = invoices.filter(i => i.status === 'PENDING');
  const recentInvoices = invoices.slice(0, 3);
  const websiteLabel = cms?.businessName ?? user?.businessName ?? 'Your website';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{greeting}, {firstName} 👋</h2>
        <p className="mt-1 text-sm text-slate-500">Here&apos;s your Get4Domain account overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Globe,    label: 'Website',      value: websiteLabel,   color: 'text-success-600',   bg: 'bg-success-50' },
          { icon: Users,    label: 'Active Plan',  value: user?.plan ?? 'Startup', color: 'text-primary-600', bg: 'bg-primary-50' },
          { icon: FileText, label: 'Pending Invoices', value: String(pendingInvoices.length), color: 'text-warning-600', bg: 'bg-warning-50' },
          { icon: Zap,      label: 'Modules',      value: '5 Active',      color: 'text-secondary-600', bg: 'bg-secondary-50' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div className="text-lg font-bold text-slate-900 truncate">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* DomainApp */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">DomainApp</div>
                <div className="text-xs text-slate-500">{user?.plan ?? 'Startup'} Plan</div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />Active
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {['Website', 'Fleet CRM', 'Invoicing', 'Trip Sheets', 'Reports'].map((m) => (
              <span key={m} className="flex items-center gap-1 rounded-lg bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                <CheckCircle2 className="h-3 w-3" />{m}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/domain-app" className="flex-1">
              <Button size="sm" fullWidth rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Manage</Button>
            </Link>
          </div>
        </div>

        {/* DomainCampaign upsell */}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200">
                <Megaphone className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-700">DomainCampaign</div>
                <div className="text-xs text-slate-400">Not subscribed</div>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Inactive</span>
          </div>
          <div className="mb-5 space-y-2">
            {['120 social posts / month', 'SEO management', 'Google Business Profile', 'Campaign reports'].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 flex-shrink-0" />{f}
              </div>
            ))}
          </div>
          <Link href="/dashboard/domain-campaign">
            <Button size="sm" fullWidth leftIcon={<CalendarCheck className="h-3.5 w-3.5" />}>Add DomainCampaign</Button>
          </Link>
        </div>
      </div>

      {/* Invoices + Notifications */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Recent Invoices</h3>
            <Link href="/dashboard/invoices" className="text-xs font-semibold text-primary-600 hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : recentInvoices.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className={`flex items-center justify-between rounded-xl p-3 ${inv.status === 'PENDING' ? 'bg-warning-50 border border-warning-100' : 'bg-slate-50'}`}>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{inv.invoiceNumber}</div>
                    <div className="text-xs text-slate-500">{inv.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{formatCurrency(inv.totalAmount)}</div>
                    {inv.status === 'PAID' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700">
                        <CheckCircle2 className="h-3 w-3" />Paid
                      </span>
                    ) : (
                      <Link href="/dashboard/billing">
                        <span className="text-xs font-semibold text-warning-700 hover:underline cursor-pointer flex items-center gap-1">
                          <Clock className="h-3 w-3" />Pay Now
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Notifications</h3>
            <Link href="/dashboard/notifications" className="text-xs font-semibold text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {pendingInvoices.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl p-3 bg-warning-50">
                <Bell className="h-4 w-4 mt-0.5 flex-shrink-0 text-warning-600" />
                <div>
                  <div className="text-sm text-slate-700">
                    {pendingInvoices.length} invoice{pendingInvoices.length > 1 ? 's' : ''} pending payment
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Now</div>
                </div>
              </div>
            )}
            {pendingInvoices.length === 0 && !loading && (
              <p className="text-sm text-slate-400">No new notifications.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-primary-50 p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-slate-900">Need help or want to request changes?</div>
          <div className="text-xs text-slate-500 mt-0.5">We respond within 24 hours on WhatsApp and email.</div>
        </div>
        <Link href="/dashboard/support">
          <Button size="sm" variant="outline" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Get Support</Button>
        </Link>
      </div>
    </div>
  );
}
