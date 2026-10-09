'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Mail, MessageCircle, Plus, Printer, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { bos, dateShort, plain, rupees, type Doc, type DocLine, type Party } from './client';
import { Alert, Field, StatusPill, inputCls, openHtml } from './ui';
import { ItemSearch, PartyPicker, type PickItem } from './pickers';

interface Settings { gstRegistered: boolean; priceMode: string; defaultGstRate: number; state: string | null; roundOff: boolean; terms?: string | null }
interface EditLine { key: number; itemId?: string; name: string; variantKey: string; hsn: string; qty: string; rate: string; discount: string; gstRate: string; variants?: { variantKey: string; onHand: number }[] }

let lineKey = 1;
const blank = (gst: number): EditLine => ({ key: lineKey++, name: '', variantKey: '', hsn: '', qty: '1', rate: '', discount: '', gstRate: String(gst) });
const num = (s: string): number => { const n = Number(s); return Number.isFinite(n) ? n : 0; };

/** Create or change a quote / invoice draft. Totals shown here are the preview; the server computes the real ones when it saves. */
export function DocEditor({ docType, doc, onClose, onSaved }: { docType: 'QUOTE' | 'SALES_INVOICE' | 'PURCHASE_BILL'; doc?: Doc | null; onClose: () => void; onSaved: (d: Doc) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [taxKind, setTaxKind] = useState<'GST' | 'NONE'>('GST');
  const [priceMode, setPriceMode] = useState<'EXCLUSIVE' | 'INCLUSIVE'>('EXCLUSIVE');
  const [discount, setDiscount] = useState('');
  const [shipping, setShipping] = useState('');
  const [notes, setNotes] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    bos<Settings>('/bos/settings').then((s) => {
      setSettings(s);
      if (!doc) { setTaxKind(s.gstRegistered ? 'GST' : 'NONE'); setPriceMode(s.priceMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE'); setLines([blank(s.defaultGstRate ?? 18)]); }
    }).catch(() => setSettings({ gstRegistered: false, priceMode: 'EXCLUSIVE', defaultGstRate: 18, state: null, roundOff: true }));
    if (doc) {
      bos<Doc>(`/bos/documents/${doc.id}`).then((d) => {
        setParty(d.partyId ? { id: d.partyId, name: d.partyName ?? '', phone: '', email: null, type: 'customer', gstin: d.partyGstin ?? null, state: null } : null);
        setDocDate(d.docDate.slice(0, 10)); setDueDate(d.dueDate ? d.dueDate.slice(0, 10) : ''); setTaxKind(d.taxKind); setPriceMode(d.priceMode);
        setDiscount(d.discountPaise ? String(d.discountPaise / 100) : ''); setShipping(d.shippingPaise ? String(d.shippingPaise / 100) : ''); setNotes(d.notes ?? '');
        setLines((d.lines ?? []).map((l: DocLine) => ({ key: lineKey++, itemId: l.itemId ?? undefined, name: l.name, variantKey: l.variantKey ?? '', hsn: l.hsn ?? '', qty: String(l.qty), rate: String(l.ratePaise / 100), discount: l.discountPaise ? String(l.discountPaise / 100) : '', gstRate: String(l.gstRate) })));
      }).catch((e) => setErr(plain(e)));
    }
  }, [doc]);

  const setLine = (k: number, patch: Partial<EditLine>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  function addItem(i: PickItem) {
    setLines((ls) => {
      const row: EditLine = { key: lineKey++, itemId: i.id, name: i.name, variantKey: '', hsn: i.hsn ?? '', qty: '1', rate: i.ratePaise != null ? String(i.ratePaise / 100) : '', discount: '', gstRate: String(i.gstRate ?? settings?.defaultGstRate ?? 18), variants: i.variants };
      const onlyBlank = ls.length === 1 && !ls[0].name && !ls[0].itemId;
      return onlyBlank ? [row] : [...ls, row];
    });
  }

  const [exact, setExact] = useState<{ subtotalPaise: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; roundOffPaise: number; totalPaise: number } | null>(null);
  const [previewErr, setPreviewErr] = useState('');
  const bodyLines = useMemo(() => lines.filter((l) => l.itemId || l.name.trim()).map((l) => ({ ...(l.itemId ? { itemId: l.itemId } : {}), name: l.name.trim() || undefined, qty: num(l.qty), rate: num(l.rate), ...(num(l.discount) ? { discount: num(l.discount) } : {}), gstRate: taxKind === 'GST' ? num(l.gstRate) : 0 })), [lines, taxKind]);
  useEffect(() => {
    if (!settings || bodyLines.length === 0 || bodyLines.some((l) => !(l.qty > 0))) { setExact(null); setPreviewErr(''); return; }
    const t = setTimeout(() => {
      bos<NonNullable<typeof exact>>('/bos/documents/preview', { method: 'POST', body: { docType, partyId: party?.id, taxKind, priceMode, ...(num(discount) ? { discount: num(discount) } : {}), ...(num(shipping) ? { shipping: num(shipping) } : {}), lines: bodyLines } })
        .then((r) => { setExact(r); setPreviewErr(''); }).catch((e) => { setExact(null); setPreviewErr(plain(e, '')); });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, bodyLines, taxKind, priceMode, discount, shipping, party?.id, docType]);

  async function save(andIssue: boolean) {
    setErr('');
    const payloadLines = lines.filter((l) => l.itemId || l.name.trim()).map((l) => ({ ...(l.itemId ? { itemId: l.itemId } : {}), name: l.name.trim() || undefined, variantKey: l.variantKey.trim() || undefined, hsn: l.hsn.trim() || undefined, qty: num(l.qty), rate: num(l.rate), ...(num(l.discount) ? { discount: num(l.discount) } : {}), gstRate: taxKind === 'GST' ? num(l.gstRate) : 0 }));
    if (!payloadLines.length) { setErr('Add at least one item to this document.'); return; }
    if (payloadLines.some((l) => !(l.qty > 0))) { setErr('Every line needs a quantity above zero.'); return; }
    if (docType === 'PURCHASE_BILL' && !party) { setErr('Choose the supplier for this purchase bill.'); return; }
    setBusy(true);
    try {
      const common = { partyId: party?.id, partyName: party ? undefined : undefined, docDate: new Date(`${docDate}T12:00:00`).toISOString(), ...(dueDate ? { dueDate: new Date(`${dueDate}T12:00:00`).toISOString() } : {}), taxKind, priceMode, ...(num(discount) ? { discount: num(discount) } : {}), ...(num(shipping) ? { shipping: num(shipping) } : {}), notes: notes.trim() || undefined, lines: payloadLines };
      let saved: Doc;
      if (doc) {
        const upd = await bos<Doc>(`/bos/documents/${doc.id}`, { method: 'PUT', body: { ...common, ...(supplierRef ? { supplierRef } : {}) } });
        saved = upd;
        if (andIssue) { const r = await bos<{ doc: Doc }>(`/bos/documents/${doc.id}/issue`, { method: 'POST' }); saved = r.doc; }
      } else {
        const path = docType === 'PURCHASE_BILL' ? '/bos/purchases' : '/bos/documents';
        const r = await bos<{ doc: Doc }>(path, { method: 'POST', body: { docType, ...common, ...(supplierRef ? { supplierRef } : {}), issue: andIssue } });
        saved = r.doc;
      }
      onSaved(saved);
    } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }

  const title = `${doc ? 'Edit' : 'New'} ${docType === 'QUOTE' ? 'quote' : docType === 'PURCHASE_BILL' ? 'purchase bill' : settings && taxKind === 'NONE' ? 'bill' : 'invoice'}`;
  const gst = taxKind === 'GST';
  return (
    <Modal isOpen onClose={onClose} title={title} maxWidth="max-w-4xl">
      <div className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <PartyPicker kind={docType === 'PURCHASE_BILL' ? 'supplier' : 'customer'} value={party} onChange={setParty} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className={inputCls} value={docDate} onChange={(e) => setDocDate(e.target.value)} /></Field>
            {docType !== 'QUOTE' ? <Field label={docType === 'PURCHASE_BILL' ? 'Pay by' : 'Due date'}><input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field> : <span />}
          </div>
        </div>
        {docType === 'PURCHASE_BILL' && <Field label="Supplier's bill number"><input className={inputCls} value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="As printed on their bill" autoComplete="off" /></Field>}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={gst} disabled={!settings?.gstRegistered && !doc} onChange={(e) => setTaxKind(e.target.checked ? 'GST' : 'NONE')} /> Charge GST {settings && !settings.gstRegistered && <span className="text-xs text-slate-400">(turn on in GST settings first)</span>}</label>
          {gst && <label className="flex items-center gap-2">Prices are <select className="rounded-lg border border-slate-200 px-2 py-1 text-sm" value={priceMode} onChange={(e) => setPriceMode(e.target.value as 'EXCLUSIVE' | 'INCLUSIVE')}><option value="EXCLUSIVE">before GST</option><option value="INCLUSIVE">with GST included</option></select></label>}
        </div>

        <div>
          <ItemSearch onPick={addItem} />
          <div className="mt-3 space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                <div className="col-span-12 sm:col-span-4"><span className="mb-1 block text-xs text-slate-500">Item</span><input className={inputCls} value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} placeholder="Item or service" aria-label="Item name" autoComplete="off" />
                  {l.variants && l.variants.length > 0 ? <select className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" value={l.variantKey} onChange={(e) => setLine(l.key, { variantKey: e.target.value })} aria-label="Size or colour"><option value="">Size / colour…</option>{l.variants.map((v) => <option key={v.variantKey} value={v.variantKey}>{v.variantKey} ({v.onHand} left)</option>)}</select>
                    : <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" value={l.variantKey} onChange={(e) => setLine(l.key, { variantKey: e.target.value })} placeholder="Size / colour (optional)" aria-label="Size or colour" autoComplete="off" />}
                </div>
                <div className="col-span-3 sm:col-span-1"><span className="mb-1 block text-xs text-slate-500">Qty</span><input className={inputCls} inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} aria-label="Quantity" /></div>
                <div className="col-span-5 sm:col-span-2"><span className="mb-1 block text-xs text-slate-500">Rate ₹</span><input className={inputCls} inputMode="decimal" value={l.rate} onChange={(e) => setLine(l.key, { rate: e.target.value })} aria-label="Rate" /></div>
                <div className="col-span-4 sm:col-span-2"><span className="mb-1 block text-xs text-slate-500">Discount ₹</span><input className={inputCls} inputMode="decimal" value={l.discount} onChange={(e) => setLine(l.key, { discount: e.target.value })} aria-label="Line discount" /></div>
                {gst && <div className="col-span-4 sm:col-span-1"><span className="mb-1 block text-xs text-slate-500">GST %</span><input className={inputCls} inputMode="decimal" value={l.gstRate} onChange={(e) => setLine(l.key, { gstRate: e.target.value })} aria-label="GST rate" /></div>}
                {gst && <div className="col-span-4 sm:col-span-1"><span className="mb-1 block text-xs text-slate-500">HSN</span><input className={inputCls} value={l.hsn} onChange={(e) => setLine(l.key, { hsn: e.target.value })} aria-label="HSN or SAC code" autoComplete="off" /></div>}
                <div className="col-span-4 flex justify-end sm:col-span-1"><button type="button" aria-label="Remove line" className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-error-600" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blank(settings?.defaultGstRate ?? 18)]))}><Trash2 className="h-4 w-4" /></button></div>
              </div>
            ))}
            <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600" onClick={() => setLines((ls) => [...ls, blank(settings?.defaultGstRate ?? 18)])}><Plus className="h-4 w-4" /> Add a line by hand</button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3"><Field label="Notes (shown on the document)"><textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="grid grid-cols-2 gap-3"><Field label="Discount ₹ (whole bill)"><input className={inputCls} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field><Field label="Shipping ₹"><input className={inputCls} inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} /></Field></div>
            {previewErr && <p className="text-xs text-error-600">{previewErr}</p>}
            <div className="flex justify-between"><span className="text-slate-500">Items</span><span>{exact ? rupees(exact.subtotalPaise) : '…'}</span></div>
            {gst && exact && (exact.igstPaise ? <div className="flex justify-between"><span className="text-slate-500">IGST</span><span>{rupees(exact.igstPaise)}</span></div> : <><div className="flex justify-between"><span className="text-slate-500">CGST</span><span>{rupees(exact.cgstPaise)}</span></div><div className="flex justify-between"><span className="text-slate-500">SGST</span><span>{rupees(exact.sgstPaise)}</span></div></>)}
            {exact && exact.roundOffPaise !== 0 && <div className="flex justify-between"><span className="text-slate-500">Round off</span><span>{rupees(exact.roundOffPaise)}</span></div>}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Total</span><span>{exact ? rupees(exact.totalPaise) : '…'}</span></div>
          </div>
        </div>
        {err && <Alert>{err}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" loading={busy} onClick={() => save(false)}>Save as draft</Button>
          <Button loading={busy} onClick={() => save(true)}>{docType === 'QUOTE' ? 'Save and send' : 'Save and issue'}</Button>
        </div>
      </div>
    </Modal>
  );
}

/** One document: lines, totals, payments, and every action that is allowed for its state. */
export function DocView({ id, onClose, onChanged, onEdit, onPay, onCredit }: { id: string; onClose: () => void; onChanged: () => void; onEdit: (d: Doc) => void; onPay: (d: Doc) => void; onCredit: (d: Doc) => void }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailTo, setEmailTo] = useState<string | null>(null);

  const load = () => bos<Doc>(`/bos/documents/${id}`).then(setDoc).catch((e) => setErr(plain(e)));
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(path: string, body?: unknown, ok?: string) {
    setErr(''); setMsg(''); setBusy(true);
    try { await bos(path, { method: 'POST', ...(body ? { body } : {}) }); await load(); onChanged(); if (ok) setMsg(ok); } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }
  async function share(kind: 'copy' | 'whatsapp') {
    setErr(''); setMsg('');
    try {
      const s = await bos<{ link: string; text: string; whatsappUrl: string }>(`/bos/documents/${id}/share`);
      if (kind === 'copy') { await navigator.clipboard?.writeText(s.link); setMsg('Link copied. Paste it in any chat or message.'); } else window.open(s.whatsappUrl, '_blank', 'noopener');
    } catch (e) { setErr(plain(e)); }
  }
  async function sendEmail() {
    setErr(''); setMsg(''); setBusy(true);
    try { const r = await bos<{ to: string }>(`/bos/documents/${id}/email`, { method: 'POST', body: emailTo ? { to: emailTo } : {} }); setMsg(`Sent to ${r.to}.`); setEmailTo(null); }
    catch (e) { const m = plain(e); setErr(m); if (/e-mail address/i.test(m)) setEmailTo(''); } finally { setBusy(false); }
  }
  async function reminder() {
    if (!doc?.partyId) return;
    try { const r = await bos<{ whatsappUrl: string; text: string }>(`/bos/parties/${doc.partyId}/reminder`); window.open(r.whatsappUrl, '_blank', 'noopener'); } catch (e) { setErr(plain(e)); }
  }

  if (!doc) return <Modal isOpen onClose={onClose} title="Loading…" maxWidth="max-w-3xl"><div className="p-6 text-sm text-slate-400">{err || 'Loading…'}</div></Modal>;
  const isInv = doc.docType === 'SALES_INVOICE'; const isQuote = doc.docType === 'QUOTE';
  const issued = doc.status !== 'DRAFT';
  const open = doc.status === 'ISSUED' || doc.status === 'PART_PAID';
  const kind = isQuote ? 'Quote' : doc.docType === 'CREDIT_NOTE' ? 'Credit note' : doc.docType === 'PURCHASE_BILL' ? 'Purchase bill' : doc.taxKind === 'GST' ? 'Tax invoice' : 'Bill of supply';
  return (
    <Modal isOpen onClose={onClose} title={`${kind} ${doc.number ?? '(draft)'}`} maxWidth="max-w-3xl">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="text-sm font-semibold text-slate-900">{doc.partyName ?? 'Walk-in customer'}</div><div className="text-xs text-slate-500">{dateShort(doc.docDate)}{doc.dueDate ? ` · due ${dateShort(doc.dueDate)}` : ''}</div></div>
          <StatusPill status={doc.status} quote={isQuote} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Rate</th>{doc.taxKind === 'GST' && <th className="px-3 py-2 text-right">GST</th>}<th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>{(doc.lines ?? []).map((l) => <tr key={l.id} className="border-t border-slate-50"><td className="px-3 py-2">{l.name}{l.variantKey && <span className="ml-1 text-xs text-slate-400">{l.variantKey}</span>}</td><td className="px-3 py-2 text-right">{l.qty}</td><td className="px-3 py-2 text-right">{rupees(l.ratePaise)}</td>{doc.taxKind === 'GST' && <td className="px-3 py-2 text-right">{l.gstRate}%</td>}<td className="px-3 py-2 text-right">{rupees(l.taxablePaise + (doc.priceMode === 'INCLUSIVE' ? l.cgstPaise + l.sgstPaise + l.igstPaise : 0))}</td></tr>)}</tbody></table>
        </div>
        <div className="ml-auto max-w-xs space-y-1 text-sm">
          {doc.discountPaise > 0 && <Row k="Discount" v={`- ${rupees(doc.discountPaise)}`} />}
          {doc.taxKind === 'GST' && <Row k="Taxable value" v={rupees(doc.taxablePaise)} />}
          {doc.taxKind === 'GST' && (doc.igstPaise ? <Row k="IGST" v={rupees(doc.igstPaise)} /> : <><Row k="CGST" v={rupees(doc.cgstPaise)} /><Row k="SGST" v={rupees(doc.sgstPaise)} /></>)}
          {doc.roundOffPaise !== 0 && <Row k="Round off" v={rupees(doc.roundOffPaise)} />}
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold"><span>Total</span><span>{rupees(doc.totalPaise)}</span></div>
          {(isInv || doc.docType === 'PURCHASE_BILL') && issued && doc.paidPaise > 0 && <Row k="Paid" v={rupees(doc.paidPaise)} />}
          {(isInv || doc.docType === 'PURCHASE_BILL') && open && <div className="flex justify-between font-bold text-amber-700"><span>{isInv ? 'Balance due' : 'Still to pay'}</span><span>{rupees(doc.outstandingPaise)}</span></div>}
        </div>
        {(doc.credits?.length ?? 0) > 0 && <p className="text-xs text-slate-500">Credit notes: {doc.credits!.map((c) => `${c.number} (${rupees(c.totalPaise)})`).join(', ')}</p>}
        {err && <Alert>{err}</Alert>}
        {msg && <Alert tone="ok">{msg}</Alert>}
        {emailTo !== null && (
          <div className="flex gap-2"><input className={inputCls} type="email" placeholder="customer@example.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} autoComplete="off" aria-label="E-mail address" /><Button size="sm" loading={busy} onClick={sendEmail}>Send</Button></div>
        )}
        <div className="flex flex-wrap gap-2">
          {doc.status === 'DRAFT' && <Button size="sm" variant="outline" onClick={() => onEdit(doc)}>Edit</Button>}
          {doc.status === 'DRAFT' && <Button size="sm" loading={busy} onClick={() => act(`/bos/documents/${id}/issue`, undefined, 'Issued.')}>{isQuote ? 'Send quote' : 'Issue'}</Button>}
          {issued && <Button size="sm" variant="outline" leftIcon={<Printer className="h-4 w-4" />} onClick={() => openHtml(`/bos/documents/${id}/html`).catch((e) => setErr(plain(e)))}>Print / PDF</Button>}
          {issued && doc.docType !== 'PURCHASE_BILL' && <Button size="sm" variant="outline" leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => share('whatsapp')}>WhatsApp</Button>}
          {issued && doc.docType !== 'PURCHASE_BILL' && <Button size="sm" variant="outline" leftIcon={<Mail className="h-4 w-4" />} onClick={sendEmail}>E-mail</Button>}
          {issued && doc.docType !== 'PURCHASE_BILL' && <Button size="sm" variant="outline" leftIcon={<Copy className="h-4 w-4" />} onClick={() => share('copy')}>Copy link</Button>}
          {isInv && open && <Button size="sm" onClick={() => onPay(doc)}>Receive payment</Button>}
          {doc.docType === 'PURCHASE_BILL' && open && <Button size="sm" onClick={() => onPay(doc)}>Pay supplier</Button>}
          {isInv && open && doc.partyId && <Button size="sm" variant="ghost" onClick={reminder}>Send reminder</Button>}
          {isInv && issued && doc.status !== 'CANCELLED' && <Button size="sm" variant="outline" onClick={() => onCredit(doc)}>Credit note / return</Button>}
          {isQuote && (doc.status === 'ISSUED' || doc.status === 'ACCEPTED') && <>
            <Button size="sm" variant="outline" loading={busy} onClick={() => act(`/bos/documents/${id}/status`, { status: 'ACCEPTED' }, 'Marked accepted.')}>Mark accepted</Button>
            <Button size="sm" variant="outline" loading={busy} onClick={() => act(`/bos/documents/${id}/convert`, { to: 'SALES_INVOICE', issue: true }, 'Invoice created from this quote.')}>Make invoice</Button>
          </>}
          {isQuote && doc.status === 'ISSUED' && <Button size="sm" variant="ghost" loading={busy} onClick={() => act(`/bos/documents/${id}/status`, { status: 'REJECTED' }, 'Marked rejected.')}>Mark rejected</Button>}
          {doc.status === 'DRAFT' && <Button size="sm" variant="ghost" loading={busy} onClick={async () => { setBusy(true); try { await bos(`/bos/documents/${id}`, { method: 'DELETE' }); onChanged(); onClose(); } catch (e) { setErr(plain(e)); } finally { setBusy(false); } }}>Delete draft</Button>}
          {issued && !['CANCELLED', 'CONVERTED', 'REJECTED'].includes(doc.status) && doc.docType !== 'CREDIT_NOTE' && <CancelButton busy={busy} onCancel={(reason) => act(`/bos/documents/${id}/cancel`, { reason }, 'Cancelled. A reversing entry was posted; nothing was deleted.')} />}
          {issued && doc.publicToken && <a className="inline-flex items-center gap-1 px-2 py-2 text-xs text-slate-400 hover:text-slate-600" href={`/d/${doc.publicToken}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /> Customer view</a>}
        </div>
      </div>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between"><span className="text-slate-500">{k}</span><span>{v}</span></div>; }

function CancelButton({ busy, onCancel }: { busy: boolean; onCancel: (reason: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  if (!asking) return <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>Cancel…</Button>;
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-error-100 bg-error-50/50 p-2">
      <input className={`${inputCls} flex-1`} placeholder="Why is it being cancelled? (a few words)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for cancelling" autoComplete="off" />
      <Button size="sm" loading={busy} disabled={reason.trim().length < 3} onClick={() => onCancel(reason.trim())}>Cancel it</Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Keep it</Button>
    </div>
  );
}

/** Receive money against one invoice (part payments allowed) or as an advance. */
export function PaymentModal({ doc, party, kind: kindProp, onClose, onDone }: { doc?: Doc | null; party?: { id: string; name: string } | null; kind?: 'RECEIPT' | 'PAYMENT_OUT'; onClose: () => void; onDone: () => void }) {
  const kind = kindProp ?? (doc?.docType === 'PURCHASE_BILL' ? 'PAYMENT_OUT' : 'RECEIPT');
  const out = kind === 'PAYMENT_OUT';
  const pid = doc?.partyId ?? party?.id ?? null;
  const [amount, setAmount] = useState(doc ? String(doc.outstandingPaise / 100) : '');
  const [mode, setMode] = useState('UPI');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    setErr(''); setBusy(true);
    try {
      await bos('/bos/payments', { method: 'POST', body: { kind, ...(pid ? { partyId: pid } : { partyName: doc?.partyName ?? undefined }), mode, amount: Number(amount), reference: ref.trim() || undefined, ...(doc ? { allocations: [{ documentId: doc.id, amount: Math.min(Number(amount), doc.outstandingPaise / 100) }] } : { auto: true }), idempotencyKey: `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } });
      onDone();
    } catch (e) { setErr(plain(e, 'Enter the amount received.')); } finally { setBusy(false); }
  }
  return (
    <Modal isOpen onClose={onClose} title={out ? (doc ? `Pay supplier for ${doc.number}` : `Pay ${party?.name ?? 'supplier'}`) : doc ? `Receive payment for ${doc.number}` : `Receive payment from ${party?.name ?? 'customer'}`} maxWidth="max-w-md">
      <div className="space-y-3 p-4">
        {doc && <p className="text-sm text-slate-500">Balance due {rupees(doc.outstandingPaise)}. You can enter less for a part payment, or more to keep the extra as an advance.</p>}
        {!doc && <p className="text-sm text-slate-500">The money is set against this customer&apos;s oldest unpaid invoices first. Anything left over is kept as an advance.</p>}
        <Field label={out ? 'Amount paid ₹' : 'Amount received ₹'}><input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" /></Field>
        <Field label="How was it paid?"><select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="BANK">Bank transfer</option><option value="CARD">Card</option><option value="CHEQUE">Cheque</option></select></Field>
        <Field label="Reference (optional)"><input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UPI reference, cheque number…" autoComplete="off" /></Field>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{out ? 'Save payment' : 'Save payment'}</Button></div>
      </div>
    </Modal>
  );
}

/** A credit note for all or part of an invoice. A line can never be credited for more than was sold. */
export function CreditModal({ doc, onClose, onDone }: { doc: Doc; onClose: () => void; onDone: () => void }) {
  const [full, setFull] = useState<Doc | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { bos<Doc>(`/bos/documents/${doc.id}`).then(setFull).catch((e) => setErr(plain(e))); }, [doc.id]);
  async function save() {
    setErr('');
    const lines = Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([refLineId, v]) => ({ refLineId, qty: Number(v), restock: restock[refLineId] !== false }));
    if (!lines.length) { setErr('Enter how many of at least one item are being returned or credited.'); return; }
    setBusy(true);
    try { await bos(`/bos/documents/${doc.id}/credit-note`, { method: 'POST', body: { lines, reason: reason.trim() || 'Return', issue: true } }); onDone(); } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }
  return (
    <Modal isOpen onClose={onClose} title={`Credit note for ${doc.number}`} maxWidth="max-w-xl">
      <div className="space-y-3 p-4">
        <p className="text-sm text-slate-500">Enter how many of each item are being returned. The tax and the customer&apos;s balance are reversed for exactly those; ticked items go back into stock.</p>
        {(full?.lines ?? []).map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-2 text-sm">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{l.name}{l.variantKey && <span className="ml-1 text-xs text-slate-400">{l.variantKey}</span>}</div><div className="text-xs text-slate-400">Sold {l.qty} at {rupees(l.ratePaise)}</div></div>
            <input className="w-20 rounded-lg border border-slate-200 px-2 py-1.5" inputMode="decimal" placeholder="Qty" value={qty[l.id] ?? ''} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} aria-label={`Quantity to credit for ${l.name}`} />
            {l.itemId && <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" checked={restock[l.id] !== false} onChange={(e) => setRestock({ ...restock, [l.id]: e.target.checked })} /> back in stock</label>}
          </div>
        ))}
        <Field label="Reason"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer returned 1 pair" autoComplete="off" /></Field>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Close</Button><Button loading={busy} onClick={save}>Issue credit note</Button></div>
      </div>
    </Modal>
  );
}
