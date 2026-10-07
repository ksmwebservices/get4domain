'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Copy, CreditCard, Landmark, Loader2, QrCode, Shield, Smartphone, Tag, Upload, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { type PayApi, type PayView, type UpiPayload, GST_LABEL, fmtDate, rupees } from '@/lib/commerce';

/**
 * The payment experience for ONE invoice — used by the public /pay/[token] page and the vendor dashboard.
 * Every amount shown (and paid) comes from the server's view of the invoice; nothing here ever sends an amount.
 */

type Method = 'RAZORPAY' | 'UPI' | 'BANK';

interface RzpResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RzpOptions { key: string; amount: number; currency: string; order_id: string; name: string; description: string; prefill?: { name?: string; email?: string }; handler: (r: RzpResponse) => void; modal: { ondismiss: () => void }; theme?: { color: string } }
type RzpCtor = new (o: RzpOptions) => { open: () => void };
const rzpCtor = (): RzpCtor | undefined => (window as unknown as { Razorpay?: RzpCtor }).Razorpay;

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (rzpCtor()) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection and try again.'));
    document.body.appendChild(s);
  });
}

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  SENT: { label: 'Awaiting payment', cls: 'bg-warning-100 text-warning-800' },
  PENDING: { label: 'Awaiting payment', cls: 'bg-warning-100 text-warning-800' },
  OVERDUE: { label: 'Overdue', cls: 'bg-error-50 text-error-700' },
  PAYMENT_SUBMITTED: { label: 'Payment being confirmed', cls: 'bg-primary-100 text-primary-700' },
  PARTIALLY_PAID: { label: 'Part paid', cls: 'bg-warning-100 text-warning-800' },
  PAID: { label: 'Paid', cls: 'bg-success-100 text-success-700' },
  VOID: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600' },
  EXPIRED: { label: 'Expired', cls: 'bg-slate-100 text-slate-600' },
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="truncate text-sm font-semibold text-slate-900">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => undefined); }}
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function PayPanel({ api, payerName, payerEmail, onPaid }: { api: PayApi; payerName?: string; payerEmail?: string; onPaid?: () => void }) {
  const [view, setView] = useState<PayView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [upi, setUpi] = useState<UpiPayload | null>(null);
  const [promo, setPromo] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [showProof, setShowProof] = useState(false);
  const [proof, setProof] = useState({ utr: '', amount: '', paidAt: new Date().toISOString().slice(0, 10), note: '' });
  const [file, setFile] = useState<File | null>(null);
  const [proofDone, setProofDone] = useState(false);

  const refresh = useCallback(async () => {
    try { const v = await api.view(); setView(v); setLoadError(''); return v; }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load this invoice.'); return null; }
  }, [api]);

  useEffect(() => { void refresh(); }, [refresh]);

  const methods = useMemo<Method[]>(() => {
    if (!view) return [];
    const m: Method[] = [];
    if (view.channels.razorpay) m.push('RAZORPAY');
    if (view.channels.upiQr) m.push('UPI');
    if (view.channels.offline || (view.channels.upiQr && view.payee?.bank)) m.push('BANK');
    return m;
  }, [view]);

  useEffect(() => { if (!method && methods.length) setMethod(methods[0]); }, [methods, method]);

  useEffect(() => {
    if (!view || method !== 'UPI' || upi) return;
    api.upi().then(setUpi).catch((e) => setError(e instanceof Error ? e.message : 'Could not build the UPI QR.'));
  }, [method, view, upi, api]);

  // Reset the cached QR when the balance changes (promo applied / part payment confirmed).
  useEffect(() => { setUpi(null); }, [view?.invoice.balanceDuePaise]);
  useEffect(() => { if (view) setProof((p) => ({ ...p, amount: p.amount || String(view.invoice.balanceDuePaise / 100) })); }, [view]);

  if (loadError && !view) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-6 text-center">
        <XCircle className="mx-auto h-8 w-8 text-error-600" />
        <p className="mt-3 text-sm font-semibold text-error-700">{loadError}</p>
        <p className="mt-1 text-xs text-slate-500">If you think this is a mistake, contact the team that sent you this invoice.</p>
      </div>
    );
  }
  if (!view) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  const inv = view.invoice;
  const pill = STATUS_PILL[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
  const payable = ['SENT', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID', 'PAYMENT_SUBMITTED'].includes(inv.status);

  async function payRazorpay() {
    if (!view) return;
    setError(''); setBusy(true);
    try {
      await loadRazorpay();
      const order = await api.razorpayOrder();
      const Rzp = rzpCtor();
      const key = order.keyId || view.razorpayKeyId;
      if (!Rzp || !key) throw new Error('Card / UPI checkout is not available right now. Please use another method.');
      const rzp = new Rzp({
        key, amount: order.amount, currency: order.currency, order_id: order.orderId, name: 'Get4Domain', description: view.invoice.description,
        prefill: { name: payerName, email: payerEmail }, theme: { color: '#2563eb' },
        handler: async (r) => {
          try {
            await api.razorpayVerify({ razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature });
            await refresh();
            onPaid?.();
          } catch (e) { setError(e instanceof Error ? e.message : 'Payment verification failed. If money was deducted, it will be reconciled — contact us.'); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the payment.'); setBusy(false); }
  }

  async function applyPromo() {
    setPromoMsg(''); setError(''); setBusy(true);
    try { const r = await api.applyPromo(promo); setPromoMsg(`Code applied — you save ${rupees(r.discountPaise)}.`); setPromo(''); await refresh(); }
    catch (e) { setPromoMsg(e instanceof Error ? e.message : 'That code could not be applied.'); }
    finally { setBusy(false); }
  }
  async function removePromo() { setBusy(true); try { await api.removePromo(); setPromoMsg(''); await refresh(); } catch (e) { setPromoMsg(e instanceof Error ? e.message : 'Could not remove the code.'); } finally { setBusy(false); } }

  async function submitProof(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (file && file.size > 3 * 1024 * 1024) { setError('The screenshot is larger than 3 MB. Please choose a smaller image.'); return; }
    if (file && !/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('The screenshot must be a JPG, PNG or WebP image.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('utr', proof.utr.trim());
      fd.append('amount', proof.amount);
      fd.append('paidAt', new Date(`${proof.paidAt}T12:00:00`).toISOString());
      if (proof.note.trim()) fd.append('note', proof.note.trim());
      if (file) fd.append('file', file);
      await api.submitProof(fd);
      setProofDone(true); setShowProof(false); setFile(null);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit your payment details.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      {/* summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice {inv.number}</div>
            <div className="mt-1 text-base font-bold text-slate-900">{inv.description}</div>
            <div className="mt-0.5 text-sm text-slate-500">For {view.business.name}</div>
          </div>
          <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${pill.cls}`}>{pill.label}</span>
        </div>

        <div className="mt-4 space-y-2.5 rounded-xl bg-slate-50 p-4">
          {inv.lines.map((l, i) => (
            <div key={`${l.label}-${i}`} className="flex justify-between gap-3 text-sm">
              <span className="text-slate-600">{l.label}{(l.qty ?? 1) > 1 ? ` × ${l.qty}` : ''}</span>
              <span className={l.kind === 'CREDIT' ? 'font-medium text-success-700' : 'font-medium text-slate-900'}>{rupees(l.amountPaise * (l.qty ?? 1))}</span>
            </div>
          ))}
          {inv.discountPaise > 0 && (
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-success-700">Discount{inv.promoCode ? ` (${inv.promoCode})` : ''}</span>
              <span className="font-medium text-success-700">− {rupees(inv.discountPaise)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-2.5 text-sm">
            <span className="text-slate-500">{inv.gstMode === 'INCLUSIVE' ? 'Taxable value' : 'Amount'}</span>
            <span className="text-slate-900">{rupees(inv.taxablePaise)}</span>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-slate-500">{inv.gstMode === 'NONE' ? 'GST' : inv.gstMode === 'INCLUSIVE' ? 'GST (included, 18%)' : 'GST (18%)'}</span>
            <span className="text-slate-900">{inv.gstMode === 'NONE' ? 'Not charged' : rupees(inv.gstPaise)}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-2.5">
            <span className="text-sm font-bold text-slate-900">Total</span>
            <span className="text-xl font-bold text-slate-900">{rupees(inv.totalPaise)}</span>
          </div>
          {inv.paidPaise > 0 && inv.status !== 'PAID' && (
            <>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Paid so far</span><span className="text-success-700">{rupees(inv.paidPaise)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-slate-900">Balance due</span><span className="text-slate-900">{rupees(inv.balanceDuePaise)}</span></div>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">{GST_LABEL[inv.gstMode]}{inv.periodStart && inv.periodEnd ? ` · Service period ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}` : ''}{inv.dueDate && payable ? ` · Due ${fmtDate(inv.dueDate)}` : ''}</p>
      </div>

      {/* paid */}
      {inv.status === 'PAID' && (
        <div className="rounded-2xl border border-success-100 bg-success-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success-600" />
          <h3 className="mt-3 text-lg font-bold text-slate-900">Payment received — thank you!</h3>
          <p className="mt-1 text-sm text-slate-600">{inv.paidAt ? `Paid on ${fmtDate(inv.paidAt)}. ` : ''}A receipt has been sent to your email.</p>
          {inv.overpaymentPaise > 0 && <p className="mt-2 text-xs text-slate-600">You paid {rupees(inv.overpaymentPaise)} more than invoiced; we will adjust it against your next invoice.</p>}
        </div>
      )}

      {payable && (
        <>
          {/* submission status */}
          {view.submission?.status === 'SUBMITTED' && (
            <div className="flex items-start gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4">
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
              <div className="text-sm text-slate-700"><span className="font-semibold text-slate-900">We have your payment details</span> (UTR ending {view.submission.utrTail}). We will confirm it shortly and update this page.</div>
            </div>
          )}
          {view.submission?.status === 'REJECTED' && !proofDone && (
            <div className="flex items-start gap-3 rounded-2xl border border-error-200 bg-error-50 p-4">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error-600" />
              <div className="text-sm text-slate-700"><span className="font-semibold text-slate-900">We could not confirm your last payment.</span> {view.submission.reason}</div>
            </div>
          )}

          {/* promo */}
          {view.allowPromoEntry && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {inv.promoCode ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-success-700"><Tag className="h-4 w-4" />{inv.promoCode} applied</span>
                  <button type="button" onClick={removePromo} disabled={busy} className="text-xs font-semibold text-slate-500 underline">Remove</button>
                </div>
              ) : (
                <div>
                  <label htmlFor="promo" className="text-xs font-semibold text-slate-500">Have a promo code?</label>
                  <div className="mt-1.5 flex gap-2">
                    <input id="promo" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Enter code" maxLength={32} autoComplete="off"
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" />
                    <Button size="sm" variant="outline" onClick={applyPromo} disabled={busy || promo.trim().length < 3}>Apply</Button>
                  </div>
                </div>
              )}
              {promoMsg && <p className="mt-2 text-xs text-slate-600" role="status">{promoMsg}</p>}
            </div>
          )}

          {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
          {proofDone && !error && <div role="status" className="rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">Thanks — your payment details were submitted. We will confirm shortly.</div>}

          {/* methods */}
          {methods.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">No payment method is available for this invoice right now. Please contact the team that sent it.</div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
              <div className="mb-4 text-sm font-bold text-slate-900">Pay {rupees(inv.balanceDuePaise)}</div>
              {methods.length > 1 && (
                <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label="Payment method">
                  {methods.map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setError(''); }}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${method === m ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                      {m === 'RAZORPAY' ? <CreditCard className="h-4 w-4" /> : m === 'UPI' ? <QrCode className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                      {m === 'RAZORPAY' ? 'Card / UPI / Netbanking' : m === 'UPI' ? 'UPI QR' : 'Bank transfer'}
                    </button>
                  ))}
                </div>
              )}

              {method === 'RAZORPAY' && (
                <div>
                  <Button size="lg" fullWidth loading={busy} onClick={payRazorpay} leftIcon={<Shield className="h-5 w-5" />}>Pay {rupees(inv.balanceDuePaise)} securely</Button>
                  <p className="mt-3 text-center text-xs text-slate-500">Cards, UPI and net banking via Razorpay. You will be asked to confirm on the next screen.</p>
                </div>
              )}

              {method === 'UPI' && (
                <div className="space-y-4">
                  {!upi ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : (
                    <>
                      <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 sm:flex-row sm:items-start sm:gap-5">
                        {/* The QR is rendered on a white tile so it stays scannable in the dark dashboard. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={upi.qrDataUrl} alt={`UPI QR for ${rupees(upi.amountPaise)}`} width={220} height={220} className="h-[220px] w-[220px] rounded-lg border border-slate-200 bg-white p-2" />
                        <div className="w-full space-y-2 text-sm">
                          <p className="font-semibold text-slate-900">Scan with any UPI app</p>
                          <p className="text-slate-600">The amount <strong>{rupees(upi.amountPaise)}</strong> and the invoice number are already filled in. Do not change them.</p>
                          <a href={upi.upiLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white sm:hidden"><Smartphone className="h-4 w-4" />Open UPI app</a>
                        </div>
                      </div>
                      <CopyField label="UPI ID" value={upi.upiId} />
                      {upi.payeeName && <CopyField label="Pay to" value={upi.payeeName} />}
                      {upi.staticQrUrl && <details className="text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-700">Show our printed QR</summary>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={upi.staticQrUrl} alt="Our UPI QR" className="mt-2 h-44 w-44 rounded-lg border border-slate-200 bg-white p-2" /></details>}
                    </>
                  )}
                  {view.payee?.instructions && <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">{view.payee.instructions}</p>}
                </div>
              )}

              {method === 'BANK' && view.payee && (
                <div className="space-y-3">
                  {view.payee.bank ? (
                    <>
                      <CopyField label="Account name" value={view.payee.bank.accountName ?? view.payee.payeeName ?? ''} />
                      <CopyField label="Account number" value={view.payee.bank.accountNumber} />
                      {view.payee.bank.ifsc && <CopyField label="IFSC" value={view.payee.bank.ifsc} />}
                      {(view.payee.bank.bankName || view.payee.bank.branch) && <p className="text-xs text-slate-500">{[view.payee.bank.bankName, view.payee.bank.branch].filter(Boolean).join(' · ')}</p>}
                    </>
                  ) : <p className="text-sm text-slate-600">Bank details have not been shared yet. Please contact us.</p>}
                  <p className="text-xs text-slate-500">Mention <strong>{inv.number}</strong> in the transfer remarks.</p>
                  {view.payee.instructions && <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">{view.payee.instructions}</p>}
                </div>
              )}

              {(method === 'UPI' || method === 'BANK') && (
                <div className="mt-5 border-t border-slate-200 pt-5">
                  {!showProof ? (
                    <Button size="lg" fullWidth variant="outline" onClick={() => { setShowProof(true); setProofDone(false); }} leftIcon={<CheckCircle2 className="h-5 w-5" />}>I have paid</Button>
                  ) : (
                    <form onSubmit={submitProof} className="space-y-3.5" noValidate>
                      <div className="text-sm font-bold text-slate-900">Tell us about your payment</div>
                      <div>
                        <label htmlFor="utr" className="text-xs font-semibold text-slate-500">UTR / transaction reference *</label>
                        <input id="utr" required inputMode="text" autoCapitalize="characters" autoComplete="off" value={proof.utr} onChange={(e) => setProof({ ...proof, utr: e.target.value })} placeholder="12-digit UPI reference or bank UTR"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="amt" className="text-xs font-semibold text-slate-500">Amount paid (₹) *</label>
                          <input id="amt" required inputMode="decimal" value={proof.amount} onChange={(e) => setProof({ ...proof, amount: e.target.value.replace(/[^0-9.]/g, '') })}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" />
                        </div>
                        <div>
                          <label htmlFor="dt" className="text-xs font-semibold text-slate-500">Date paid *</label>
                          <input id="dt" type="date" required max={new Date().toISOString().slice(0, 10)} value={proof.paidAt} onChange={(e) => setProof({ ...proof, paidAt: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="shot" className="text-xs font-semibold text-slate-500">Screenshot (optional, JPG/PNG/WebP, max 3 MB)</label>
                        <label htmlFor="shot" className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-600">
                          <Upload className="h-4 w-4" /><span className="truncate">{file ? file.name : 'Choose a screenshot'}</span>
                        </label>
                        <input id="shot" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                      </div>
                      <div>
                        <label htmlFor="note" className="text-xs font-semibold text-slate-500">Note (optional)</label>
                        <input id="note" maxLength={300} value={proof.note} onChange={(e) => setProof({ ...proof, note: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900" />
                      </div>
                      <div className="flex gap-3">
                        <Button type="submit" size="lg" fullWidth loading={busy} disabled={proof.utr.trim().length < 12 || !proof.amount}>Submit payment details</Button>
                        <Button type="button" size="lg" variant="outline" onClick={() => setShowProof(false)}>Cancel</Button>
                      </div>
                      <p className="text-xs text-slate-500">We check every payment against our bank statement before confirming it. Your invoice is not marked paid until we do.</p>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {(inv.status === 'VOID' || inv.status === 'EXPIRED') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">This invoice is no longer payable. Please contact us if you need a new one.</div>
      )}
    </div>
  );
}
