'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, Plus, Trash2, Save, Send, Zap } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import {
  commerceApi, arrangementsApi, type ArrangementSummary, rupees, fmtDate, CYCLE_LABEL, GST_LABEL, PLAN_LABEL,
  type Channel, type Cycle, type DealSpec, type GstMode, type InvoiceRow, type PlanKey, type PricedLine, type Totals,
} from '@/lib/commerce';
import { ErrorBox, Field, PayLinkBox, Pill, cardCls, inputCls, msg, selectCls } from '@/components/admin/commerce-ui';

interface VendorOpt { id: string; businessName: string; name: string; subdomain: string | null }
interface AddonRow { id: number; kind: 'ADDON' | 'CUSTOM'; label: string; rupees: string; qty: string }
interface Preview { lines: PricedLine[]; totals: Totals; bigDiscount: boolean; months: number | null; discountReason: string | null; promo: { code: string } | null; aiCredit: { computedPaise: number; paise: number; overridden: boolean; annualPaise: number } | null }
interface DealRow { id: string; status: string; planKey: PlanKey | null; billingCycle: Cycle | null; listAmountPaise: number; discountPaise: number; prospectBusiness: string | null; vendorId: string | null; createdAt: string; gstMode: GstMode; notes: string | null }

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'RAZORPAY', label: 'Razorpay (card / UPI / netbanking)' },
  { key: 'UPI_QR', label: 'UPI QR (manual confirmation)' },
  { key: 'OFFLINE', label: 'Bank transfer / offline' },
];
let addonSeq = 1;

function DealBuilder() {
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [target, setTarget] = useState<'existing' | 'prospect'>('existing');
  const [vendorId, setVendorId] = useState(searchParams.get('vendor') ?? '');
  const [prospect, setProspect] = useState({ name: '', phone: '', email: '', business: '', demoSubdomain: '' });
  const [planKey, setPlanKey] = useState<PlanKey | ''>('WORKSPACE');
  const [cycle, setCycle] = useState<Cycle>('ANNUAL');
  const [customMonths, setCustomMonths] = useState('3');
  const [kind, setKind] = useState<'ADDON' | 'MANAGED_SERVICE'>('ADDON');
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [discMode, setDiscMode] = useState<'NONE' | 'PERCENT' | 'FLAT' | 'PROMO'>('NONE');
  const [discValue, setDiscValue] = useState('');
  const [discReason, setDiscReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [gstMode, setGstMode] = useState<GstMode>('EXCLUSIVE');
  const [graceDays, setGraceDays] = useState('7');
  const [channels, setChannels] = useState<Channel[]>(['RAZORPAY']);
  // Standard rule: annual, Razorpay only, GST on top. A half-year term, no GST or a manual channel exists only while a special arrangement is in force.
  const [arrangement, setArrangement] = useState<ArrangementSummary | null>(null);
  const [expiry, setExpiry] = useState('14');
  const [allowPromo, setAllowPromo] = useState(false);
  const [allowStack, setAllowStack] = useState(false);
  const [dueDays, setDueDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [sendNow, setSendNow] = useState(false);
  // AI Studio credit (₹): shows the server's prorated amount until KSM types one; typing marks it as an override.
  const [aiCredit, setAiCredit] = useState('');
  const [aiCreditEdited, setAiCreditEdited] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState<'' | 'draft' | 'invoice' | 'activate'>('');
  const [error, setError] = useState('');
  // set when the server refuses a second activation: what blocked it, so we can link to it and offer a typed-reason override
  const [blocker, setBlocker] = useState<null | { invoiceNumber?: string; invoiceStatus?: string; termId?: string }>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [result, setResult] = useState<{ invoice: InvoiceRow; payLink: string; activated: boolean } | null>(null);

  const loadDeals = useCallback(() => commerceApi.listDeals().then((r) => setDeals(r.data ?? [])).catch(() => undefined), []);
  useEffect(() => {
    api.getVendors().then((r) => setVendors((r.data ?? []) as VendorOpt[])).catch(() => undefined);
    void loadDeals();
  }, [loadDeals]);

  // Changing the plan, billing cycle or number of months re-prefills the credit from the server's rule.
  useEffect(() => { setAiCreditEdited(false); setAiCredit(''); }, [planKey, cycle, customMonths]);

  const aiCreditPaise = aiCreditEdited && aiCredit.trim() !== '' ? Math.round(Number(aiCredit) * 100) : undefined;
  const aiCreditInvalid = aiCreditPaise !== undefined && (!Number.isFinite(aiCreditPaise) || aiCreditPaise < 0 || aiCreditPaise > 500000);

  const spec = useMemo<DealSpec>(() => {
    const s: DealSpec = {
      gstMode, graceDays: Number(graceDays) || 0, allowedChannels: channels, linkExpiryDays: Number(expiry) || 14,
      allowPromoEntry: allowPromo, allowPromoStacking: allowStack, notes: notes.trim() || undefined,
    };
    if (target === 'existing') s.vendorId = vendorId || undefined;
    else s.prospect = { ...prospect, demoSubdomain: prospect.demoSubdomain.trim().toLowerCase() || undefined };
    if (planKey) { s.planKey = planKey; s.billingCycle = cycle; if (cycle === 'CUSTOM_MONTHS') s.customMonths = Number(customMonths) || undefined; }
    else s.kind = kind;
    const lines = addons.filter((a) => a.label.trim() && Number(a.rupees) > 0);
    if (lines.length) s.addons = lines.map((a) => ({ kind: a.kind, label: a.label.trim(), amountPaise: Math.round(Number(a.rupees) * 100), qty: Number(a.qty) || 1 }));
    if (discMode === 'PERCENT' || discMode === 'FLAT') s.discount = { mode: discMode, value: discMode === 'FLAT' ? Math.round(Number(discValue) * 100) : Number(discValue), reason: discReason, confirm: confirmText || undefined };
    else if (discMode === 'PROMO') { s.discount = { mode: 'PROMO' }; s.promoCode = promoCode; }
    if (dueDays !== '') s.paymentDueDays = Number(dueDays);
    if (planKey && aiCreditPaise !== undefined && !aiCreditInvalid) s.aiCreditPaise = aiCreditPaise;
    return s;
  }, [target, vendorId, prospect, planKey, cycle, customMonths, kind, addons, discMode, discValue, discReason, confirmText, promoCode, gstMode, graceDays, channels, expiry, allowPromo, allowStack, dueDays, notes, aiCreditPaise, aiCreditInvalid]);

  // Live totals: the SERVER prices it (same code path that issues the invoice), debounced.
  const seq = useRef(0);
  useEffect(() => {
    if (!planKey && !spec.addons?.length) { setPreview(null); setPreviewError(''); return; }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      commerceApi.preview(spec)
        .then((r) => { if (mine === seq.current) { setPreview(r.data as Preview); setPreviewError(''); } })
        .catch((e) => { if (mine === seq.current) { setPreview(null); setPreviewError(msg(e)); } });
    }, 400);
    return () => clearTimeout(t);
  }, [spec, planKey]);

  const bigNeedsConfirm = preview?.bigDiscount && (discMode === 'PERCENT' || discMode === 'FLAT');
  const targetOk = target === 'existing' ? Boolean(vendorId) : Boolean(prospect.name.trim() && prospect.business.trim() && prospect.email.trim());
  const canIssue = targetOk && Boolean(preview) && channels.length > 0 && !aiCreditInvalid && (!bigNeedsConfirm || confirmText === 'CONFIRM');

  async function submit(mode: 'draft' | 'invoice' | 'activate', override?: string) {
    setError(''); setBlocker(null); setBusy(mode);
    try {
      if (mode === 'draft') { await commerceApi.saveDraft(spec); await loadDeals(); setError(''); setResult(null); alert('Draft saved.'); return; }
      if (mode === 'activate' && !window.confirm(`Activate now?\n\nAll plan features switch on immediately and payment is due in ${dueDays} day(s). If it is not paid by then (+${graceDays} grace days) the account lapses.`)) return;
      const r = await commerceApi.createInvoice({ ...spec, activateNow: mode === 'activate', sendNow, ...(override ? { overrideReason: override } : {}) });
      setResult({ ...r.data, activated: mode === 'activate' });
      setOverrideReason('');
      await loadDeals();
    } catch (e) {
      setError(msg(e));
      const d = (e as { status?: number; data?: { invoiceNumber?: string; invoiceStatus?: string; termId?: string } | null }).data;
      if ((e as { status?: number }).status === 409 && d && (d.invoiceNumber || d.termId)) setBlocker(d);
    }
    finally { setBusy(''); }
  }

  useEffect(() => {
    if (target !== 'existing' || !vendorId) { setArrangement(null); return; }
    let alive = true;
    arrangementsApi.forVendor(vendorId).then((r) => {
      if (!alive) return;
      const a = r.data?.active ?? null;
      setArrangement(a);
      // Defaults from the arrangement, pre-filled once per client; KSM can still change them within what it allows.
      if (a) {
        setGstMode(a.gstMode === 'NONE' ? 'NONE' : 'EXCLUSIVE');
        setChannels(['RAZORPAY', ...(a.allowedChannels as Channel[])]);
        if (a.allowHalfYear) setCycle('HALF_YEARLY');
      } else {
        setGstMode((g) => (g === 'NONE' ? 'EXCLUSIVE' : g));
        setChannels((c) => c.filter((x) => x === 'RAZORPAY'));
        setCycle((c) => (c === 'HALF_YEARLY' ? 'ANNUAL' : c));
      }
    }).catch(() => { if (alive) setArrangement(null); });
    return () => { alive = false; };
  }, [target, vendorId]);

  const toggleChannel = (c: Channel) => setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {/* WHO */}
          <section className={cardCls}>
            <h3 className="mb-3 text-sm font-bold text-white">1 · Who is this for?</h3>
            <div className="mb-4 inline-flex rounded-xl bg-slate-800 p-1" role="tablist">
              {(['existing', 'prospect'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={target === t} onClick={() => setTarget(t)} className={`rounded-lg px-4 py-1.5 text-sm font-medium ${target === t ? 'bg-primary-600 text-white' : 'text-slate-400'}`}>{t === 'existing' ? 'Existing vendor' : 'New prospect'}</button>
              ))}
            </div>
            {target === 'existing' ? (
              <Field label="Vendor">
                <select className={selectCls} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="">Select a vendor…</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.businessName} — {v.name}{v.subdomain ? ` (${v.subdomain})` : ''}</option>)}
                </select>
              </Field>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contact name *"><input className={inputCls} value={prospect.name} onChange={(e) => setProspect({ ...prospect, name: e.target.value })} /></Field>
                <Field label="Business *"><input className={inputCls} value={prospect.business} onChange={(e) => setProspect({ ...prospect, business: e.target.value })} /></Field>
                <Field label="Email * (their login)"><input type="email" className={inputCls} value={prospect.email} onChange={(e) => setProspect({ ...prospect, email: e.target.value })} /></Field>
                <Field label="Phone / WhatsApp"><input className={inputCls} value={prospect.phone} onChange={(e) => setProspect({ ...prospect, phone: e.target.value })} /></Field>
                <Field label="Demo subdomain" hint="e.g. acme → acme.get4domain.com. Stays hidden until the activation invoice is paid." className="sm:col-span-2"><input className={inputCls} value={prospect.demoSubdomain} onChange={(e) => setProspect({ ...prospect, demoSubdomain: e.target.value })} /></Field>
              </div>
            )}
          </section>

          {arrangement && (
            <div role="status" className="rounded-2xl border border-primary-500/30 bg-primary-500/10 p-4 text-sm text-primary-100">
              <strong>Special arrangement in force until {fmtDate(arrangement.validUntil)}.</strong> Half-year {arrangement.allowHalfYear ? 'allowed' : 'not allowed'} · GST {arrangement.gstMode === 'NONE' ? 'not charged' : '18% on top'} · extra channels: {arrangement.allowedChannels.length ? arrangement.allowedChannels.join(', ') : 'none'}. Defaults below are pre-filled from it.
              <span className="mt-1 block text-xs text-primary-200/80">{arrangement.reason}</span>
            </div>
          )}
          {target === 'existing' && vendorId && !arrangement && (
            <p className="text-xs text-slate-500">Standard terms for this client: annual, Razorpay only, GST 18% on top. Half-year, no GST or manual QR needs a special arrangement (Admin &gt; Pricing &gt; Special arrangements).</p>
          )}

          {/* WHAT */}
          <section className={cardCls}>
            <h3 className="mb-3 text-sm font-bold text-white">2 · What are they buying?</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="DomainApp plan" hint="List price comes from the platform price list (annual ÷ 12 × months; a half-year term lists at 55% of annual).">
                <select className={selectCls} value={planKey} onChange={(e) => setPlanKey(e.target.value as PlanKey | '')}>
                  <option value="">No plan (add-ons only)</option>
                  <option value="WORKSPACE">{PLAN_LABEL.WORKSPACE}</option>
                  <option value="BOS">{PLAN_LABEL.BOS}</option>
                </select>
              </Field>
              {planKey ? (
                <>
                  <Field label="Billing cycle">
                    <select className={selectCls} value={cycle} onChange={(e) => setCycle(e.target.value as Cycle)}>
                      {(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => <option key={c} value={c} disabled={c === 'HALF_YEARLY' && !arrangement?.allowHalfYear}>{CYCLE_LABEL[c]}{c === 'HALF_YEARLY' && !arrangement?.allowHalfYear ? ' (needs a special arrangement)' : ''}</option>)}
                    </select>
                  </Field>
                  {cycle === 'CUSTOM_MONTHS' && <Field label="Months (1–60)"><input type="number" min={1} max={60} className={inputCls} value={customMonths} onChange={(e) => setCustomMonths(e.target.value)} /></Field>}
                </>
              ) : (
                <Field label="Invoice type">
                  <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as 'ADDON' | 'MANAGED_SERVICE')}>
                    <option value="ADDON">Add-on (e.g. LeadSpace Managed Ads)</option>
                    <option value="MANAGED_SERVICE">Managed Service</option>
                  </select>
                </Field>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">Add-ons &amp; custom lines</span>
                <button type="button" onClick={() => setAddons([...addons, { id: addonSeq++, kind: 'ADDON', label: '', rupees: '', qty: '1' }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-300"><Plus className="h-3.5 w-3.5" />Add line</button>
              </div>
              {addons.map((a) => (
                <div key={a.id} className="grid grid-cols-[1fr_6.5rem_3.5rem_2rem] gap-2 sm:grid-cols-[8rem_1fr_7rem_4rem_2rem]">
                  <select className={`${selectCls} hidden sm:block`} value={a.kind} onChange={(e) => setAddons(addons.map((x) => x.id === a.id ? { ...x, kind: e.target.value as 'ADDON' | 'CUSTOM' } : x))}><option value="ADDON">Add-on</option><option value="CUSTOM">Custom</option></select>
                  <input className={inputCls} placeholder="Description (e.g. LeadSpace Managed Ads — first month)" value={a.label} onChange={(e) => setAddons(addons.map((x) => x.id === a.id ? { ...x, label: e.target.value } : x))} />
                  <input className={inputCls} inputMode="decimal" placeholder="₹ amount" value={a.rupees} onChange={(e) => setAddons(addons.map((x) => x.id === a.id ? { ...x, rupees: e.target.value.replace(/[^0-9.]/g, '') } : x))} />
                  <input className={inputCls} inputMode="numeric" placeholder="Qty" value={a.qty} onChange={(e) => setAddons(addons.map((x) => x.id === a.id ? { ...x, qty: e.target.value.replace(/\D/g, '') } : x))} />
                  <button type="button" onClick={() => setAddons(addons.filter((x) => x.id !== a.id))} aria-label="Remove line" className="rounded-lg text-slate-500 hover:text-error-400"><Trash2 className="mx-auto h-4 w-4" /></button>
                </div>
              ))}
              <p className="text-[11px] text-slate-500">Amounts on add-on/custom lines are exactly what you enter here (excl. GST for “GST on top”). Payers can never change any amount.</p>
            </div>
          </section>

          {/* DISCOUNT */}
          <section className={cardCls}>
            <h3 className="mb-3 text-sm font-bold text-white">3 · Discount</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Type">
                <select className={selectCls} value={discMode} onChange={(e) => { setDiscMode(e.target.value as typeof discMode); setConfirmText(''); }}>
                  <option value="NONE">No discount</option><option value="PERCENT">Percent off</option><option value="FLAT">Flat amount off</option><option value="PROMO">Apply a promo code</option>
                </select>
              </Field>
              {(discMode === 'PERCENT' || discMode === 'FLAT') && <Field label={discMode === 'PERCENT' ? 'Percent' : 'Amount (₹)'}><input inputMode="decimal" className={inputCls} value={discValue} onChange={(e) => setDiscValue(e.target.value.replace(/[^0-9.]/g, ''))} /></Field>}
              {discMode === 'PROMO' && <Field label="Promo code"><input className={inputCls} value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} /></Field>}
            </div>
            {(discMode === 'PERCENT' || discMode === 'FLAT') && (
              <div className="mt-3 space-y-3">
                <Field label="Reason * (audit-logged)" hint="Required for every manual discount."><input className={inputCls} value={discReason} onChange={(e) => setDiscReason(e.target.value)} maxLength={300} /></Field>
                {preview?.bigDiscount && (
                  <div className="rounded-xl border border-warning-500/40 bg-warning-500/10 p-3">
                    <p className="text-xs font-semibold text-warning-300">This discount is over 20% of the subtotal. Type CONFIRM to proceed.</p>
                    <input className={`${inputCls} mt-2 max-w-[10rem] font-mono`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CONFIRM" aria-label="Type CONFIRM" />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* TERMS */}
          <section className={cardCls}>
            <h3 className="mb-3 text-sm font-bold text-white">4 · Terms &amp; how they can pay</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="GST">
                <select className={selectCls} value={gstMode} onChange={(e) => setGstMode(e.target.value as GstMode)}>
                  {(Object.keys(GST_LABEL) as GstMode[]).map((g) => <option key={g} value={g} disabled={g === 'NONE' && arrangement?.gstMode !== 'NONE'}>{GST_LABEL[g]}{g === 'NONE' && arrangement?.gstMode !== 'NONE' ? ' (needs a special arrangement)' : ''}</option>)}
                </select>
              </Field>
              <Field label="Grace days after due"><input type="number" min={0} max={90} className={inputCls} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} /></Field>
              <Field label="Link expires in (days)"><input type="number" min={1} max={180} className={inputCls} value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
            </div>
            <div className="mt-4">
              <span className="mb-1 block text-xs font-semibold text-slate-400">Allowed payment channels</span>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => (
                  <label key={c.key} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${channels.includes(c.key) ? 'border-primary-500/50 bg-primary-500/10 text-primary-200' : 'border-slate-700 text-slate-400'}`}>
                    <input type="checkbox" className="accent-primary-500" checked={channels.includes(c.key)} disabled={c.key !== 'RAZORPAY' && !arrangement?.allowedChannels.includes(c.key)} onChange={() => toggleChannel(c.key)} />{c.label}{c.key !== 'RAZORPAY' && !arrangement?.allowedChannels.includes(c.key) ? ' (needs a special arrangement)' : ''}
                  </label>
                ))}
              </div>
            </div>
            {planKey && (
              <div className="mt-4 rounded-xl border border-slate-700 p-3.5">
                <Field label="AI Studio credit (₹)" hint={preview?.aiCredit ? `Prorated for this term: ${rupees(preview.aiCredit.computedPaise)}${preview.months ? ` (${preview.months}-month term of the annual ${rupees(preview.aiCredit.annualPaise)} credit)` : ''}. Edit to override (₹0–₹5,000). It is a one-time wallet credit for the vendor, not a charge, and does not appear on the invoice.` : 'Choose the plan and cycle to see the prorated credit.'}>
                  <div className="flex items-center gap-2">
                    <input className={inputCls} inputMode="decimal" value={aiCreditEdited ? aiCredit : preview?.aiCredit ? String(preview.aiCredit.computedPaise / 100) : ''} placeholder="—"
                      onChange={(e) => { setAiCreditEdited(true); setAiCredit(e.target.value.replace(/[^0-9.]/g, '')); }} />
                    {aiCreditEdited && <button type="button" className="whitespace-nowrap text-xs font-semibold text-primary-300 hover:underline" onClick={() => { setAiCreditEdited(false); setAiCredit(''); }}>Reset to prorated</button>}
                  </div>
                </Field>
                {aiCreditInvalid && <p role="alert" className="mt-1 text-xs text-error-400">Enter an amount from ₹0 to ₹5,000.</p>}
                {preview?.aiCredit?.overridden && !aiCreditInvalid && <p className="mt-1 text-xs text-warning-300">Different from the prorated {rupees(preview.aiCredit.computedPaise)} — this override is recorded in the audit log.</p>}
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-primary-500" checked={allowPromo} onChange={(e) => setAllowPromo(e.target.checked)} />Let the payer enter a promo code</label>
              <label className={`flex items-center gap-2 text-sm ${allowPromo ? 'text-slate-300' : 'text-slate-600'}`}><input type="checkbox" disabled={!allowPromo} className="accent-primary-500" checked={allowStack} onChange={(e) => setAllowStack(e.target.checked)} />Allow it to stack on my discount</label>
              <Field label="“Activate now” — payment due in (days)"><input type="number" min={0} max={90} className={inputCls} value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></Field>
              <Field label="Internal notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>
            </div>
          </section>
        </div>

        {/* PREVIEW + ACTIONS */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className={cardCls}>
            <h3 className="mb-3 text-sm font-bold text-white">Live totals <span className="font-normal text-slate-500">(server-computed)</span></h3>
            {!preview && !previewError && <p className="text-sm text-slate-500">Choose a plan or add a line to see the total.</p>}
            {previewError && <p role="alert" className="text-sm text-warning-400">{previewError}</p>}
            {preview && (
              <div className="space-y-2 text-sm">
                {preview.lines.map((l, i) => <div key={i} className="flex justify-between gap-3"><span className="text-slate-300">{l.label}{(l.qty ?? 1) > 1 ? ` × ${l.qty}` : ''}</span><span className="text-white">{rupees(l.amountPaise * (l.qty ?? 1))}</span></div>)}
                {preview.totals.discountPaise > 0 && <div className="flex justify-between"><span className="text-success-400">Discount{preview.promo ? ` (${preview.promo.code})` : ''}</span><span className="text-success-400">− {rupees(preview.totals.discountPaise)}</span></div>}
                <div className="flex justify-between border-t border-slate-800 pt-2"><span className="text-slate-400">{gstMode === 'INCLUSIVE' ? 'Taxable value' : 'Net'}</span><span className="text-white">{rupees(preview.totals.taxablePaise)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">GST</span><span className="text-white">{gstMode === 'NONE' ? 'None' : rupees(preview.totals.gstPaise)}</span></div>
                <div className="flex justify-between border-t border-slate-800 pt-2"><span className="font-bold text-white">Total payable</span><span className="text-xl font-bold text-white">{rupees(preview.totals.totalPaise)}</span></div>
                {preview.months && <p className="text-[11px] text-slate-500">{preview.months}-month term.</p>}
                {preview.aiCredit && <p className="text-[11px] text-slate-500">Includes a one-time {rupees(preview.aiCredit.paise)} AI Studio wallet credit (not charged).</p>}
              </div>
            )}
          </div>

          <ErrorBox message={error} />
          {blocker && (
            <div className="space-y-3 rounded-xl border border-warning-500/40 bg-warning-500/10 p-4 text-sm text-slate-200">
              <p>
                {blocker.invoiceNumber ? <>Open invoice <strong>{blocker.invoiceNumber}</strong>{blocker.invoiceStatus ? ` (${blocker.invoiceStatus.toLowerCase()})` : ''} is still waiting for payment. </> : <>The current billing term is still waiting for its payment. </>}
                <Link href="/admin/commerce/invoices" className="font-semibold text-primary-300 underline">Open Invoices →</Link>
              </p>
              <p className="text-xs text-slate-400">Normally you should pay or void that first. If you really need another one, type why (it is saved in the vendor&apos;s audit trail).</p>
              <input className={inputCls} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} maxLength={300} placeholder="Reason, at least 10 characters" aria-label="Reason for creating another activation" />
              <Button fullWidth variant="outline" disabled={overrideReason.trim().length < 10 || busy !== ''} onClick={() => submit(busy === 'activate' ? 'activate' : 'invoice', overrideReason.trim())}>Create anyway (logged)</Button>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-primary-500" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />Send the link by WhatsApp + email now</label>
          <div className="space-y-2">
            <Button fullWidth variant="outline" loading={busy === 'draft'} disabled={!preview || busy !== ''} onClick={() => submit('draft')} leftIcon={<Save className="h-4 w-4" />}>Save draft</Button>
            <Button fullWidth loading={busy === 'invoice'} disabled={!canIssue || busy !== ''} onClick={() => submit('invoice')} leftIcon={<Send className="h-4 w-4" />}>Create invoice + link</Button>
            <Button fullWidth variant="outline" loading={busy === 'activate'} disabled={!canIssue || !planKey || busy !== ''} onClick={() => submit('activate')} leftIcon={<Zap className="h-4 w-4" />}>Activate now, payment due in {dueDays || '0'} days</Button>
          </div>
        </aside>
      </div>

      {/* recent deals */}
      <section className={cardCls}>
        <h3 className="mb-3 text-sm font-bold text-white">Recent deals</h3>
        {deals.length === 0 ? <p className="text-sm text-slate-500">No deals yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="text-xs text-slate-500"><th className="py-2 pr-3 font-medium">Created</th><th className="pr-3 font-medium">For</th><th className="pr-3 font-medium">Plan</th><th className="pr-3 font-medium">List</th><th className="pr-3 font-medium">Discount</th><th className="font-medium">Status</th></tr></thead>
              <tbody>{deals.slice(0, 25).map((d) => (
                <tr key={d.id} className="border-t border-slate-800 text-slate-300">
                  <td className="py-2 pr-3">{fmtDate(d.createdAt)}</td>
                  <td className="pr-3">{d.prospectBusiness ?? (d.vendorId ? <Link className="text-primary-300 hover:underline" href={`/admin/customers/${d.vendorId}`}>Vendor</Link> : '—')}</td>
                  <td className="pr-3">{d.planKey ? `${PLAN_LABEL[d.planKey]} · ${d.billingCycle ? CYCLE_LABEL[d.billingCycle] : ''}` : 'Add-ons'}</td>
                  <td className="pr-3">{rupees(d.listAmountPaise)}</td><td className="pr-3">{d.discountPaise ? rupees(d.discountPaise) : '—'}</td><td><Pill value={d.status} /></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>

      <Modal isOpen={Boolean(result)} onClose={() => setResult(null)} title={result?.activated ? 'Activated — invoice created' : 'Invoice created'} maxWidth="max-w-lg" skin="dark">
        {result && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-800 p-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Invoice</span><span className="font-semibold text-white">{result.invoice.invoiceNumber}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-400">Total</span><span className="font-bold text-white">{rupees(result.invoice.totalAmount)}</span></div>
              {result.activated && <p className="mt-2 text-xs text-warning-300">All features are ON now. Payment is due in {dueDays} day(s); the account lapses {graceDays} day(s) after that if unpaid.</p>}
            </div>
            <PayLinkBox link={result.payLink} />
            <div className="flex justify-end gap-2"><Link href="/admin/commerce/invoices"><Button size="sm" variant="outline">Go to invoices</Button></Link><Button size="sm" onClick={() => setResult(null)}>Done</Button></div>
          </div>
        )}
      </Modal>
      {busy && <span className="sr-only" role="status"><Loader2 className="inline h-4 w-4 animate-spin" />Working…</span>}
    </div>
  );
}

export default function DealBuilderPage() {
  // useSearchParams (vendor preselect from the vendor page) needs a Suspense boundary for static rendering.
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>}>
      <DealBuilder />
    </Suspense>
  );
}
