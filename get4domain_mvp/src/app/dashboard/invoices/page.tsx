'use client';

import { Download, CheckCircle2, Clock, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

const invoices = [
  {
    id: 'INV-001',
    date: '15 Jan 2026',
    dueDate: '15 Jan 2026',
    description: 'DomainApp Enterprise — 1 Year',
    amount: 24999,
    gst: 4500,
    total: 29499,
    status: 'paid',
  },
  {
    id: 'INV-002',
    date: '18 Jan 2026',
    dueDate: '25 Jan 2026',
    description: 'DomainCampaign Business — 1 Year',
    amount: 29999,
    gst: 5400,
    total: 35399,
    status: 'pending',
  },
];

export default function InvoicesPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
        <p className="mt-1 text-sm text-slate-500">All GST-compliant invoices for your Get4Domain subscriptions.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="grid grid-cols-5 gap-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Invoice</span>
            <span className="col-span-2">Description</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Status</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {invoices.map((inv) => (
            <div key={inv.id} className="grid grid-cols-5 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
              <div>
                <div className="text-sm font-bold text-slate-900">{inv.id}</div>
                <div className="text-xs text-slate-400 mt-0.5">{inv.date}</div>
              </div>
              <div className="col-span-2">
                <div className="text-sm text-slate-700">{inv.description}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Subtotal ₹{inv.amount.toLocaleString('en-IN')} + GST ₹{inv.gst.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900">₹{inv.total.toLocaleString('en-IN')}</div>
              </div>
              <div className="text-right">
                {inv.status === 'paid' ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700">
                      <CheckCircle2 className="h-3 w-3" /> Paid
                    </span>
                    <button
                      onClick={() => alert('PDF download — Phase 2')}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <a href="/dashboard/billing">
                    <Button size="sm" leftIcon={<Clock className="h-3.5 w-3.5" />}>
                      Pay Now
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
        <FileText className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-slate-600">
          All invoices include GST breakdown and are valid for business tax filing. PDF download will be available once payment is confirmed. For invoice corrections, contact <a href="/dashboard/support" className="text-primary-600 font-semibold hover:underline">support</a>.
        </div>
      </div>
    </div>
  );
}
