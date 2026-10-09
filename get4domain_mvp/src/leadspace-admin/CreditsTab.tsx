'use client';

import { useState } from 'react';
import { useLoad } from '@/bos/client';
import { Btn, Msg, Pill, Spin, Table, adm, card, field, rs, useAct, when } from './ui';

interface Dispute { id: string; leadId: string; vendorId: string; reason: string; note: string | null; status: string; createdAt: string }
interface Refund { id: string; vendorId: string; amountPaise: number; status: string; note: string | null; paymentFeePaise: number; createdAt: string }
interface Pack { id: string; label: string; payPaise: number; creditPaise: number; gstMode: 'INCLUSIVE' | 'EXCLUSIVE'; active: boolean; sort: number; quote: { chargePaise: number; gstPaise: number } }
interface RefillRow { id: string; vendorId: string; amountPaise: number; razorpayId: string | null; createdAt: string; balanceAfter: number }

/** Invalid-lead disputes, refund requests, refill packs, refills and the expiry sweep. Money screen: not offered to MARKETING staff. */
export default function CreditsTab() {
  const disputes = useLoad(() => adm<Dispute[]>('/admin/leadspace/disputes'), []);
  const refunds = useLoad(() => adm<Refund[]>('/admin/leadspace/refunds'), []);
  const packs = useLoad(() => adm<Pack[]>('/admin/leadspace/packs'), []);
  const refills = useLoad(() => adm<RefillRow[]>('/admin/leadspace/refills'), []);
  const { msg, busy, act } = useAct(() => { disputes.reload(); refunds.reload(); packs.reload(); refills.reload(); });
  const [note, setNote] = useState<Record<string, string>>({});
  const [fee, setFee] = useState<Record<string, string>>({});
  const [pack, setPack] = useState({ label: '', pay: '', credit: '', gstMode: 'INCLUSIVE' as 'INCLUSIVE' | 'EXCLUSIVE' });
  const [block, setBlock] = useState('');
  const [payment, setPayment] = useState('');
  const [sweep, setSweep] = useState<{ vendors: number; paise: number; applied: boolean } | null>(null);

  return (
    <div className="space-y-6">
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Leads vendors say are not valid ({disputes.data?.length ?? 0})</h3>
        {disputes.loading && !disputes.data ? <Spin /> : (disputes.data ?? []).length === 0 ? <div className={`${card} text-sm text-slate-500`}>Nothing waiting.</div> : (
          <ul className="space-y-2">
            {(disputes.data ?? []).map((d) => (
              <li key={d.id} className={`${card} space-y-2`}>
                <div className="text-sm text-slate-200"><Pill tone="amber">{d.reason}</Pill> <span className="ml-2 text-xs text-slate-500">lead {d.leadId.slice(0, 8)} · vendor {d.vendorId.slice(-6)} · {when(d.createdAt)}</span></div>
                {d.note && <p className="text-sm text-slate-300">{d.note}</p>}
                <div className="flex flex-wrap gap-2">
                  <input className={`${field} flex-1`} placeholder="Note for the record (optional)" aria-label="Note" value={note[d.id] ?? ''} onChange={(e) => setNote({ ...note, [d.id]: e.target.value })} autoComplete="off" />
                  <Btn busy={busy === `c${d.id}`} onClick={() => act(`c${d.id}`, () => adm(`/admin/leadspace/disputes/${d.id}`, { method: 'PUT', body: { decision: 'CREDIT', ...(note[d.id]?.trim() ? { note: note[d.id].trim() } : {}) } }), 'Credited back to the vendor wallet.')}>Credit</Btn>
                  <Btn tone="ghost" busy={busy === `r${d.id}`} onClick={() => act(`r${d.id}`, () => adm(`/admin/leadspace/disputes/${d.id}`, { method: 'PUT', body: { decision: 'REJECT', ...(note[d.id]?.trim() ? { note: note[d.id].trim() } : {}) } }), 'Rejected. The lead stays charged.')}>Reject</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Refund requests</h3>
        {(refunds.data ?? []).length === 0 ? <div className={`${card} text-sm text-slate-500`}>None.</div> : (
          <Table head={['When', 'Vendor', 'Amount', 'Status', 'Actions']}>
            {(refunds.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-xs">{when(r.createdAt)}</td><td className="px-3 py-2 text-xs">{r.vendorId.slice(-6)}</td><td className="px-3 py-2 font-semibold text-white">{rs(r.amountPaise)}</td>
                <td className="px-3 py-2"><Pill tone={r.status === 'PAID' ? 'green' : r.status === 'REQUESTED' ? 'amber' : 'grey'}>{r.status}</Pill>{r.paymentFeePaise ? <span className="ml-1 text-xs text-slate-500">fee {rs(r.paymentFeePaise)}</span> : null}</td>
                <td className="px-3 py-2">
                  {r.status === 'REQUESTED' && <div className="flex flex-wrap items-center gap-1.5"><input className={`${field} w-28`} placeholder="Payment fee Rs" aria-label="Payment fee in rupees" inputMode="decimal" value={fee[r.id] ?? ''} onChange={(e) => setFee({ ...fee, [r.id]: e.target.value.replace(/[^\d.]/g, '') })} autoComplete="off" /><Btn busy={busy === `ra${r.id}`} onClick={() => act(`ra${r.id}`, () => adm(`/admin/leadspace/refunds/${r.id}`, { method: 'PUT', body: { decision: 'APPROVE', paymentFeePaise: Math.round(Number(fee[r.id] || 0) * 100) } }), 'Approved. The wallet was debited; now pay it out in Razorpay and mark it paid.')}>Approve</Btn><Btn tone="ghost" onClick={() => act(`rr${r.id}`, () => adm(`/admin/leadspace/refunds/${r.id}`, { method: 'PUT', body: { decision: 'REJECT' } }), 'Rejected.')}>Reject</Btn></div>}
                  {r.status === 'APPROVED' && <Btn busy={busy === `rp${r.id}`} onClick={() => act(`rp${r.id}`, () => adm(`/admin/leadspace/refunds/${r.id}`, { method: 'PUT', body: { decision: 'PAID' } }), 'Marked as paid.')}>Mark paid</Btn>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Refill packs</h3>
        <Table head={['Pack', 'Customer pays', 'Wallet gets', 'GST', 'Active']}>
          {(packs.data ?? []).map((p) => (
            <tr key={p.id}><td className="px-3 py-2 font-semibold text-white">{p.label}</td><td className="px-3 py-2">{rs(p.quote.chargePaise)}</td><td className="px-3 py-2">{rs(p.creditPaise)}</td><td className="px-3 py-2 text-xs">{p.gstMode === 'INCLUSIVE' ? 'included' : 'added'} ({rs(p.quote.gstPaise)})</td>
              <td className="px-3 py-2"><Btn tone="ghost" onClick={() => act(`pk${p.id}`, () => adm('/admin/leadspace/packs', { method: 'PUT', body: { id: p.id, label: p.label, payPaise: p.payPaise, creditPaise: p.creditPaise, gstMode: p.gstMode, active: !p.active, sort: p.sort } }), p.active ? 'Pack hidden from vendors.' : 'Pack shown to vendors.')}>{p.active ? 'Hide' : 'Show'}</Btn></td></tr>
          ))}
        </Table>
        <div className={`${card} grid gap-2 sm:grid-cols-5`}>
          <input className={field} placeholder="Name" aria-label="Pack name" value={pack.label} onChange={(e) => setPack({ ...pack, label: e.target.value })} autoComplete="off" />
          <input className={field} placeholder="Price in rupees" aria-label="Price in rupees" inputMode="decimal" value={pack.pay} onChange={(e) => setPack({ ...pack, pay: e.target.value.replace(/[^\d.]/g, '') })} autoComplete="off" />
          <input className={field} placeholder="Credit in rupees" aria-label="Credit in rupees" inputMode="decimal" value={pack.credit} onChange={(e) => setPack({ ...pack, credit: e.target.value.replace(/[^\d.]/g, '') })} autoComplete="off" />
          <select className={field} value={pack.gstMode} onChange={(e) => setPack({ ...pack, gstMode: e.target.value as 'INCLUSIVE' | 'EXCLUSIVE' })} aria-label="GST"><option value="INCLUSIVE">GST included in the price</option><option value="EXCLUSIVE">GST added on top</option></select>
          <Btn busy={busy === 'newpack'} disabled={!pack.label || !pack.pay || !pack.credit} onClick={() => act('newpack', async () => { await adm('/admin/leadspace/packs', { method: 'PUT', body: { label: pack.label.trim(), payPaise: Math.round(Number(pack.pay) * 100), creditPaise: Math.round(Number(pack.credit) * 100), gstMode: pack.gstMode } }); setPack({ label: '', pay: '', credit: '', gstMode: 'INCLUSIVE' }); }, 'Pack added.')}>Add pack</Btn>
        </div>
        <p className="text-xs text-slate-500">The GST treatment is a CA decision still pending: switch a pack, or the custom amount (Rules tab: customGstMode), between included and added without changing any code.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Recent refills</h3>
        <Table head={['When', 'Vendor', 'Credited', 'Payment', 'Balance after']} empty={(refills.data ?? []).length === 0 ? 'No refills yet.' : undefined}>
          {(refills.data ?? []).slice(0, 30).map((r) => <tr key={r.id}><td className="px-3 py-2 text-xs">{when(r.createdAt)}</td><td className="px-3 py-2 text-xs">{r.vendorId.slice(-6)}</td><td className="px-3 py-2 text-white">{rs(r.amountPaise)}</td><td className="px-3 py-2 font-mono text-xs">{r.razorpayId}</td><td className="px-3 py-2">{rs(r.balanceAfter)}</td></tr>)}
        </Table>
        <div className={`${card} flex flex-wrap items-center gap-2`}>
          <input className={`${field} w-64`} placeholder="Razorpay payment id (pay_...)" aria-label="Payment id" value={payment} onChange={(e) => setPayment(e.target.value)} autoComplete="off" />
          <Btn busy={busy === 'rec'} disabled={!payment.trim()} onClick={() => act('rec', async () => { const r = await adm<{ credited: boolean; reason?: string }>('/admin/leadspace/refills/reconcile', { method: 'POST', body: { razorpayPaymentId: payment.trim() } }); if (!r.credited) throw new Error(r.reason ?? 'Nothing was credited (it may already be credited).'); setPayment(''); }, 'Credited.')}>Credit a payment that was never confirmed</Btn>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Balance expiry and blocked numbers</h3>
        <div className={`${card} flex flex-wrap items-center gap-2`}>
          <Btn tone="ghost" busy={busy === 'sw'} onClick={() => act('sw', async () => setSweep(await adm('/admin/leadspace/expiry-sweep', { method: 'POST', body: {} })), 'This is what the sweep would do.')}>Show what would expire</Btn>
          {sweep && <span className="text-sm text-slate-300">{sweep.vendors} vendor(s), {rs(sweep.paise)}</span>}
          {sweep && sweep.vendors > 0 && <Btn tone="danger" busy={busy === 'sw2'} onClick={() => act('sw2', async () => setSweep(await adm('/admin/leadspace/expiry-sweep', { method: 'POST', body: { apply: true } })), 'Expired balance written off in the ledgers.')}>Write it off</Btn>}
        </div>
        <div className={`${card} flex flex-wrap items-center gap-2`}>
          <input className={`${field} w-56`} placeholder="Mobile number to never send a code to" aria-label="Number to block" inputMode="numeric" value={block} onChange={(e) => setBlock(e.target.value)} autoComplete="off" />
          <Btn busy={busy === 'blk'} disabled={block.replace(/\D/g, '').length < 10} onClick={() => act('blk', async () => { await adm('/admin/leadspace/blocked-phones', { method: 'POST', body: { phone: block, reason: 'Blocked by admin' } }); setBlock(''); }, 'Blocked. No code will be sent to this number again.')}>Block</Btn>
        </div>
      </section>
    </div>
  );
}
