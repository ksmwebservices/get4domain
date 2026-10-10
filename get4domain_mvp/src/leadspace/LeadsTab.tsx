'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, MessageCircle, Phone } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { plain, useLoad, dateShort } from '@/bos/client';
import { Alert, Empty, ErrorView, Field, Spinner, inputCls } from '@/bos/ui';
import { downloadFile } from '@/bos/ui';
import { planDisplayName } from '@/lib/nav.generated';
import { EVENT_LABEL, STATUS_LABEL, ago, istDay, ls, telHref, waHref, type LeadRow, type Summary } from './ls';
import type { TabKey } from './LeadSpaceApp';

const TYPE_CHIPS = ['', 'ENQUIRY', 'BOOKING', 'APPOINTMENT', 'SITE_VISIT', 'CART_ORDER'];
const STATUS_CHIPS = ['', 'DELIVERED', 'CONTACTED', 'WON', 'LOST', 'HELD'];
const DISPUTE_REASONS: [string, string][] = [['WRONG_NUMBER', 'Wrong number'], ['DUPLICATE', 'Same customer again'], ['SPAM', 'Spam or a joke'], ['NOT_REAL', 'Not a real customer'], ['OTHER', 'Something else']];

const chip = (on: boolean): string => `whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium ${on ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`;

function detailLines(l: LeadRow): string[] {
  const p = l.payload ?? {};
  const out: string[] = [];
  if (p.message) out.push(String(p.message));
  if (p.service) out.push(`Service: ${String(p.service)}`);
  if (p.property) out.push(`Property: ${String(p.property)}`);
  if (p.date) out.push(`Date: ${String(p.date)}${p.time ? `, ${String(p.time)}` : ''}`);
  if (Array.isArray(p.items)) out.push(...(p.items as { name: string; qty: number }[]).map((i) => `${i.qty} x ${i.name}`));
  if (p.address) out.push(`Deliver to: ${String(p.address)}`);
  if (p.notes) out.push(`Notes: ${String(p.notes)}`);
  return out;
}

export default function LeadsTab({ go, onChange }: { go: (t: TabKey) => void; onChange: () => void }) {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [callsOnly, setCallsOnly] = useState(false);
  const [open, setOpen] = useState<LeadRow | null>(null);
  const [dispute, setDispute] = useState<LeadRow | null>(null);
  const [err, setErr] = useState('');
  const qs = new URLSearchParams({ ...(type ? { type } : {}), ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}), ...(callsOnly ? { calls: 'due' } : {}) }).toString();
  const list = useLoad(() => ls<{ total: number; rows: LeadRow[] }>(`/leadspace/leads${qs ? `?${qs}` : ''}`), [qs]);
  const sum = useLoad(() => ls<Summary & { upgradeSuggested?: boolean }>('/leadspace/summary'), []);

  async function setLeadStatus(l: LeadRow, s: string): Promise<void> {
    setErr('');
    try { await ls(`/leadspace/leads/${l.id}/status`, { method: 'PUT', body: { status: s } }); list.reload(); onChange(); setOpen(null); } catch (e) { setErr(plain(e)); }
  }
  async function setCallback(l: LeadRow, date: string | null): Promise<void> {
    setErr('');
    try { const r = await ls<LeadRow>(`/leadspace/leads/${l.id}/callback`, { method: 'PUT', body: { date } }); setOpen(r); list.reload(); sum.reload(); onChange(); } catch (e) { setErr(plain(e)); }
  }
  async function decide(l: LeadRow, decision: 'CONFIRMED' | 'DECLINED'): Promise<void> {
    setErr('');
    try { await ls(`/leadspace/leads/${l.id}/order`, { method: 'PUT', body: { decision } }); list.reload(); onChange(); setOpen(null); } catch (e) { setErr(plain(e)); }
  }

  if (list.loading && !list.data) return <Spinner />;
  if (list.error && !list.data) return <ErrorView error={list.error} />;
  const rows = list.data?.rows ?? [];
  const held = rows.filter((r) => r.held).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">{list.data?.total ?? 0} in this view. Call or message them first: the one who replies first usually gets the work.</p>
        </div>
        <Button size="sm" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => { setErr(''); downloadFile('/leadspace/leads/export.csv', 'leadspace-leads.csv').catch((e: unknown) => setErr(plain(e))); }}>CSV</Button>
      </div>

      {err && <Alert>{err}</Alert>}

      {(sum.data?.ordersWaiting ?? 0) > 0 && (
        <Card padded className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">{sum.data?.ordersWaiting} order{sum.data?.ordersWaiting === 1 ? ' is' : 's are'} waiting for you to confirm or decline{sum.data?.oldestWaitingAt ? `. The oldest came ${ago(sum.data.oldestWaitingAt)}` : ''}. Customers expect an answer within a few hours.</p>
          <div className="mt-2"><Button size="sm" onClick={() => { setType('CART_ORDER'); setStatus(''); setCallsOnly(false); }}>Show these orders</Button></div>
        </Card>
      )}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Calls to make">
        <button className={chip(callsOnly)} onClick={() => setCallsOnly((x) => !x)} aria-pressed={callsOnly}>Today&apos;s calls{(sum.data?.callsDue ?? 0) > 0 ? ` (${sum.data?.callsDue})` : ''}</button>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Kind of lead">
        {TYPE_CHIPS.map((t) => <button key={t || 'all'} className={chip(type === t)} onClick={() => setType(t)}>{t ? EVENT_LABEL[t] : 'All'}</button>)}
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Status">
        {STATUS_CHIPS.map((s) => <button key={s || 'any'} className={chip(status === s)} onClick={() => setStatus(s)}>{s ? STATUS_LABEL[s] : 'Any status'}</button>)}
      </div>
      <input className={inputCls} placeholder="Search by name or number" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search leads" autoComplete="off" />

      {held > 0 && (
        <Card padded className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">{held} customer{held === 1 ? ' is' : 's are'} waiting in this list. Their name, message and full number stay hidden until you refill your wallet; the oldest are released first.</p>
          <div className="mt-2"><Button size="sm" onClick={() => go('wallet')}>Refill wallet</Button></div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Empty title="No leads here yet">When a customer asks for you through your page and verifies their number on WhatsApp, they appear here.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => (
            <li key={l.id}>
              <button onClick={() => setOpen(l)} className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-primary-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{l.customerName}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{l.customerPhone} · {l.typeLabel} · {ago(l.createdAt)}</div>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${l.held ? 'bg-amber-50 text-amber-700' : l.status === 'WON' ? 'bg-success-50 text-success-700' : l.status === 'DELIVERED' ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>{STATUS_LABEL[l.status] ?? l.status}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-700">{l.summary}</p>
                {l.callbackAt && !l.held ? <p className="mt-1 text-xs font-medium text-primary-700">Call again on {dateShort(istDay(l.callbackAt))}</p> : null}
                {l.type === 'CART_ORDER' && !l.held && <p className="mt-1 text-xs font-medium text-slate-500">Order: {l.orderDecision === 'CONFIRMED' ? 'confirmed' : l.orderDecision === 'DECLINED' ? 'declined' : 'waiting for you to confirm'}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {sum.data?.upgradeSuggested && (
        <Card padded className="border-secondary-200 bg-secondary-50">
          <p className="text-sm text-slate-700">Want these leads to become customers, quotes and GST invoices in a few taps? {planDisplayName('WORKSPACE')} adds that.</p>
          <div className="mt-2"><Link href="/dashboard/go-live" className="text-sm font-semibold text-primary-700 underline">See {planDisplayName('WORKSPACE')}</Link></div>
        </Card>
      )}

      <Modal isOpen={open !== null} onClose={() => setOpen(null)} title={open?.held ? 'Customer waiting' : open?.customerName} maxWidth="max-w-md">
        {open && (
          <div className="space-y-3">
            {open.held ? (
              <>
                <p className="text-sm text-slate-600">This customer verified their number and is waiting for you: <strong>{open.customerPhone}</strong>. Refill your wallet to see their name and request. {EVENT_LABEL[open.type]} are charged when you see them, not before.</p>
                <Button fullWidth onClick={() => { setOpen(null); go('wallet'); }}>Refill wallet</Button>
              </>
            ) : (
              <>
                <div className="text-sm text-slate-500">{open.typeLabel} · {dateShort(open.createdAt)}</div>
                <ul className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">{detailLines(open).map((t, i) => <li key={i}>{t}</li>)}</ul>
                <div className="grid grid-cols-2 gap-2">
                  <a href={telHref(open.customerPhone)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white"><Phone className="h-4 w-4" /> Call</a>
                  <a href={waHref(open.customerPhone, `Hello ${open.customerName.split(' ')[0]}, this is about your request.`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                </div>
                {open.status !== 'CREDITED' && open.status !== 'WON' && open.status !== 'LOST' ? (
                  <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
                    <label className="flex-1 text-sm text-slate-700">
                      <span className="mb-1 block text-xs font-medium text-slate-500">Call again on</span>
                      <input type="date" className={inputCls} min={new Date().toISOString().slice(0, 10)} value={open.callbackAt ? istDay(open.callbackAt) : ''} onChange={(e) => { if (e.target.value) void setCallback(open, e.target.value); }} />
                    </label>
                    {open.callbackAt ? <Button size="sm" variant="outline" onClick={() => setCallback(open, null)}>Clear</Button> : null}
                  </div>
                ) : null}
                {open.type === 'CART_ORDER' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => decide(open, 'CONFIRMED')} disabled={open.orderDecision === 'CONFIRMED'}>Confirm order</Button>
                    <Button variant="outline" onClick={() => decide(open, 'DECLINED')} disabled={open.orderDecision === 'DECLINED'}>Decline</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setLeadStatus(open, 'CONTACTED')}>Contacted</Button>
                    <Button size="sm" onClick={() => setLeadStatus(open, 'WON')}>Won</Button>
                    <Button size="sm" variant="outline" onClick={() => setLeadStatus(open, 'LOST')}>Lost</Button>
                  </div>
                )}
                {open.priceChargedPaise > 0 && !open.disputeStatus && open.status !== 'CREDITED' && (
                  <button className="w-full text-center text-sm text-slate-500 underline" onClick={() => { setDispute(open); setOpen(null); }}>This lead is not valid (wrong number, spam)</button>
                )}
                {open.disputeStatus === 'OPEN' && <Alert tone="info">Our team is reviewing this lead. If it is not valid, the amount comes back to your wallet.</Alert>}
                {open.status === 'CREDITED' && <Alert tone="ok">This lead was credited back to your wallet.</Alert>}
              </>
            )}
          </div>
        )}
      </Modal>

      <DisputeModal lead={dispute} onClose={() => setDispute(null)} onDone={() => { setDispute(null); list.reload(); onChange(); }} />
    </div>
  );
}

function DisputeModal({ lead, onClose, onDone }: { lead: LeadRow | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('WRONG_NUMBER');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function send(): Promise<void> {
    if (!lead) return;
    setBusy(true); setErr('');
    try { await ls(`/leadspace/leads/${lead.id}/dispute`, { method: 'POST', body: { reason, ...(note.trim() ? { note: note.trim() } : {}) } }); onDone(); } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }
  return (
    <Modal isOpen={lead !== null} onClose={onClose} title="Report this lead" maxWidth="max-w-md">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Tell us what is wrong. Our team checks it and, if it is not valid, the amount goes back to your wallet.</p>
        <Field label="What is wrong?"><select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>{DISPUTE_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Anything we should know? (optional)"><textarea className={inputCls} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {err && <Alert>{err}</Alert>}
        <Button fullWidth loading={busy} onClick={send}>Send to our team</Button>
      </div>
    </Modal>
  );
}
