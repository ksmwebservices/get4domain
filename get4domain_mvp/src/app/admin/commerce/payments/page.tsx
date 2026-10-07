'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ImageIcon, Loader2, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { commerceApi, rupees, fmtDate } from '@/lib/commerce';
import { ErrorBox, Field, Pill, cardCls, inputCls, msg, selectCls } from '@/components/admin/commerce-ui';

interface QueueRow {
  id: string; status: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED'; utr: string; claimedAmountPaise: number; confirmedAmountPaise: number | null;
  paidAt: string; payerNote: string | null; hasScreenshot: boolean; submittedAt: string; reviewedBy: string | null; reason: string | null;
  duplicateUtrAttempts: number; amountMismatch: boolean;
  invoice: { id: string; number: string; totalPaise: number; paidPaise: number; balanceDuePaise: number; status: string; description: string } | null;
  vendor: { id: string; businessName: string; name: string; email: string; phone: string | null } | null;
}

export default function PaymentsToConfirmPage() {
  const [status, setStatus] = useState<'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'ALL'>('SUBMITTED');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmFor, setConfirmFor] = useState<QueueRow | null>(null);
  const [received, setReceived] = useState('');
  const [note, setNote] = useState('');
  const [rejectFor, setRejectFor] = useState<QueueRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ url: string; title: string } | null>(null);
  const [outcome, setOutcome] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await commerceApi.listPayments(status); setRows((r.data ?? []) as QueueRow[]); setError(''); }
    catch (e) { setError(msg(e)); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (proof) URL.revokeObjectURL(proof.url); }, [proof]);

  const receivedPaise = Math.round(Number(received) * 100);
  const preview = (() => {
    if (!confirmFor?.invoice || !Number.isFinite(receivedPaise) || receivedPaise <= 0) return null;
    const due = confirmFor.invoice.balanceDuePaise;
    if (receivedPaise === due) return { tone: 'ok', text: `Exact match — the invoice is marked PAID and the plan is activated / renewed.` };
    if (receivedPaise < due) return { tone: 'warn', text: `Less than due — marks PART PAID. ${rupees(due - receivedPaise)} stays due; nothing is activated yet.` };
    return { tone: 'info', text: `More than due — marks PAID and records an overpayment of ${rupees(receivedPaise - due)} (no automatic refund).` };
  })();

  async function showProof(r: QueueRow) {
    try { const url = await commerceApi.proofBlobUrl(r.id); setProof({ url, title: `UTR …${r.utr.slice(-6)}` }); }
    catch (e) { setError(msg(e)); }
  }
  async function doConfirm() {
    if (!confirmFor) return;
    setBusy(true); setError('');
    try {
      const r = await commerceApi.confirmPayment(confirmFor.id, receivedPaise, note.trim() || undefined);
      setOutcome(`Confirmed. Invoice is now ${(r.data as { invoiceStatus?: string }).invoiceStatus ?? 'updated'}.`);
      setConfirmFor(null); setNote(''); await load();
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }
  async function doReject() {
    if (!rejectFor) return;
    setBusy(true); setError('');
    try { await commerceApi.rejectPayment(rejectFor.id, reason); setOutcome('Rejected — the payer has been notified with your reason.'); setRejectFor(null); setReason(''); await load(); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-400">UPI / bank-transfer payments wait here until you match the <strong className="text-slate-200">UTR and amount against the bank statement</strong>. Nothing is credited, activated or renewed until you confirm.</p>
        <div className="w-44"><Field label="Show"><select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="SUBMITTED">Waiting for me</option><option value="CONFIRMED">Confirmed</option><option value="REJECTED">Rejected</option><option value="ALL">All</option></select></Field></div>
      </div>
      <ErrorBox message={error} />
      {outcome && <div role="status" className="rounded-xl border border-success-500/30 bg-success-500/10 px-4 py-3 text-sm text-success-300">{outcome}</div>}

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div> : rows.length === 0 ? (
        <div className={`${cardCls} text-center text-sm text-slate-500`}>{status === 'SUBMITTED' ? 'Nothing waiting — you are all caught up.' : 'No payments in this view.'}</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className={cardCls}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold text-white">{r.utr}</span><Pill value={r.status} />
                    {r.duplicateUtrAttempts > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-error-500/40 bg-error-500/15 px-2 py-0.5 text-[11px] font-semibold text-error-300"><AlertTriangle className="h-3 w-3" />Duplicate UTR attempted ×{r.duplicateUtrAttempts}</span>}
                    {r.amountMismatch && r.status === 'SUBMITTED' && <span className="rounded-full border border-warning-500/40 bg-warning-500/15 px-2 py-0.5 text-[11px] font-semibold text-warning-300">Claimed ≠ balance due</span>}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">{r.vendor ? <Link className="hover:underline" href={`/admin/customers/${r.vendor.id}`}>{r.vendor.businessName}</Link> : '—'}{r.vendor?.phone ? ` · ${r.vendor.phone}` : ''}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{r.invoice ? `${r.invoice.number} · ${r.invoice.description}` : ''} · paid on {fmtDate(r.paidAt)} · submitted {fmtDate(r.submittedAt)}</div>
                  {r.payerNote && <div className="mt-1 text-xs italic text-slate-400">“{r.payerNote}”</div>}
                  {r.reason && <div className="mt-1 text-xs text-slate-400">Reason: {r.reason}{r.reviewedBy ? ` — ${r.reviewedBy}` : ''}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Payer claims</div><div className="text-lg font-bold text-white">{rupees(r.claimedAmountPaise)}</div>
                  {r.invoice && <div className="text-xs text-slate-400">balance due {rupees(r.invoice.balanceDuePaise)} of {rupees(r.invoice.totalPaise)}</div>}
                  {r.confirmedAmountPaise != null && <div className="text-xs text-success-400">received {rupees(r.confirmedAmountPaise)}</div>}
                </div>
              </div>
              {r.status === 'SUBMITTED' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => { setConfirmFor(r); setReceived(String(r.claimedAmountPaise / 100)); setNote(''); setOutcome(''); }} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>Confirm…</Button>
                  <Button size="sm" variant="outline" onClick={() => { setRejectFor(r); setReason(''); setOutcome(''); }} leftIcon={<XCircle className="h-3.5 w-3.5" />}>Reject…</Button>
                  {r.hasScreenshot && <Button size="sm" variant="outline" onClick={() => showProof(r)} leftIcon={<ImageIcon className="h-3.5 w-3.5" />}>View screenshot</Button>}
                </div>
              )}
              {r.status !== 'SUBMITTED' && r.hasScreenshot && <div className="mt-3"><Button size="sm" variant="outline" onClick={() => showProof(r)} leftIcon={<ImageIcon className="h-3.5 w-3.5" />}>View screenshot</Button></div>}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(confirmFor)} onClose={() => setConfirmFor(null)} title="Confirm payment" maxWidth="max-w-md" skin="dark">
        {confirmFor && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-800 p-3 text-sm text-slate-300">
              <div>UTR <span className="font-mono text-white">{confirmFor.utr}</span> · {confirmFor.vendor?.businessName}</div>
              <div className="text-xs text-slate-500">Invoice {confirmFor.invoice?.number} · balance due {rupees(confirmFor.invoice?.balanceDuePaise)}</div>
            </div>
            <Field label="Amount actually received in the bank (₹) *" hint="Use the bank statement figure, not what the payer claims."><input inputMode="decimal" className={inputCls} value={received} onChange={(e) => setReceived(e.target.value.replace(/[^0-9.]/g, ''))} autoFocus /></Field>
            {preview && <div role="status" className={`rounded-xl border px-3.5 py-2.5 text-sm ${preview.tone === 'ok' ? 'border-success-500/30 bg-success-500/10 text-success-300' : preview.tone === 'warn' ? 'border-warning-500/30 bg-warning-500/10 text-warning-300' : 'border-primary-500/30 bg-primary-500/10 text-primary-200'}`}>{preview.text}</div>}
            <Field label="Note (optional)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setConfirmFor(null)}>Cancel</Button><Button size="sm" loading={busy} disabled={!(receivedPaise > 0)} onClick={doConfirm}>Confirm {receivedPaise > 0 ? rupees(receivedPaise) : ''}</Button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(rejectFor)} onClose={() => setRejectFor(null)} title="Reject payment" maxWidth="max-w-md" skin="dark">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">The payer is told this reason by email / WhatsApp, and the invoice stays open.</p>
          <Field label="Reason *"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. UTR not found in our bank statement" autoFocus /></Field>
          <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button><Button size="sm" loading={busy} disabled={reason.trim().length < 3} onClick={doReject}>Reject</Button></div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(proof)} onClose={() => setProof(null)} title={`Screenshot — ${proof?.title ?? ''}`} maxWidth="max-w-lg" skin="dark">
        {proof && /* eslint-disable-next-line @next/next/no-img-element */ <img src={proof.url} alt="Payment screenshot submitted by the payer" className="mx-auto max-h-[70vh] rounded-lg" />}
      </Modal>
    </div>
  );
}
