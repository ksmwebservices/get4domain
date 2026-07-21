'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Megaphone, Wallet, Plus, UserPlus, HelpCircle, ArrowRight,
  Bell, Clock, Phone, Loader2, CalendarClock,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface CrmLead {
  id: string;
  name: string;
  phone: string;
  source: string | null;
  status: string;
  createdAt: string;
  followUpDate: string | null;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface Campaign {
  id: string;
  status: string;
}

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function DashboardHome() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [followups, setFollowups] = useState<CrmLead[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([
      api.getCrmLeads(),
      api.getNotifications(),
      api.getTelecrmFollowups(),
      api.getWalletBalance(),
      api.getCampaigns(),
    ])
      .then(([leadsRes, notifRes, followupsRes, walletRes, campaignsRes]) => {
        if (cancelled) return;
        setLeads(leadsRes.data ?? []);
        setNotifications(notifRes.data ?? []);
        setFollowups(followupsRes.data ?? []);
        setWalletBalance(walletRes.data?.balance ?? 0);
        const campaigns = (campaignsRes.data ?? []) as Campaign[];
        setActiveCampaigns(campaigns.filter((c) => c.status === 'approved' || c.status === 'running').length);
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const leadsToday = leads.filter((l) => new Date(l.createdAt) >= today).length;
  const recentLeads = leads.slice(0, 5);
  const recentNotifications = notifications.slice(0, 3);
  const upcomingFollowups = followups.slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{greeting}, {firstName} 👋</h2>
        <p className="mt-1 text-sm text-slate-500">
          {user?.businessName ?? 'Your business'}{user?.industry ? ` · ${user.industry.replace('-', ' & ')}` : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users, label: 'Leads Today', value: String(leadsToday), color: 'text-primary-600', bg: 'bg-primary-50' },
          { icon: Megaphone, label: 'Active Campaigns', value: String(activeCampaigns), color: 'text-secondary-600', bg: 'bg-secondary-50' },
          { icon: Wallet, label: 'Wallet Balance', value: walletBalance !== null ? formatCurrency(walletBalance) : '—', color: 'text-success-600', bg: 'bg-success-50' },
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

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/campaigns"><Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>Create Campaign</Button></Link>
        <Link href="/dashboard/crm"><Button size="sm" variant="outline" leftIcon={<UserPlus className="h-3.5 w-3.5" />}>Add Lead</Button></Link>
        <Link href="/dashboard/support"><Button size="sm" variant="outline" leftIcon={<HelpCircle className="h-3.5 w-3.5" />}>Get Support</Button></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent leads */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Recent Leads</h3>
            <Link href="/dashboard/crm" className="text-xs font-semibold text-primary-600 hover:underline">View all</Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No leads yet.</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{lead.name}</div>
                    <div className="text-xs text-slate-500">{lead.phone} · {lead.source ?? 'manual'}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 capitalize">{lead.status}</span>
                    <a href={`tel:${lead.phone}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-primary-600">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent notifications */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Notifications</h3>
            <Link href="/dashboard/notifications" className="text-xs font-semibold text-primary-600 hover:underline">View all</Link>
          </div>
          {recentNotifications.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No new notifications.</p>
          ) : (
            <div className="space-y-3">
              {recentNotifications.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 rounded-xl p-3 ${n.read ? 'bg-slate-50' : 'bg-primary-50'}`}>
                  <Bell className={`h-4 w-4 mt-0.5 flex-shrink-0 ${n.read ? 'text-slate-400' : 'text-primary-600'}`} />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-700 truncate">{n.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming follow-ups */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Upcoming Follow-ups</h3>
          <Link href="/dashboard/telecrm" className="text-xs font-semibold text-primary-600 hover:underline">View all</Link>
        </div>
        {upcomingFollowups.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No follow-ups scheduled.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {upcomingFollowups.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-1.5 text-xs text-warning-700 font-semibold">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-slate-900 truncate">{lead.name}</div>
                <div className="text-xs text-slate-500">{lead.phone}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-primary-100 bg-primary-50 p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-slate-900">Need help or want to request changes?</div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />We respond within 24 hours on WhatsApp and email.</div>
        </div>
        <Link href="/dashboard/support">
          <Button size="sm" variant="outline" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Get Support</Button>
        </Link>
      </div>
    </div>
  );
}
