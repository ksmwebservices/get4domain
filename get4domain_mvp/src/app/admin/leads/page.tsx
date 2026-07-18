'use client';

import { useState } from 'react';
import { Phone, MessageCircle, Check, Clock, User, Building2, Tag, Calendar } from 'lucide-react';
import Button from '@/components/ui/Button';

const initialLeads = [
  { id: 'D001', name: 'Ravi Kumar',    phone: '+91 98765 11111', business: 'Spice Garden',    industry: 'Restaurant',  interest: 'DomainApp Startup',    message: 'Interested in digital menu and ordering', date: '18 Jan 2026', status: 'pending' as const },
  { id: 'D002', name: 'Priya Sharma',  phone: '+91 98765 22222', business: 'Himalayan Tours', industry: 'Travel',      interest: 'DomainApp Enterprise', message: 'Want to see tour package management',       date: '17 Jan 2026', status: 'called'  as const },
  { id: 'D003', name: 'Anil Mehta',    phone: '+91 98765 33333', business: 'CareWell Clinic', industry: 'Healthcare',  interest: 'DomainApp Startup',    message: 'Need appointment booking system',           date: '16 Jan 2026', status: 'pending' as const },
  { id: 'D004', name: 'Suresh Patel',  phone: '+91 98765 44444', business: 'BuildRight Infra',industry: 'Construction',interest: 'DomainCampaign Business', message: 'Want managed social media',              date: '15 Jan 2026', status: 'converted' as const },
];

type Status = 'pending' | 'called' | 'converted';

const statusConfig: Record<Status, { label: string; color: string }> = {
  pending:   { label: 'Pending Call',  color: 'bg-warning-500/20 text-warning-400 border-warning-500/30' },
  called:    { label: 'Called',        color: 'bg-primary-500/20 text-primary-400 border-primary-500/30' },
  converted: { label: 'Converted',     color: 'bg-success-500/20 text-success-400 border-success-500/30' },
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<Status | 'all'>('all');

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  const updateStatus = (id: string, status: Status) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Demo Bookings</h2>
        <p className="mt-1 text-sm text-slate-400">All consultation requests from the Book a Demo form.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'called', 'converted'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all capitalize ${filter === f ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
            {f === 'all' ? `All (${leads.length})` : `${f} (${leads.filter(l => l.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Leads list */}
      <div className="space-y-4">
        {filtered.map((lead) => (
          <div key={lead.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-white">
                  {lead.name.charAt(0)}
                </div>
                <div>
                  <div className="text-base font-bold text-white">{lead.name}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{lead.business}</span>
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{lead.industry}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{lead.date}</span>
                  </div>
                </div>
              </div>
              <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig[lead.status].color}`}>
                {statusConfig[lead.status].label}
              </span>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-800 px-3 py-2">
                <div className="text-xs text-slate-500 mb-0.5">Interested In</div>
                <div className="text-sm font-semibold text-white">{lead.interest}</div>
              </div>
              <div className="rounded-xl bg-slate-800 px-3 py-2">
                <div className="text-xs text-slate-500 mb-0.5">Phone</div>
                <div className="text-sm font-semibold text-white">{lead.phone}</div>
              </div>
            </div>

            {lead.message && (
              <div className="mb-4 rounded-xl bg-slate-800/50 px-3 py-2 border border-slate-700">
                <div className="text-xs text-slate-500 mb-0.5">Their Message</div>
                <div className="text-sm text-slate-300">{lead.message}</div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <a href={`tel:${lead.phone}`}>
                <Button size="sm" leftIcon={<Phone className="h-3.5 w-3.5" />} className="bg-primary-600 hover:bg-primary-700 text-white">
                  Call Now
                </Button>
              </a>
              <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" leftIcon={<MessageCircle className="h-3.5 w-3.5" />} className="bg-success-600 hover:bg-success-700 text-white">
                  WhatsApp
                </Button>
              </a>
              {lead.status === 'pending' && (
                <Button size="sm" variant="outline" leftIcon={<Clock className="h-3.5 w-3.5" />}
                  className="border-slate-700 text-slate-300 hover:border-primary-500 hover:text-primary-400"
                  onClick={() => updateStatus(lead.id, 'called')}>
                  Mark as Called
                </Button>
              )}
              {lead.status === 'called' && (
                <Button size="sm" variant="outline" leftIcon={<Check className="h-3.5 w-3.5" />}
                  className="border-slate-700 text-slate-300 hover:border-success-500 hover:text-success-400"
                  onClick={() => updateStatus(lead.id, 'converted')}>
                  Mark Converted
                </Button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
            <p className="text-slate-500">No bookings in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
