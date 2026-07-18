'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

interface Ticket {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  adminReply: string | null;
  createdAt: string;
  vendor: { name: string; businessName: string };
}

const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminSupportPage() {
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  async function loadTickets() {
    try {
      const res = await api.getTickets();
      setTickets(res.data ?? []);
      setError('');
    } catch {
      setError('Could not load live data — showing what we have.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;
    loadTickets();
  }, [mounted]);

  async function sendReply(id: string) {
    const reply = replies[id]?.trim();
    if (!reply) return;
    setReplyingId(id);
    try {
      await api.replyTicket(id, reply);
      setReplies((prev) => ({ ...prev, [id]: '' }));
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setReplyingId(null);
    }
  }

  async function resolve(id: string) {
    setResolvingId(id);
    try {
      await api.resolveTicket(id);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve ticket');
    } finally {
      setResolvingId(null);
    }
  }

  const openTickets = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const statusConfig: Record<Ticket['status'], { label: string; color: string }> = {
    OPEN: { label: 'Open', color: 'bg-warning-500/20 text-warning-400 border-warning-500/30' },
    IN_PROGRESS: { label: 'Replied', color: 'bg-primary-500/20 text-primary-400 border-primary-500/30' },
    RESOLVED: { label: 'Resolved', color: 'bg-success-500/20 text-success-400 border-success-500/30' },
    CLOSED: { label: 'Closed', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Support Tickets</h2>
        <p className="mt-1 text-sm text-slate-400">{openTickets.length} open ticket{openTickets.length !== 1 ? 's' : ''}.</p>
      </div>

      {error && <div className="rounded-xl border border-error-800 bg-error-950/50 px-4 py-3 text-sm text-error-400">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-success-500 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">No tickets yet</p>
          <p className="text-slate-600 text-sm mt-1">New tickets will appear here when clients raise them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const cfg = statusConfig[ticket.status];
            const isOpen = ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS';
            return (
              <div key={ticket.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-500">{ticket.category}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{ticket.vendor.businessName} · {ticket.vendor.name}</div>
                    <div className="text-base font-semibold text-white mt-2">{ticket.subject}</div>
                    <div className="mt-2 rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-slate-300">{ticket.message}</div>
                    {ticket.adminReply && (
                      <div className="mt-2 rounded-xl bg-primary-950/40 border border-primary-900 px-3 py-2.5 text-sm text-primary-200">
                        <span className="text-xs font-semibold text-primary-400 block mb-1">Your reply</span>
                        {ticket.adminReply}
                      </div>
                    )}
                    <div className="text-xs text-slate-600 mt-2">{formatDate(ticket.createdAt)}</div>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-3">
                    <textarea
                      rows={2}
                      placeholder="Type your reply to the client..."
                      value={replies[ticket.id] ?? ''}
                      onChange={(e) => setReplies((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                      className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-primary-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" loading={replyingId === ticket.id} leftIcon={<MessageCircle className="h-3.5 w-3.5" />}
                        className="bg-primary-600 hover:bg-primary-700 text-white" onClick={() => sendReply(ticket.id)}>
                        Send Reply
                      </Button>
                      <Button size="sm" loading={resolvingId === ticket.id} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        className="bg-success-600 hover:bg-success-700 text-white" onClick={() => resolve(ticket.id)}>
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
