'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, Mail, Phone, CheckCircle2, Clock, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';

const customers = [
  {
    id: 'C001',
    name: 'Muthukumar R',
    business: 'MR Travels',
    email: 'client@mrtravels.com',
    phone: '+91 98765 43210',
    industry: 'Travel & Tours',
    plan: 'DomainApp Enterprise',
    status: 'active',
    website: 'https://mrtravels.get4domain.com',
    since: '15 Jan 2026',
    renewal: '15 Jan 2027',
    revenue: '₹24,999',
  },
];

export default function AdminCustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Customers</h2>
          <p className="mt-1 text-sm text-slate-400">{customers.length} active customer{customers.length !== 1 ? 's' : ''}.</p>
        </div>
      </div>

      <div className="space-y-4">
        {customers.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-base font-bold text-white">
                  {c.name.charAt(0)}
                </div>
                <div>
                  <div className="text-base font-bold text-white">{c.name}</div>
                  <div className="text-sm text-slate-400">{c.business} · {c.industry}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-success-500/20 px-3 py-1 text-xs font-semibold text-success-400 border border-success-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />Active
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-4 mb-5">
              {[
                { label: 'Plan',        value: c.plan },
                { label: 'Revenue',     value: c.revenue },
                { label: 'Since',       value: c.since },
                { label: 'Renewal',     value: c.renewal },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-800 px-3 py-2.5">
                  <div className="text-xs text-slate-500 mb-0.5">{item.label}</div>
                  <div className="text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a href={c.website} target="_blank" rel="noopener noreferrer">
                <Button size="sm" leftIcon={<Globe className="h-3.5 w-3.5" />} className="bg-primary-600 hover:bg-primary-700 text-white">
                  View Website
                </Button>
              </a>
              <a href={`mailto:${c.email}`}>
                <Button size="sm" leftIcon={<Mail className="h-3.5 w-3.5" />} className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600">
                  Email Client
                </Button>
              </a>
              <Link href="/admin/invoices">
                <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} variant="outline"
                  className="border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white">
                  View Invoices
                </Button>
              </Link>
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
          <Plus className="h-8 w-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">New customers appear here after they book a demo and subscribe.</p>
          <Link href="/admin/leads">
            <Button size="sm" variant="outline" className="mt-4 border-slate-700 text-slate-400 hover:border-primary-500 hover:text-primary-400">
              View Demo Bookings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
