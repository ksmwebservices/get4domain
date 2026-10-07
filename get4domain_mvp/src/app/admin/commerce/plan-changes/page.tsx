'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { commerceApi, rupees, fmtDate, CYCLE_LABEL, PLAN_LABEL, type Cycle, type PlanKey } from '@/lib/commerce';
import { ErrorBox, Field, Pill, cardCls, inputCls, msg, selectCls } from '@/components/admin/commerce-ui';

interface Req {
  id: string; vendorId: string; toPlanKey: PlanKey; toCycle: Cycle; toCycleMonths: number; effective: 'AT_RENEWAL' | 'NOW'; status: string;
  vendorNote: string | null; adminNote: string | null; requestedAt: string; prorationCreditPaise: number;
  listPaise: number | null; approvedNetPaise: number | null; discountReason: string | null;
  quote?: { listPaise: number; creditIfNowPaise: number };
  vendor: { id: string; businessName: string; name: string } | null;
  current: { planKey: PlanKey; billingCycle: Cycle; periodEnd: string | null; netAmountPaise: number; source: string } | null;
}

export default function PlanChangesPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [status, setStatus] = useState('REQUESTED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [approve, setApprove] = useState<Req | null>(null);
  const [effective, setEffective] = useState<'AT_RENEWAL' | 'NOW'>('AT_RENEWAL');
  // Approved net price (rupees, as typed). Empty/equal to list = bill the list price.
  const [price, setPrice] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [reject, setReject] = useState<Req | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await commerceApi.planChanges(status === 'ALL' ? undefined : status); setRows((r.data ?? []) as Req[]); setError(''); } catch (e) { setError(msg(e)); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const isDowngrade = (r: Req) => r.current?.planKey === 'BOS' && r.toPlanKey === 'WORKSPACE';

  // Price maths for the approve dialog. This is a PREVIEW only — the server recomputes and range-checks everything.
  const listPaise = approve?.quote?.listPaise ?? 0;
  const typedPaise = price.trim() === '' ? listPaise : Math.round(parseFloat(price) * 100);
  const priceValid = Number.isFinite(typedPaise) && typedPaise >= 0 && typedPaise <= listPaise;
  const discountPaise = priceValid ? listPaise - typedPaise : 0;
  const overridden = priceValid && discountPaise > 0;
  const bigDiscount = overridden && listPaise > 0 && discountPaise / listPaise > 0.2;
  const creditPaise = effective === 'NOW' && priceValid ? Math.min(approve?.quote?.creditIfNowPaise ?? 0, typedPaise) : 0;
  const priceBlocked = !priceValid || (overridden && priceReason.trim().length < 3) || (bigDiscount && confirmText !== 'CONFIRM');

  async function doApprove() {
    if (!approve) return;
    setBusy(true); setError('');
    try {
      const r = await commerceApi.approvePlanChange(approve.id, {
        effective, adminNote: note.trim() || undefined,
        ...(overridden ? { netPaise: typedPaise, discountReason: priceReason.trim(), ...(bigDiscount ? { confirm: confirmText } : {}) } : {}),
      });
      const d = r.data as { note?: string; effective?: string };
      setNote(''); setPrice(''); setPriceReason(''); setConfirmText(''); setApprove(null); await load();
      if (d.note) alert(d.note);
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }
  async function doReject() {
    if (!reject) return;
    setBusy(true); setError('');
    try { await commerceApi.rejectPlanChange(reject.id, reason); setReject(null); setReason(''); await load(); } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-400">Vendors ask to change plan or billing cycle. <strong className="text-slate-200">Downgrades only apply at renewal.</strong> An upgrade can start now — the unused days of the current term (unused days × daily net rate) are credited on the new invoice. There are no automatic cash refunds.</p>
        <div className="w-44"><Field label="Show"><select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}><option value="REQUESTED">Waiting for me</option><option value="APPROVED">Approved</option><option value="APPLIED">Applied</option><option value="REJECTED">Rejected</option><option value="ALL">All</option></select></Field></div>
      </div>
      <ErrorBox message={error} />
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div> : rows.length === 0 ? <div className={`${cardCls} text-center text-sm text-slate-500`}>No requests here.</div> : (
        <div className="space-y-3">{rows.map((r) => (
          <div key={r.id} className={cardCls}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><span className="font-bold text-white">{r.vendor ? <Link className="hover:underline" href={`/admin/customers/${r.vendor.id}`}>{r.vendor.businessName}</Link> : r.vendorId}</span><Pill value={r.status} />{isDowngrade(r) && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">downgrade</span>}</div>
                <div className="mt-1 text-sm text-slate-300">{r.current ? `${PLAN_LABEL[r.current.planKey]} · ${CYCLE_LABEL[r.current.billingCycle]}` : 'No current term'} → <strong className="text-white">{PLAN_LABEL[r.toPlanKey]} · {r.toCycle === 'CUSTOM_MONTHS' ? `${r.toCycleMonths} months` : CYCLE_LABEL[r.toCycle]}</strong> <span className="text-slate-500">({r.effective === 'NOW' ? 'wants it now' : 'at renewal'})</span></div>
                {r.current && <div className="text-xs text-slate-500">Current term ends {fmtDate(r.current.periodEnd)} · net {rupees(r.current.netAmountPaise)} · {r.current.source === 'ADMIN_DEAL' ? 'negotiated deal' : 'standard'}</div>}
                {r.vendorNote && <div className="mt-1 text-xs italic text-slate-400">“{r.vendorNote}”</div>}
                {r.adminNote && <div className="mt-1 text-xs text-slate-400">Admin note: {r.adminNote}</div>}
                {r.prorationCreditPaise > 0 && <div className="mt-1 text-xs text-success-400">Proration credit applied: {rupees(r.prorationCreditPaise)}</div>}
                {r.approvedNetPaise != null && <div className="mt-1 text-xs text-slate-400">Approved price {rupees(r.approvedNetPaise)} (list {rupees(r.listPaise ?? 0)}){r.discountReason ? ` · ${r.discountReason}` : ''}</div>}
              </div>
              <div className="text-xs text-slate-500">{fmtDate(r.requestedAt)}</div>
            </div>
            {r.status === 'REQUESTED' && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => { setApprove(r); setEffective(isDowngrade(r) ? 'AT_RENEWAL' : r.effective); setNote(''); setPrice(''); setPriceReason(''); setConfirmText(''); }}>Approve…</Button><Button size="sm" variant="outline" onClick={() => { setReject(r); setReason(''); }}>Reject…</Button></div>}
          </div>))}</div>
      )}

      <Modal isOpen={Boolean(approve)} onClose={() => setApprove(null)} title="Approve plan change" maxWidth="max-w-md" skin="dark">
        {approve && (
          <div className="space-y-4">
            <Field label="When should it take effect?">
              <select className={selectCls} value={effective} onChange={(e) => setEffective(e.target.value as 'AT_RENEWAL' | 'NOW')}>
                <option value="AT_RENEWAL">At renewal (scheduled; the renewal bills the approved price)</option>
                <option value="NOW" disabled={isDowngrade(approve)}>Now, with a proration credit{isDowngrade(approve) ? ' (not allowed for downgrades)' : ''}</option>
              </select>
            </Field>
            <div className="space-y-3 rounded-xl border border-slate-700 p-3.5">
              <Field label="Net price for this plan (₹, before GST)" hint={`List price: ${rupees(listPaise)}. Leave as-is to bill list; lower it to give a negotiated price. The renewal after this change bills the same price.`}>
                <input className={inputCls} inputMode="decimal" value={price} placeholder={String(listPaise / 100)} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} />
              </Field>
              {!priceValid && <p className="text-xs text-error-400">Enter an amount from ₹0 up to the list price {rupees(listPaise)}.</p>}
              {overridden && (
                <>
                  <Field label="Reason for the price *"><input className={inputCls} value={priceReason} onChange={(e) => setPriceReason(e.target.value)} maxLength={300} placeholder="e.g. loyal customer, annual prepay" /></Field>
                  {bigDiscount && <Field label="That is more than 20% off — type CONFIRM"><input className={inputCls} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CONFIRM" /></Field>}
                  <p className="text-xs text-slate-400">Discount {rupees(discountPaise)} ({Math.round((discountPaise / Math.max(1, listPaise)) * 100)}% off list). This override is recorded in the audit log.</p>
                </>
              )}
              {effective === 'NOW' && <p className="text-xs text-slate-300">Credit for unused days: {rupees(creditPaise)} → invoice before GST: <strong className="text-white">{rupees(Math.max(0, (priceValid ? typedPaise : listPaise) - creditPaise))}</strong></p>}
            </div>
            <p className="rounded-xl bg-slate-800 px-3.5 py-2.5 text-xs text-slate-300">{effective === 'NOW' ? 'A PLAN_CHANGE invoice is created now: the approved price minus the credit for unused days of the current term. The pay link is sent to the vendor.' : 'Nothing is charged now. The next renewal invoice (created 15 days before the term ends) uses the new plan and cycle.'}</p>
            <Field label="Note to the vendor (optional)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setApprove(null)}>Cancel</Button><Button size="sm" loading={busy} disabled={priceBlocked} onClick={doApprove}>Approve</Button></div>
          </div>
        )}
      </Modal>
      <Modal isOpen={Boolean(reject)} onClose={() => setReject(null)} title="Reject request" maxWidth="max-w-md" skin="dark">
        <div className="space-y-4"><Field label="Reason (sent to the vendor) *"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus /></Field><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setReject(null)}>Cancel</Button><Button size="sm" loading={busy} disabled={reason.trim().length < 3} onClick={doReject}>Reject</Button></div></div>
      </Modal>
    </div>
  );
}
