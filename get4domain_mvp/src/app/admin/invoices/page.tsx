'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Send, Download, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  createdAt: string;
  dueDate: string | null;
  paidAt: string | null;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  vendor: { name: string; businessName: string };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PAID: { label: 'Paid', color: 'bg-success-500/20 text-success-400 border-success-500/30' },
  PENDING: { label: 'Pending', color: 'bg-warning-500/20 text-warning-400 border-warning-500/30' },
  OVERDUE: { label: 'Overdue', color: 'bg-error-500/20 text-error-400 border-error-500/30' },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const formatDate = (date: string | null): string =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);

  useEffect(() => {
    api.getInvoices()
      .then((res) => setInvoices(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoices'))
      .finally(() => setLoading(false));
  }, []);

  async function sendPaymentLink(id: string) {
    setSending(id);
    try {
      await api.sendPaymentLink(id);
      setSent((prev) => [...prev, id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send payment link');
    } finally {
      setSending(null);
    }
  }

  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);
  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Invoices</h2>
          <p className="mt-1 text-sm text-slate-400">All GST invoices and payment status.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error-800 bg-error-950/50 px-4 py-3 text-sm text-error-400">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Total Collected',   value: formatCurrency(totalPaid),    color: 'text-success-400' },
              { label: 'Pending Collection',value: formatCurrency(totalPending), color: 'text-warning-400' },
              { label: 'Total Invoices',    value: invoices.length.toString(),   color: 'text-white' },
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
                        <span className="text-base font-bold text-white">{inv.invoiceNumber}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="text-sm text-slate-400 mt-0.5">{inv.vendor.businessName} — {inv.vendor.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{formatCurrency(inv.totalAmount)}</div>
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
                      <div className="text-sm font-semibold text-white mt-0.5">{formatCurrency(inv.amount)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-800 px-3 py-2">
                      <div className="text-xs text-slate-500">GST (18%)</div>
                      <div className="text-sm font-semibold text-white mt-0.5">{formatCurrency(inv.gstAmount)}</div>
                    </div>
                    <div className="rounded-xl bg-slate-800 px-3 py-2">
                      <div className="text-xs text-slate-500">{inv.status === 'PAID' ? 'Paid On' : 'Due Date'}</div>
                      <div className="text-sm font-semibold text-white mt-0.5">{inv.status === 'PAID' ? formatDate(inv.paidAt) : formatDate(inv.dueDate)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {inv.status === 'PENDING' && (
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
                    {inv.status === 'PAID' && (
                      <Button size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}
                        className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                        onClick={() => window.open(`https://gapi.get4domain.com/invoices/${inv.id}/pdf`, '_blank')}>
                        View Invoice
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {invoices.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
                <p className="text-slate-500 text-sm">No invoices yet.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
