'use client';

import { useState } from 'react';
import { MessageCircle, Printer } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { bos, dateShort, plain, rupees, useLoad } from './client';
import { Alert, Empty, ErrorView, Spinner, Stat, openHtml } from './ui';
import { PaymentModal } from './DocModals';
import Modal from '@/components/ui/Modal';

interface OutParty { partyId: string | null; partyName: string; totalPaise: number; buckets: Record<string, number>; documents: { id: string; number: string | null; docDate: string; dueDate: string | null; outstandingPaise: number; ageDays: number; bucket: string }[] }
interface Outstanding { totalPaise: number; buckets: Record<string, number>; parties: OutParty[] }
interface Receipt { id: string; paymentDate: string; partyName: string | null; mode: string; amountPaise: number; allocatedPaise: number; advancePaise: number; reference: string | null; status: string }

const BUCKETS = ['0-30', '31-60', '61-90', '90+'];

/** Money in: who owes you (with ageing), the receipts you recorded, each customer's statement, and a reminder you can send in one tap. */
export function MoneyIn() {
  const out = useLoad(() => bos<Outstanding>('/bos/outstanding'), []);
  const rec = useLoad(() => bos<Receipt[]>('/bos/payments?kind=RECEIPT'), []);
  const [paying, setPaying] = useState<{ id: string; name: string } | null>(null);
  const [err, setErr] = useState('');
  const [cancelling, setCancelling] = useState<Receipt | null>(null);
  const [why, setWhy] = useState('');

  async function remind(partyId: string) {
    setErr('');
    try { const r = await bos<{ whatsappUrl: string }>(`/bos/parties/${partyId}/reminder`); window.open(r.whatsappUrl, '_blank', 'noopener'); } catch (e) { setErr(plain(e)); }
  }
  async function cancelReceipt() {
    if (!cancelling) return;
    try { await bos(`/bos/payments/${cancelling.id}/cancel`, { method: 'POST', body: { reason: why.trim() } }); setCancelling(null); setWhy(''); out.reload(); rec.reload(); } catch (e) { setErr(plain(e)); }
  }

  if (out.loading && !out.data) return <Spinner />;
  if (out.error) return <ErrorView error={out.error} />;
  const o = out.data!;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Waiting to be paid" value={rupees(o.totalPaise)} tone={o.totalPaise ? 'warn' : 'default'} />
        {BUCKETS.map((b) => <Stat key={b} label={`${b} days`} value={rupees(o.buckets[b] ?? 0)} tone={b === '90+' && (o.buckets[b] ?? 0) > 0 ? 'warn' : 'default'} />)}
      </div>
      {err && <Alert>{err}</Alert>}
      {o.parties.length === 0 ? (
        <Empty title="Nobody owes you anything right now">When an invoice is issued and not yet paid, the customer appears here with how old the bill is.</Empty>
      ) : (
        <div className="space-y-3">
          {o.parties.map((p) => (
            <Card key={p.partyId ?? p.partyName} padded>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><div className="text-sm font-bold text-slate-900">{p.partyName}</div><div className="text-xs text-slate-500">{p.documents.length} unpaid invoice{p.documents.length === 1 ? '' : 's'} · oldest {Math.max(...p.documents.map((d) => d.ageDays))} days</div></div>
                <div className="flex items-center gap-2">
                  <div className="mr-2 text-right text-lg font-bold text-amber-700">{rupees(p.totalPaise)}</div>
                  {p.partyId && <Button size="sm" onClick={() => setPaying({ id: p.partyId as string, name: p.partyName })}>Receive payment</Button>}
                  {p.partyId && <Button size="sm" variant="outline" leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => remind(p.partyId as string)}>Remind</Button>}
                  {p.partyId && <Button size="sm" variant="ghost" leftIcon={<Printer className="h-4 w-4" />} onClick={() => openHtml(`/bos/parties/${p.partyId}/statement/html`).catch((e) => setErr(plain(e)))}>Statement</Button>}
                </div>
              </div>
              <div className="mt-3 divide-y divide-slate-50 text-sm">
                {p.documents.map((d) => <div key={d.id} className="flex items-center justify-between py-1.5"><span>{d.number} <span className="text-xs text-slate-400">· {dateShort(d.docDate)}{d.dueDate ? ` · due ${dateShort(d.dueDate)}` : ''}</span></span><span className="flex items-center gap-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{d.ageDays} days</span><b>{rupees(d.outstandingPaise)}</b></span></div>)}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-bold text-slate-900">Receipts</h2>
        {rec.loading && !rec.data ? <Spinner /> : (rec.data?.length ?? 0) === 0 ? <Empty title="No receipts yet">Use Receive payment on an invoice. Part payments and advances are fine.</Empty> : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {rec.data!.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1"><div className={`font-medium ${r.status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{r.partyName ?? 'Walk-in'} <span className="font-normal text-slate-400">· {r.mode.toLowerCase()}{r.reference ? ` · ${r.reference}` : ''}</span></div><div className="text-xs text-slate-400">{dateShort(r.paymentDate)}{r.advancePaise > 0 ? ` · ${rupees(r.advancePaise)} kept as advance` : ''}</div></div>
                <b className={r.status === 'CANCELLED' ? 'text-slate-400' : 'text-success-700'}>{rupees(r.amountPaise)}</b>
                {r.status === 'ACTIVE' && <button className="text-xs font-semibold text-slate-400 hover:text-error-600" onClick={() => setCancelling(r)}>Cancel</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {paying && <PaymentModal party={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); out.reload(); rec.reload(); }} />}
      {cancelling && (
        <Modal isOpen onClose={() => setCancelling(null)} title="Cancel this receipt?" maxWidth="max-w-md">
          <div className="space-y-3 p-4">
            <p className="text-sm text-slate-500">The invoice it paid becomes unpaid again. The receipt stays on record, marked cancelled.</p>
            <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Why? (a few words)" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Reason" autoComplete="off" />
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCancelling(null)}>Keep it</Button><Button disabled={why.trim().length < 3} onClick={cancelReceipt}>Cancel receipt</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
