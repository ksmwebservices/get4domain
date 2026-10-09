'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

type RzWindow = Window & { Razorpay?: new (opts: Record<string, unknown>) => { open(): void } };
const rzWindow = (): RzWindow => window as unknown as RzWindow;

/**
 * "Pay now" for a shared invoice. Uses the VENDOR's own Razorpay (their keys, their account); the amount always comes from the server, never from
 * this page. If the vendor has not set up online payment this page says so and sends the customer back to the invoice.
 */
export default function PayInvoice() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'ready' | 'paying' | 'done' | 'unavailable' | 'error'>('loading');
  const [info, setInfo] = useState<{ duePaise: number; number: string | null } | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/public/bos/doc/${token}/pay-info`).then((r) => r.json()).then((j) => {
      const d = j?.data;
      if (!d?.available) { setState('unavailable'); return; }
      setInfo({ duePaise: d.duePaise, number: d.number }); setState('ready');
    }).catch(() => { setMsg('We could not reach the server. Please try again.'); setState('error'); });
  }, [token]);

  async function pay() {
    setState('paying'); setMsg('');
    try {
      await new Promise<void>((resolve, reject) => {
        if (rzWindow().Razorpay) return resolve();
        const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load the payment window.')); document.body.appendChild(s);
      });
      const r = await fetch(`${API}/public/bos/doc/${token}/pay-order`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j?.message === 'string' ? j.message : 'Online payment is not available right now.');
      const o = j.data as { razorpayOrderId: string; keyId: string; amount: number; currency: string };
      const rz = new (rzWindow().Razorpay as NonNullable<RzWindow['Razorpay']>)({
        key: o.keyId, order_id: o.razorpayOrderId, amount: o.amount, currency: o.currency, name: info?.number ? `Invoice ${info.number}` : 'Invoice',
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const c = await fetch(`${API}/public/bos/doc/${token}/pay-confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ razorpayOrderId: resp.razorpay_order_id, razorpayPaymentId: resp.razorpay_payment_id, razorpaySignature: resp.razorpay_signature }) });
            if (!c.ok) throw new Error('We could not confirm the payment. If money was taken it will be matched shortly; keep the payment receipt.');
            setState('done');
          } catch (e) { setMsg(e instanceof Error ? e.message : 'We could not confirm the payment.'); setState('error'); }
        },
        modal: { ondismiss: () => setState('ready') },
      });
      rz.open();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); setState('error'); }
  }

  const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center text-slate-800">
      {state === 'loading' && <p className="text-sm text-slate-500">Loading…</p>}
      {state === 'unavailable' && <><h1 className="text-lg font-bold">Online payment is not available for this invoice</h1><p className="text-sm text-slate-500">It may already be paid, or the business takes payment another way. The invoice shows how to pay them.</p><a className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white" href={`/d/${token}`}>Back to the invoice</a></>}
      {(state === 'ready' || state === 'paying') && info && <><h1 className="text-lg font-bold">Pay {rupees(info.duePaise)}</h1><p className="text-sm text-slate-500">Invoice {info.number}. You pay the business directly.</p><button disabled={state === 'paying'} onClick={pay} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{state === 'paying' ? 'Opening…' : `Pay ${rupees(info.duePaise)}`}</button></>}
      {state === 'done' && <><h1 className="text-lg font-bold text-green-700">Payment received. Thank you.</h1><a className="text-sm font-semibold text-blue-600" href={`/d/${token}`}>View the invoice</a></>}
      {state === 'error' && <><h1 className="text-lg font-bold">That did not work</h1><p className="text-sm text-slate-600" role="alert">{msg}</p><button onClick={() => setState('ready')} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold">Try again</button></>}
    </main>
  );
}
