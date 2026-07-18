'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, Send, Download, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';

const invoices = [
  {
    id: 'INV-001', customer: 'MR Travels', name: 'Muthukumar R',
    description: 'DomainApp Enterprise — 1 Year',
    amount: 24999, gst: 4500, total: 29499,
    issued: '15 Jan 2026', due: '15 Jan 2026',
    status: 'paid' as const,
    paymentMethod: 'Razorpay — UPI',
    paidOn: '15 Jan 2026',
  },
  {
    id: 'INV-002', customer: 'MR Travels', name: 'Muthukumar R',
    description: 'DomainCampaign Business — 1 Year',
    amount: 29999, gst: 5400, total: 35399,
    issued: '18 Jan 2026', due: '25 Jan 2026',
    status: 'pending' as const,
    paymentMethod: null, paidOn: null,
  },
];

const statusConfig = {
  paid:    { label: 'Paid',    color: 'bg-success-500/20 text-success-400 border-success-500/30' },
  pending: { label: 'Pending', color: 'bg-warning-500/20 text-warning-400 border-warning-500/30' },
};

export default function AdminInvoicesPage() {
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);

  const sendPaymentLink = (id: string) => {
    setSending(id);
    setTimeout(() => {
      setSending(null);
      setSent(prev => [...prev, id]);
    }, 1200);
  };

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Invoices</h2>
          <p className="mt-1 text-sm text-slate-400">All GST invoices and payment status.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Collected',   value: `₹${totalPaid.toLocaleString('en-IN')}`,    color: 'text-success-400' },
          { label: 'Pending Collection',value: `₹${totalPending.toLocaleString('en-IN')}`, color: 'text-warning-400' },
          { label: 'Total Invoices',    value: invoices.length.toString(),                  color: 'text-white' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      <div className="space-y-4">
        {invoices.map((inv) => {
          const cfg = statusConfig[inv.status];
          const wasSent = sent.includes(inv.id);
          return (
            <div key={inv.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-white">{inv.id}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="text-sm text-slate-400 mt-0.5">{inv.customer} — {inv.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">₹{inv.total.toLocaleString('en-IN')}</div>
                  <div className="text-xs text-slate-500">incl. GST</div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-4 mb-4 text-sm">
                <div className="rounded-xl bg-slate-800 px-3 py-2">
                  <div className="text-xs text-slate-500">Description</div>
                  <div className="text-xs font-medium text-white mt-0.5">{inv.description}</div>
                </div>
                <div className="rounded-xl bg-slate-800 px-3 py-2">
                  <div className="text-xs text-slate-500">Subtotal</div>
                  <div className="text-sm font-semibold text-white mt-0.5">₹{inv.amount.toLocaleString('en-IN')}</div>
                </div>
                <div className="rounded-xl bg-slate-800 px-3 py-2">
                  <div className="text-xs text-slate-500">GST (18%)</div>
                  <div className="text-sm font-semibold text-white mt-0.5">₹{inv.gst.toLocaleString('en-IN')}</div>
                </div>
                <div className="rounded-xl bg-slate-800 px-3 py-2">
                  <div className="text-xs text-slate-500">{inv.status === 'paid' ? 'Paid On' : 'Due Date'}</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{inv.paidOn ?? inv.due}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {inv.status === 'pending' && (
                  wasSent ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-success-400">
                      <CheckCircle2 className="h-4 w-4" />Payment link sent to client
                    </span>
                  ) : (
                    <Button size="sm" loading={sending === inv.id}
                      onClick={() => sendPaymentLink(inv.id)}
                      leftIcon={<Send className="h-3.5 w-3.5" />}
                      className="bg-primary-600 hover:bg-primary-700 text-white">
                      Send Payment Link to Client
                    </Button>
                  )
                )}
                {inv.status === 'paid' && (
                  <Button size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}
                    className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                    onClick={() => alert('PDF download — Phase 2')}>
                    Download PDF
                  </Button>
                )}
                {inv.status === 'paid' && inv.paymentMethod && (
                  <span className="text-xs text-slate-500">via {inv.paymentMethod}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
