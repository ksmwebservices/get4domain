'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Invoice {
  id: string;
  invoiceNumber: string;
  description: string;
  amount: number;      // taxable, paise
  gstAmount: number;   // paise
  totalAmount: number; // paise
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
  createdAt: string;
  paidAt: string | null;
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    api.getVendorInvoices(user.id)
      .then((res) => setInvoices(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load invoices'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Fetch the invoice HTML and open a print-to-PDF window (same pattern as the
  // AI Studio document generators — no extra PDF library needed).
  const download = async (inv: Invoice) => {
    setDownloading(inv.id);
    try {
      const res = await api.getInvoicePdf(inv.id);
      const html = res.data?.html as string | undefined;
      if (!html) throw new Error('Invoice PDF is not ready yet.');
      const w = window.open('', '_blank', 'width=820,height=1000');
      if (!w) { setError('Please allow pop-ups to download the invoice.'); return; }
      w.document.write(`<!doctype html><html><head><title>${inv.invoiceNumber}</title><style>@media print{body{margin:0}}body{margin:24px;background:#fff}</style></head><body>${html}<script>window.onload=function(){window.print();}</script></body></html>`);
      w.document.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the invoice PDF.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
        <p className="mt-1 text-sm text-slate-500">All GST-compliant invoices for your Get4Domain subscription &amp; wallet top-ups.</p>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No invoices yet. Your subscription and wallet top-up invoices will appear here automatically.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 hidden sm:block">
            <div className="grid grid-cols-5 gap-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Invoice</span>
              <span className="col-span-2">Description</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Status</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <div key={inv.id} className="grid grid-cols-2 gap-3 px-6 py-4 sm:grid-cols-5 sm:gap-4 sm:items-center hover:bg-slate-50 transition-colors">
                <div>
                  <div className="text-sm font-bold text-slate-900">{inv.invoiceNumber}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{fmtDate(inv.createdAt)}</div>
                </div>
                <div className="col-span-2 hidden sm:block">
                  <div className="text-sm text-slate-700">{inv.description}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Taxable {inr(inv.amount)} + GST {inr(inv.gstAmount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">{inr(inv.totalAmount)}</div>
                </div>
                <div className="text-right">
                  {inv.status === 'PAID' ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700">
                        <CheckCircle2 className="h-3 w-3" /> Paid
                      </span>
                      <button
                        onClick={() => download(inv)}
                        disabled={downloading === inv.id}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600 transition-colors disabled:opacity-50"
                        title="Download PDF"
                      >
                        {downloading === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : (
                    <a href="/dashboard/billing">
                      <Button size="sm" leftIcon={<Clock className="h-3.5 w-3.5" />}>Pay Now</Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
        <FileText className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-slate-600">
          All invoices include a GST breakdown and are valid for business tax filing. Paid invoices are emailed to you automatically and can be downloaded here. For corrections, contact <a href="/dashboard/support" className="text-primary-600 font-semibold hover:underline">support</a>.
        </div>
      </div>
    </div>
  );
}
