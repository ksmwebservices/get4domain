'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Printer, Wallet } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PayPanel from '@/components/vendor/PayPanel';
import { useAuth } from '@/lib/auth-context';
import {
  billingApi, vendorPayApi, rupees, fmtDate, CYCLE_LABEL, GST_LABEL, PLAN_LABEL,
  type Cycle, type InvoiceRow, type PlanKey, type VendorBilling,
} from '@/lib/commerce';

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Awaiting payment', PENDING: 'Awaiting payment', OVERDUE: 'Overdue', PAYMENT_SUBMITTED: 'Being confirmed',
  PARTIALLY_PAID: 'Part paid', PAID: 'Paid', VOID: 'Cancelled', EXPIRED: 'Expired', DRAFT: 'Draft',
};
const STATUS_CLS: Record<string, string> = {
  PAID: 'bg-success-100 text-success-700', OVERDUE: 'bg-error-50 text-error-700', PAYMENT_SUBMITTED: 'bg-primary-100 text-primary-700',
  VOID: 'bg-slate-100 text-slate-600', EXPIRED: 'bg-slate-100 text-slate-600',
};
const PAYABLE = ['SENT', 'PENDING', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID'];

/**
 * The vendor's commercial billing view (Commercial Engine v1): current plan & term, status banner, invoices with Pay,
 * and a plan-change request. Shown for any vendor that has a billing term; it reuses the same PayPanel as /pay/[token].
 */
export default function CommercialBilling({ data, onChanged }: { data: VendorBilling; onChanged: () => void }) {
  const { user } = useAuth();
  const term = data.term!;
  const [payFor, setPayFor] = useState<InvoiceRow | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [req, setReq] = useState({ toPlanKey: (term.planKey === 'BOS' ? 'WORKSPACE' : 'BOS') as PlanKey, toCycle: term.billingCycle as Cycle, customMonths: '3', effective: 'AT_RENEWAL' as 'AT_RENEWAL' | 'NOW', note: '' });
  const [reqBusy, setReqBusy] = useState(false);
  const [reqMsg, setReqMsg] = useState('');
  const [error, setError] = useState('');
  const payApi = useMemo(() => (payFor ? vendorPayApi(payFor.id) : null), [payFor]);

  // Deep link from the renewal reminder: /dashboard/billing?pay=<invoiceId>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('pay');
    if (id) { const inv = data.invoices.find((i) => i.id === id && PAYABLE.includes(i.status)); if (inv) setPayFor(inv); }
  }, [data.invoices]);

  const daysToEnd = term.periodEnd ? Math.ceil((new Date(term.periodEnd).getTime() - Date.now()) / 86_400_000) : null;
  const open = data.invoices.filter((i) => PAYABLE.includes(i.status));
  const nextDue = open.find((i) => i.kind === 'ACTIVATION' || i.kind === 'RENEWAL') ?? open[0];
  const pendingReq = data.planChangeRequests.find((r) => r.status === 'REQUESTED');
  const isDowngrade = term.planKey === 'BOS' && req.toPlanKey === 'WORKSPACE';

  const openPdf = useCallback(async (inv: InvoiceRow) => {
    try {
      const r = await billingApi.invoicePdf(inv.id);
      const w = window.open('', '_blank');
      if (w) { w.document.write(r.data.html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open the invoice'); }
  }, []);

  async function sendRequest() {
    setReqBusy(true); setError(''); setReqMsg('');
    try {
      await billingApi.requestChange({ toPlanKey: req.toPlanKey, toCycle: req.toCycle, customMonths: req.toCycle === 'CUSTOM_MONTHS' ? Number(req.customMonths) : undefined, effective: isDowngrade ? 'AT_RENEWAL' : req.effective, note: req.note.trim() || undefined });
      setReqOpen(false); setReqMsg('Request sent. Our team will review it and get back to you.'); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your request'); }
    finally { setReqBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* status banner */}
      {term.status === 'LAPSED' && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-error-200 bg-error-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error-600" />
          <div className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Your plan has lapsed.</span> Publishing, outbound messages and AI Studio spend are paused. Your data and login are safe — pay your pending invoice and everything resumes instantly.{nextDue && <div className="mt-3"><Button size="sm" onClick={() => setPayFor(nextDue)}>Pay {rupees(nextDue.balanceDuePaise)} now</Button></div>}</div>
        </div>
      )}
      {term.status === 'ACTIVE_PAYMENT_DUE' && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning-300 bg-warning-50 p-4">
          <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-600" />
          <div className="text-sm text-slate-700"><span className="font-semibold text-slate-900">All your features are on. Payment is due by {fmtDate(term.paymentDueAt)}.</span> After that you have {term.graceDays} grace day{term.graceDays === 1 ? '' : 's'} before the account is paused.{nextDue && <div className="mt-3"><Button size="sm" onClick={() => setPayFor(nextDue)}>Pay {rupees(nextDue.balanceDuePaise)}</Button></div>}</div>
        </div>
      )}
      {term.status === 'ACTIVE' && daysToEnd !== null && daysToEnd <= 15 && nextDue && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4">
          <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
          <div className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Your plan renews {daysToEnd <= 0 ? 'now' : `in ${daysToEnd} day${daysToEnd === 1 ? '' : 's'}`}.</span> Your renewal invoice is ready.<div className="mt-3"><Button size="sm" onClick={() => setPayFor(nextDue)}>Pay {rupees(nextDue.balanceDuePaise)}</Button></div></div>
        </div>
      )}
      {reqMsg && <div role="status" className="rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">{reqMsg}</div>}
      {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {/* current plan & term */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">DomainApp {PLAN_LABEL[term.planKey]}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{term.billingCycle === 'CUSTOM_MONTHS' ? `${term.cycleMonths}-month term` : `${CYCLE_LABEL[term.billingCycle]} billing`}{term.adminDeal ? ' · special terms' : ''}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${term.status === 'LAPSED' ? 'bg-error-50 text-error-700' : term.status === 'ACTIVE_PAYMENT_DUE' ? 'bg-warning-100 text-warning-800' : 'bg-success-100 text-success-700'}`}>{term.status === 'ACTIVE_PAYMENT_DUE' ? 'Payment due' : term.status === 'LAPSED' ? 'Lapsed' : 'Active'}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Amount per term</div><div className="mt-0.5 text-base font-bold text-slate-900">{rupees(term.netAmountPaise)}</div><div className="text-[11px] text-slate-500">{GST_LABEL[term.gstMode]}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Valid till</div><div className="mt-0.5 text-base font-bold text-slate-900">{fmtDate(term.periodEnd)}</div><div className="text-[11px] text-slate-500">{daysToEnd !== null && daysToEnd > 0 ? `${daysToEnd} days left` : 'Renewal due'}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Started</div><div className="mt-0.5 text-base font-bold text-slate-900">{fmtDate(term.periodStart)}</div></div>
        </div>
        {term.scheduledNextPlan && <p className="mt-3 rounded-xl bg-primary-50 px-3.5 py-2.5 text-xs text-slate-700">Scheduled: at renewal you move to <strong>{PLAN_LABEL[term.scheduledNextPlan]}{term.scheduledNextCycle ? ` · ${CYCLE_LABEL[term.scheduledNextCycle]}` : ''}</strong>.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {term.adminDeal ? <span className="text-xs text-slate-500">Your plan is on special terms. To change it, <Link href="/dashboard/support" className="font-semibold text-primary-600 hover:underline">contact us</Link> or send a request below.</span> : null}
          <Button size="sm" variant="outline" disabled={Boolean(pendingReq)} onClick={() => { setReqOpen(true); setReqMsg(''); }}>{pendingReq ? 'Change request pending' : 'Request plan / billing change'}</Button>
        </div>
      </div>

      {/* invoices */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-3 text-base font-bold text-slate-900">Invoices</h3>
        {data.invoices.length === 0 ? <p className="text-sm text-slate-500">No invoices yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr className="text-xs text-slate-500"><th className="py-2 pr-3 font-medium">Invoice</th><th className="pr-3 font-medium">For</th><th className="pr-3 font-medium">Total</th><th className="pr-3 font-medium">Status</th><th /></tr></thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.id} className="border-t border-slate-200">
                    <td className="py-3 pr-3"><div className="font-semibold text-slate-900">{i.invoiceNumber}</div><div className="text-xs text-slate-500">{fmtDate(i.createdAt)}</div></td>
                    <td className="pr-3 text-slate-600">{i.description}</td>
                    <td className="pr-3 font-semibold text-slate-900">{rupees(i.totalAmount)}{i.paidPaise > 0 && i.status !== 'PAID' && <div className="text-xs font-normal text-slate-500">due {rupees(i.balanceDuePaise)}</div>}</td>
                    <td className="pr-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[i.status] ?? 'bg-warning-100 text-warning-800'}`}>{STATUS_LABEL[i.status] ?? i.status}</span></td>
                    <td className="py-2 text-right"><div className="flex justify-end gap-2">
                      <button type="button" onClick={() => openPdf(i)} aria-label={`Print ${i.invoiceNumber}`} className="rounded-lg border border-slate-200 p-2 text-slate-600"><Printer className="h-4 w-4" /></button>
                      {PAYABLE.includes(i.status) && <Button size="sm" onClick={() => setPayFor(i)} leftIcon={<Wallet className="h-3.5 w-3.5" />}>Pay</Button>}
                      {i.status === 'PAID' && <CheckCircle2 className="h-5 w-5 text-success-500" aria-label="Paid" />}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(payFor)} onClose={() => { setPayFor(null); onChanged(); }} title={payFor ? `Pay ${payFor.invoiceNumber}` : ''} maxWidth="max-w-xl" skin="dark">
        {payApi ? <PayPanel api={payApi} payerName={user?.name} payerEmail={user?.email} onPaid={onChanged} /> : <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
      </Modal>

      <Modal isOpen={reqOpen} onClose={() => setReqOpen(false)} title="Request a plan or billing change" maxWidth="max-w-md" skin="dark">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Our team reviews every request. Downgrades start at your next renewal; upgrades can start sooner, with credit for unused days on your current term.</p>
          <label className="block text-xs font-semibold text-slate-500">Plan
            <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" value={req.toPlanKey} onChange={(e) => setReq({ ...req, toPlanKey: e.target.value as PlanKey })}><option value="WORKSPACE">Workspace</option><option value="BOS">BOS</option></select></label>
          <label className="block text-xs font-semibold text-slate-500">Billing cycle
            <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" value={req.toCycle} onChange={(e) => setReq({ ...req, toCycle: e.target.value as Cycle })}>{(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}</select></label>
          {req.toCycle === 'CUSTOM_MONTHS' && <label className="block text-xs font-semibold text-slate-500">Months (1–60)<input inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" value={req.customMonths} onChange={(e) => setReq({ ...req, customMonths: e.target.value.replace(/\D/g, '') })} /></label>}
          <label className="block text-xs font-semibold text-slate-500">When
            <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" value={isDowngrade ? 'AT_RENEWAL' : req.effective} disabled={isDowngrade} onChange={(e) => setReq({ ...req, effective: e.target.value as 'AT_RENEWAL' | 'NOW' })}><option value="AT_RENEWAL">At my next renewal</option><option value="NOW">As soon as possible</option></select></label>
          <label className="block text-xs font-semibold text-slate-500">Note (optional)<input maxLength={500} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" value={req.note} onChange={(e) => setReq({ ...req, note: e.target.value })} /></label>
          <div className="flex justify-end gap-2 pt-1"><Button size="sm" variant="outline" onClick={() => setReqOpen(false)}>Cancel</Button><Button size="sm" loading={reqBusy} onClick={sendRequest}>Send request</Button></div>
        </div>
      </Modal>
    </div>
  );
}
