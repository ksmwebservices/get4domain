'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { dateShort, plain, rupees, useLoad } from '@/bos/client';
import { Alert, Empty, ErrorView, Field, Spinner, inputCls, openHtml } from '@/bos/ui';
import WalletReportView from './WalletReport';
import { EVENT_ONE, ls, type PacksData, type Receipt, type WalletData } from './ls';

interface RzpResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RzpOptions { key: string; amount: number; currency: string; name: string; description: string; order_id: string; handler: (r: RzpResponse) => void; modal?: { ondismiss?: () => void }; theme?: { color: string } }
type RzpCtor = new (o: RzpOptions) => { open: () => void };
const rzpCtor = (): RzpCtor | undefined => (window as unknown as { Razorpay?: RzpCtor }).Razorpay;

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (rzpCtor()) { resolve(); return; }
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => resolve(); s.onerror = () => reject(new Error('We could not open the payment window. Check your internet connection and try again.')); document.body.appendChild(s);
  });
}


export default function WalletTab({ onChange }: { onChange: () => void }) {
  const w = useLoad(() => ls<WalletData>('/leadspace/wallet'), []);
  const packs = useLoad(() => ls<PacksData>('/leadspace/wallet/packs'), []);
  const rec = useLoad(() => ls<Receipt[]>('/leadspace/wallet/receipts'), []);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  if (w.loading && !w.data) return <Spinner />;
  if (w.error && !w.data) return <ErrorView error={w.error} />;
  const d = w.data as WalletData;

  const refresh = (): void => { w.reload(); rec.reload(); onChange(); };

  async function pay(pick: { packId?: string; customPaise?: number }, label: string): Promise<void> {
    setBusy(label); setMsg(null);
    try {
      const o = await ls<{ orderId: string; keyId: string | null; quote: { chargePaise: number; label: string } }>('/leadspace/wallet/refill', { method: 'POST', body: pick });
      if (!o.keyId) throw new Error('Payments are not switched on yet. Please write to support.');
      await loadRazorpay();
      await new Promise<void>((resolve) => {
        const Rzp = rzpCtor();
        if (!Rzp) { resolve(); return; }
        const rzp = new Rzp({
          key: o.keyId as string, amount: o.quote.chargePaise, currency: 'INR', name: 'Get4Domain', description: 'LeadSpace wallet refill', order_id: o.orderId, theme: { color: '#2563eb' },
          modal: { ondismiss: () => resolve() },
          handler: async (r) => {
            try {
              const v = await ls<{ credited: boolean; released: number; invoiceNumber: string | null }>('/leadspace/wallet/refill/verify', { method: 'POST', body: { razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature } });
              setMsg({ tone: 'ok', text: `Payment received. Your wallet is topped up${v.released ? ` and ${v.released} waiting customer${v.released === 1 ? ' was' : 's were'} released` : ''}${v.invoiceNumber ? `. Tax invoice ${v.invoiceNumber} is on its way to your e-mail` : ''}.` });
              refresh();
            } catch (e) { setMsg({ tone: 'error', text: `${plain(e)} If money was taken, it will be added to your wallet automatically within a few minutes; write to support if it is not.` }); }
            resolve();
          },
        });
        rzp.open();
      });
    } catch (e) { setMsg({ tone: 'error', text: plain(e) }); } finally { setBusy(''); }
  }

  async function mode(m: 'HOLD' | 'REJECT'): Promise<void> {
    setBusy('mode'); setMsg(null);
    try { await ls('/leadspace/wallet/low-balance-mode', { method: 'PUT', body: { mode: m } }); w.reload(); } catch (e) { setMsg({ tone: 'error', text: plain(e) }); } finally { setBusy(''); }
  }
  async function refund(): Promise<void> {
    setBusy('refund'); setMsg(null);
    try { await ls('/leadspace/wallet/refund-request', { method: 'POST', body: {} }); setMsg({ tone: 'ok', text: 'Your refund request is with our team. We will contact you.' }); } catch (e) { setMsg({ tone: 'error', text: plain(e) }); } finally { setBusy(''); }
  }
  async function invoice(id: string): Promise<void> {
    try { await openHtml(`/invoices/${id}/pdf`); } catch (e) { setMsg({ tone: 'error', text: plain(e) }); }
  }

  const customPaise = Math.round(Number(custom) * 100);
  const lim = packs.data?.custom;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Wallet</h1>
        <p className="mt-1 text-sm text-slate-500">Money for verified customers. You pay for a customer only after they verify their number on WhatsApp.</p>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <Card padded>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Balance</div>
        <div className="mt-1 text-3xl font-extrabold text-slate-900">{rupees(d.balancePaise)}</div>
        {d.held > 0 && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{d.held} customer{d.held === 1 ? ' is' : 's are'} waiting. A refill releases them, oldest first.</p>}
        {d.balancePaise > 0 && d.balancePaise <= Math.max(...d.lowBalanceThresholdsPaise, 0) && <p className="mt-2 text-sm text-amber-700">Your balance is getting low.</p>}
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Add money</h2>
        {packs.loading && !packs.data ? <Spinner /> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(packs.data?.packs ?? []).map((p) => (
              <Card key={p.id} padded hover>
                <div className="text-sm font-semibold text-slate-900">{p.label}</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">{rupees(p.creditPaise)} <span className="text-xs font-medium text-slate-500">credit</span></div>
                <div className="mt-1 text-xs text-slate-500">You pay {rupees(p.quote.chargePaise)}{p.gstMode === 'EXCLUSIVE' ? ` including ${rupees(p.quote.gstPaise)} GST` : ` (GST ${rupees(p.quote.gstPaise)} included)`}</div>
                <div className="mt-3"><Button fullWidth loading={busy === p.id} onClick={() => pay({ packId: p.id }, p.id)}>Pay {rupees(p.quote.chargePaise)}</Button></div>
              </Card>
            ))}
          </div>
        )}
        {lim && (
          <Card padded className="space-y-2">
            <Field label="Or choose your own amount" hint={`Between ${rupees(lim.minPaise)} and ${rupees(lim.maxPaise)}.`}>
              <input className={inputCls} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))} placeholder="Amount in rupees" autoComplete="off" />
            </Field>
            <Button fullWidth variant="outline" disabled={!custom || customPaise < lim.minPaise || customPaise > lim.maxPaise} loading={busy === 'custom'} onClick={() => pay({ customPaise }, 'custom')}>Pay this amount</Button>
          </Card>
        )}
        <p className="text-xs text-slate-500">Payments go to Get4Domain through Razorpay. A GST tax invoice for every refill is e-mailed to you and listed below.</p>
      </section>

      <Card padded>
        <div className="text-sm font-semibold text-slate-900">What a verified customer costs</div>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {Object.entries(d.prices).map(([t, p]) => <li key={t} className="flex justify-between py-1.5"><span className="text-slate-700">{EVENT_ONE[t] ?? t}</span><span className="font-semibold text-slate-900">{p === null ? 'Not set' : rupees(p)}</span></li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-500">The price is fixed when the customer verifies. A later price change never changes what you already paid.</p>
      </Card>

      <Card padded className="space-y-2">
        <div className="text-sm font-semibold text-slate-900">When your balance runs out</div>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="radio" name="lowmode" checked={d.lowBalanceMode === 'HOLD'} onChange={() => mode('HOLD')} disabled={busy === 'mode'} className="mt-1" /><span><strong>Keep your page working and hold the customer</strong> (recommended). They see the normal thank-you; you see a count and a hidden number until you refill.</span></label>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="radio" name="lowmode" checked={d.lowBalanceMode === 'REJECT'} onChange={() => mode('REJECT')} disabled={busy === 'mode'} className="mt-1" /><span><strong>Tell the customer politely to contact you directly.</strong> Nothing is stored for you.</span></label>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Tax invoices and receipts</h2>
        {rec.data && rec.data.length > 0 ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {rec.data.map((r) => (
              <li key={`${r.at}${r.paidRef}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div><div className="font-semibold text-slate-900">{rupees(r.creditPaise)} added</div><div className="text-xs text-slate-500">{dateShort(r.at)}{r.invoiceNumber ? ` · Invoice ${r.invoiceNumber}` : ''}{r.totalPaise ? ` · paid ${rupees(r.totalPaise)}` : ''}</div></div>
                {r.invoiceId && <Button size="sm" variant="outline" onClick={() => invoice(r.invoiceId as string)}>Open</Button>}
              </li>
            ))}
          </ul>
        ) : <Empty title="No refills yet">Your invoices and receipts appear here after your first refill.</Empty>}
      </section>

      <section>
        <button className="text-sm font-semibold text-primary-700 underline" onClick={() => setShowLedger((x) => !x)}>{showLedger ? 'Hide' : 'Show'} where my wallet money went</button>
        {showLedger && <div className="mt-3"><WalletReportView /></div>}
      </section>

      <Card padded className="space-y-1">
        <div className="text-sm font-semibold text-slate-900">If a lead was not valid</div>
        <p className="text-sm text-slate-600">Open it in the Leads tab within {d.disputeWindowHours} hours and press &quot;This lead is not valid&quot;. Our team checks it. If it is a wrong number, spam or the same customer again, the amount comes back here and shows in the list above.</p>
      </Card>

      <Card padded className="space-y-2">
        <div className="text-sm font-semibold text-slate-900">Unused balance</div>
        <p className="text-sm text-slate-600">Unused balance can be refunded on request, less the payment fee, for refills made in the last {d.refundWindowMonths} months. Unused balance expires after {d.expiryMonths} months of no activity.</p>
        <Button size="sm" variant="outline" loading={busy === 'refund'} disabled={d.balancePaise <= 0} onClick={refund}>Ask for a refund</Button>
      </Card>
    </div>
  );
}
