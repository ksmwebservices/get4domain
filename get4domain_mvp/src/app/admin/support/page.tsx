'use client';

import { useState } from 'react';
import { MessageCircle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

type TicketStatus = 'open' | 'resolved';
interface Ticket {
  id: string; customer: string; name: string; category: string;
  subject: string; message: string; date: string; status: TicketStatus;
}

const tickets: Ticket[] = [
  { id: 'TKT-001', customer: 'MR Travels', name: 'Muthukumar R', category: 'Website Changes', subject: 'Add new tour package to homepage', message: 'Please add our new Ooty tour package with 3N/4D itinerary to the homepage slider.', date: '18 Jan 2026', status: 'open' },
];

export default function AdminSupportPage() {
  const [tickets_state, setTickets] = useState<Ticket[]>(tickets);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const resolve = (id: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'resolved' as const } : t));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Support Tickets</h2>
        <p className="mt-1 text-sm text-slate-400">{tickets_state.filter(t => t.status === 'open').length} open tickets.</p>
      </div>

      <div className="space-y-4">
        {tickets_state.map((ticket) => (
          <div key={ticket.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{ticket.id}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ticket.status === 'open' ? 'bg-warning-500/20 text-warning-400 border-warning-500/30' : 'bg-success-500/20 text-success-400 border-success-500/30'}`}>
                    {ticket.status === 'open' ? 'Open' : 'Resolved'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">{ticket.customer} · {ticket.name} · {ticket.category}</div>
                <div className="text-base font-semibold text-white mt-2">{ticket.subject}</div>
                <div className="mt-2 rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-slate-300">{ticket.message}</div>
                <div className="text-xs text-slate-600 mt-2">{ticket.date}</div>
              </div>
            </div>

            {ticket.status === 'open' && (
              <div className="space-y-3">
                <textarea
                  rows={2}
                  placeholder="Type your reply to the client..."
                  value={replies[ticket.id] ?? ''}
                  onChange={(e) => setReplies(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-primary-500 focus:outline-none resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" leftIcon={<MessageCircle className="h-3.5 w-3.5" />}
                    className="bg-primary-600 hover:bg-primary-700 text-white">
                    Send Reply
                  </Button>
                  <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    onClick={() => resolve(ticket.id)}
                    className="bg-success-600 hover:bg-success-700 text-white">
                    Mark Resolved
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {tickets_state.length === 0 || tickets_state.every(t => t.status === 'resolved') ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-success-500 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold">All tickets resolved</p>
            <p className="text-slate-600 text-sm mt-1">New tickets will appear here when clients raise them.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
