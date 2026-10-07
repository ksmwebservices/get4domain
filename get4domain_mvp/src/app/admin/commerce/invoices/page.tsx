'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Link2, Loader2, Printer, Send, Ban } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { commerceApi, rupees, fmtDate, PLAN_LABEL, CYCLE_LABEL, type InvoiceRow } from '@/lib/commerce';
import { ErrorBox, Field, PayLinkBox, Pill, cardCls, inputCls, msg, selectCls } from '@/components/admin/commerce-ui';

const STATUSES = ['', 'DRAFT', 'SENT', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'EXPIRED'];
const KINDS = ['', 'ACTIVATION', 'RENEWAL', 'PLAN_CHANGE', 'ADDON', 'MANAGED_SERVICE'];

interface Detail extends InvoiceRow {
  submissions: { id: string; status: string; utr: string; claimedAmountPaise: number; confirmedAmountPaise: number | null; paidAt: string; reason: string | null; createdAt: string }[];
  audit: { id: string; actor: string; action: string; createdAt: string; detail: Record<string, unknown> | null }[];
}

export default function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [f, setF] = useState({ status: '', kind: '', q: '' });
  const [busyId, setBusyId] = useState('');
  const [linkModal, setLinkModal] = useState<{ number: string; link: string; sent?: { email: boolean; whatsapp: boolean } } | null>(null);
  const [voidFor, setVoidFor] = useState<InvoiceRow | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await commerceApi.listInvoices(f); setRows(r.data ?? []); setError(''); }
    catch (e) { setError(msg(e)); } finally { setLoading(false); }
  }, [f]);
  useEffect(() => { void load(); }, [load]);

  async function reissue(inv: InvoiceRow, send: boolean) {
    const warn = 'This issues a FRESH pay link. The previous link (if you already sent it) will stop working. Continue?';
    if (!window.confirm(warn)) return;
    setBusyId(inv.id); setError('');
    try { const r = await commerceApi.reissueLink(inv.id, { send }); setLinkModal({ number: inv.invoiceNumber, link: r.data.payLink, sent: r.data.sent }); await load(); }
    catch (e) { setError(msg(e)); } finally { setBusyId(''); }
  }
  async function doVoid() {
    if (!voidFor) return;
    setBusyId(voidFor.id); setError('');
    try { await commerceApi.voidInvoice(voidFor.id, voidReason); setVoidFor(null); setVoidReason(''); await load(); }
    catch (e) { setError(msg(e)); } finally { setBusyId(''); }
  }
  async function openPdf(inv: InvoiceRow) {
    try {
      const r = await commerceApi.invoicePdf(inv.id);
      const w = window.open('', '_blank');
      if (w) { w.document.write(r.data.html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400); }
    } catch (e) { setError(msg(e)); }
  }
  async function openDetail(inv: InvoiceRow) {
    try { const r = await commerceApi.getInvoice(inv.id); setDetail(r.data as Detail); } catch (e) { setError(msg(e)); }
  }

  const payable = (s: string) => ['SENT', 'PENDING', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID', 'DRAFT'].includes(s);

  return (
    <div className="space-y-5">
      <div className={`${cardCls} grid gap-3 sm:grid-cols-4`}>
        <Field label="Status"><select className={selectCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ').toLowerCase() : 'All statuses'}</option>)}</select></Field>
        <Field label="Type"><select className={selectCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ').toLowerCase() : 'All types'}</option>)}</select></Field>
        <Field label="Invoice number" className="sm:col-span-2"><input className={inputCls} placeholder="INV-2026-…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></Field>
      </div>
      <ErrorBox message={error} />

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div> : rows.length === 0 ? (
        <div className={`${cardCls} text-center text-sm text-slate-500`}>No commercial invoices match. Create one from the <Link className="text-primary-300 underline" href="/admin/commerce/deals">deal builder</Link>.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((inv) => (
            <div key={inv.id} className={cardCls}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => openDetail(inv)} className="text-base font-bold text-white hover:underline">{inv.invoiceNumber}</button><Pill value={inv.status} />{inv.kind && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{inv.kind.replace(/_/g, ' ').toLowerCase()}</span>}</div>
                  <div className="mt-0.5 text-sm text-slate-400">{inv.vendor ? <Link className="hover:underline" href={`/admin/customers/${inv.vendor.id}`}>{inv.vendor.businessName}</Link> : '—'} · {inv.description}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{inv.planKey ? `${PLAN_LABEL[inv.planKey]}${inv.billingCycle ? ` · ${CYCLE_LABEL[inv.billingCycle]}` : ''} · ` : ''}created {fmtDate(inv.createdAt)}{inv.dueDate ? ` · due ${fmtDate(inv.dueDate)}` : ''}{inv.paidAt ? ` · paid ${fmtDate(inv.paidAt)}` : ''}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{rupees(inv.totalAmount)}</div>
                  <div className="text-xs text-slate-500">{inv.gstMode === 'NONE' ? 'no GST' : inv.gstMode === 'INCLUSIVE' ? 'GST included' : `+ GST ${rupees(inv.gstAmount)}`}{inv.discountPaise > 0 ? ` · ${rupees(inv.discountPaise)} off` : ''}</div>
                  {inv.paidPaise > 0 && inv.status !== 'PAID' && <div className="text-xs text-warning-400">paid {rupees(inv.paidPaise)} · due {rupees(inv.balanceDuePaise)}</div>}
                  {inv.overpaymentPaise > 0 && <div className="text-xs text-primary-300">overpaid {rupees(inv.overpaymentPaise)}</div>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {payable(inv.status) && inv.status !== 'DRAFT' && <>
                  <Button size="sm" variant="outline" loading={busyId === inv.id} onClick={() => reissue(inv, false)} leftIcon={<Link2 className="h-3.5 w-3.5" />}>Copy link</Button>
                  <Button size="sm" variant="outline" loading={busyId === inv.id} onClick={() => reissue(inv, true)} leftIcon={<Send className="h-3.5 w-3.5" />}>Resend</Button>
                </>}
                <Button size="sm" variant="outline" onClick={() => openPdf(inv)} leftIcon={<Printer className="h-3.5 w-3.5" />}>PDF</Button>
                <Button size="sm" variant="outline" onClick={() => openDetail(inv)} leftIcon={<FileText className="h-3.5 w-3.5" />}>Details</Button>
                {payable(inv.status) && inv.paidPaise === 0 && <Button size="sm" variant="outline" onClick={() => { setVoidFor(inv); setVoidReason(''); }} leftIcon={<Ban className="h-3.5 w-3.5" />}>Void</Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(linkModal)} onClose={() => setLinkModal(null)} title={`Pay link — ${linkModal?.number ?? ''}`} maxWidth="max-w-lg" skin="dark">
        {linkModal && <div className="space-y-3"><PayLinkBox link={linkModal.link} />{linkModal.sent && <p className="text-sm text-slate-300">Sent — email: {linkModal.sent.email ? 'yes' : 'no'}, WhatsApp: {linkModal.sent.whatsapp ? 'yes' : 'no'}.</p>}</div>}
      </Modal>

      <Modal isOpen={Boolean(voidFor)} onClose={() => setVoidFor(null)} title={`Void ${voidFor?.invoiceNumber ?? ''}`} maxWidth="max-w-md" skin="dark">
        <div className="space-y-3">
          <p className="text-sm text-slate-300">The pay link stops working and any waiting payment submissions are rejected. A paid or part-paid invoice cannot be voided.</p>
          <Field label="Reason *"><input className={inputCls} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} maxLength={300} /></Field>
          <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setVoidFor(null)}>Cancel</Button><Button size="sm" loading={busyId === voidFor?.id} disabled={voidReason.trim().length < 3} onClick={doVoid}>Void invoice</Button></div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `${detail.invoiceNumber} — details` : ''} maxWidth="max-w-2xl" skin="dark">
        {detail && (
          <div className="space-y-4 text-sm text-slate-300">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-800 p-3"><div className="text-xs text-slate-500">Total</div><div className="font-bold text-white">{rupees(detail.totalAmount)}</div></div>
              <div className="rounded-xl bg-slate-800 p-3"><div className="text-xs text-slate-500">Balance due</div><div className="font-bold text-white">{rupees(detail.balanceDuePaise)}</div></div>
            </div>
            <div><div className="mb-1 text-xs font-semibold text-slate-500">Lines</div>{(detail.lineItems ?? []).map((l, i) => <div key={i} className="flex justify-between"><span>{l.label}</span><span>{rupees(l.amountPaise * (l.qty ?? 1))}</span></div>)}{detail.discountPaise > 0 && <div className="flex justify-between text-success-400"><span>Discount — {detail.discountReason}</span><span>− {rupees(detail.discountPaise)}</span></div>}</div>
            <div><div className="mb-1 text-xs font-semibold text-slate-500">Payment submissions</div>{detail.submissions.length === 0 ? <p className="text-slate-500">None.</p> : detail.submissions.map((s) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 py-1.5"><span>UTR …{s.utr.slice(-6)} · claimed {rupees(s.claimedAmountPaise)}{s.confirmedAmountPaise != null ? ` · received ${rupees(s.confirmedAmountPaise)}` : ''}</span><Pill value={s.status} /></div>)}</div>
            <div><div className="mb-1 text-xs font-semibold text-slate-500">Audit trail</div>{detail.audit.length === 0 ? <p className="text-slate-500">Nothing yet.</p> : detail.audit.map((a) => <div key={a.id} className="border-t border-slate-800 py-1.5 text-xs"><span className="font-semibold text-slate-200">{a.action}</span> · {a.actor} · {fmtDate(a.createdAt)}</div>)}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
