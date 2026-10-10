'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { plain, useLoad } from '@/bos/client';
import { Alert, ErrorView, Field, Spinner, inputCls } from '@/bos/ui';
import { ls, type Category, type PageData, type Profile, type ServiceItem } from './ls';
import type { TabKey } from './LeadSpaceApp';

const GOALS: [string, string][] = [['ENQUIRY', 'Enquiries (name, number, message)'], ['BOOKING', 'Bookings (date, time slot, service)'], ['APPOINTMENT', 'Appointments (date, time slot, service)'], ['SITE_VISIT', 'Site visits (date, property)'], ['CART_ORDER', 'Orders (items, delivery details)']];
const goalsFor = (c?: Category): [string, string][] => (c?.regulated === 'advocate' ? GOALS.filter(([g]) => g === 'ENQUIRY') : c?.regulated === 'clinic' ? GOALS.filter(([g]) => g === 'APPOINTMENT' || g === 'ENQUIRY') : GOALS);

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** The Page tab: create the page from a few details, edit it, verify the phone, publish. */
export default function PageTab({ go, onChange }: { go: (t: TabKey) => void; onChange: () => void }) {
  const q = useLoad(() => ls<PageData | { profile: null; categories: Category[] }>('/leadspace/page'), []);
  if (q.loading && !q.data) return <Spinner />;
  if (q.error && !q.data) return <ErrorView error={q.error} />;
  const d = q.data as PageData | { profile: null; categories: Category[] };
  if (!d.profile) return <CreatePage categories={d.categories} onDone={() => { q.reload(); onChange(); }} />;
  return <EditPage data={d as PageData} reload={() => { q.reload(); onChange(); }} go={go} />;
}

function CreatePage({ categories, onDone }: { categories: Category[]; onDone: () => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [name, setName] = useState(user?.businessName ?? '');
  const [mode, setMode] = useState<'TEMPLATE' | 'EXISTING_PAGE'>('TEMPLATE');
  const [existing, setExisting] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cat = categories.find((c) => c.id === category);

  async function create(): Promise<void> {
    setBusy(true); setErr('');
    try {
      await ls('/leadspace/page', { method: 'POST', body: { category, city: city.trim(), businessName: name.trim(), mode, ...(mode === 'EXISTING_PAGE' && existing.trim() ? { existingPageUrl: existing.trim() } : {}) } });
      onDone();
    } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Create your page</h1>
        <p className="mt-1 text-sm text-slate-500">Tell us your trade and city. We write the page from your details and your catalogue; you can change everything afterwards. It is free.</p>
      </div>
      <Card padded className="space-y-4">
        <Field label="Your trade">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Choose your trade</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        {cat && <p className="-mt-2 text-xs text-slate-500">{cat.blurb}{cat.regulated ? ' Extra rules apply to this trade; we will tell you what they are.' : ''}</p>}
        <Field label="Business name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="organization" /></Field>
        <Field label="City you serve"><input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} autoComplete="address-level2" /></Field>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-slate-600">How do you want it?</legend>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input type="radio" name="mode" checked={mode === 'TEMPLATE'} onChange={() => setMode('TEMPLATE')} className="mt-1" /><span><strong>A new page made for me</strong> with offer, services, trust points, map and questions.</span></label>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input type="radio" name="mode" checked={mode === 'EXISTING_PAGE'} onChange={() => setMode('EXISTING_PAGE')} className="mt-1" /><span><strong>I already have a website.</strong> Add only a button and a request form to it. Nothing on your website is changed.</span></label>
        </fieldset>
        {mode === 'EXISTING_PAGE' && <Field label="Your website address"><input className={inputCls} value={existing} onChange={(e) => setExisting(e.target.value)} placeholder="https://" inputMode="url" autoComplete="url" /></Field>}
        {err && <Alert>{err}</Alert>}
        <Button fullWidth loading={busy} disabled={!category || !city.trim() || !name.trim()} onClick={create}>Create my page</Button>
      </Card>
    </div>
  );
}

function EditPage({ data, reload, go }: { data: PageData; reload: () => void; go: (t: TabKey) => void }) {
  const p = data.profile;
  const cat = data.categories.find((c) => c.id === p.category);
  const [f, setF] = useState(() => formOf(p));
  const [services, setServices] = useState<ServiceItem[]>(() => (p.services ?? []).map((s) => ({ ...s })));
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>(() => (p.faqs ?? []).map((x) => ({ ...x })));
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { setF(formOf(p)); setServices((p.services ?? []).map((s) => ({ ...s }))); setFaqs((p.faqs ?? []).map((x) => ({ ...x }))); }, [p.id, p.status, p.verificationStatus]);
  const set = (k: keyof typeof f, v: string): void => setF((x) => ({ ...x, [k]: v }));
  const live = p.status === 'PUBLISHED';
  const suspended = p.status === 'SUSPENDED';
  const done = data.checklist.filter((c) => c.done).length;
  const feed = useLoad(() => (p.goal === 'CART_ORDER' ? ls<{ url: string; items: number; skipped: { name: string; why: string }[] }>('/leadspace/page/feed') : Promise.resolve(null)), [p.goal, p.services.length]);

  /** Only the fields on this screen are sent, never the record that was loaded. */
  const body = useMemo(() => ({
    businessName: f.businessName.trim(), tagline: f.tagline.trim(), about: f.about.trim(), city: f.city.trim(), serviceArea: f.serviceArea.trim(), address: f.address.trim(), mapsLink: f.mapsLink.trim(),
    hours: f.hours.trim(), heroImage: f.heroImage.trim(), goal: f.goal, mode: f.mode, existingPageUrl: f.existingPageUrl.trim(), reraNumber: f.reraNumber.trim(),
    offer: { headline: f.offerHeadline.trim(), text: f.offerText.trim() },
    services: services.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), price: s.price === '' || s.price == null ? null : s.price, description: (s.description ?? '').trim() || null, image: s.image ?? null })),
    faqs: faqs.filter((x) => x.q.trim() && x.a.trim()),
  }), [f, services, faqs]);

  async function run(label: string, fn: () => Promise<unknown>, ok: string): Promise<void> {
    setBusy(label); setMsg(null);
    try { await fn(); setMsg({ tone: 'ok', text: ok }); reload(); } catch (e) { setMsg({ tone: 'error', text: plain(e) }); } finally { setBusy(''); }
  }
  const save = (): Promise<void> => run('save', () => ls('/leadspace/page', { method: 'PUT', body }), 'Saved.');
  const publish = (): Promise<void> => run('publish', async () => { await ls('/leadspace/page', { method: 'PUT', body }); await ls('/leadspace/page/publish', { method: 'POST' }); }, 'Your page is live.');
  const unpublish = (): Promise<void> => run('unpublish', () => ls('/leadspace/page/unpublish', { method: 'POST' }), 'Your page is taken down. You can publish it again any time.');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pageLink = data.url.startsWith('http') ? data.url : `${origin}${data.url}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Your page</h1>
        <p className="mt-1 text-sm text-slate-500">{cat?.label ?? p.category} in {p.city}. {live ? 'Live.' : suspended ? 'Suspended.' : 'Not live yet.'}</p>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {suspended && <Alert>This page is suspended{p.suspendedReason ? `: ${p.suspendedReason}` : ''}. Write to support to have it reviewed. You cannot edit or publish it meanwhile.</Alert>}

      <Card padded>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Getting ready ({done} of {data.checklist.length})</div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${live ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-600'}`}>{live ? 'Live' : 'Draft'}</span>
        </div>
        <ul className="mt-2 space-y-1">{data.checklist.map((c) => <li key={c.text} className={`flex items-start gap-2 text-sm ${c.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}><span aria-hidden>{c.done ? '✓' : '○'}</span>{c.text}</li>)}</ul>
        {live && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={pageLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><ExternalLink className="h-4 w-4" /> View my page</a>
            <button onClick={async () => setMsg((await copy(pageLink)) ? { tone: 'ok', text: 'Link copied. Share it on WhatsApp, Instagram and your visiting card.' } : { tone: 'info', text: pageLink })} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Copy className="h-4 w-4" /> Copy link</button>
          </div>
        )}
      </Card>

      {p.verificationStatus !== 'VERIFIED' && <VerifyPhone onDone={reload} initial={p.alertWhatsapp ?? ''} />}

      {cat?.regulated && data.preview.disclaimer && <Alert tone="info">{data.preview.disclaimer} Our team reviews this kind of page before it is shown in search, and promotion is switched on by them.</Alert>}

      <Card padded className="space-y-3">
        <div className="text-sm font-semibold text-slate-900">Basics</div>
        <Field label="Business name"><input className={inputCls} value={f.businessName} onChange={(e) => set('businessName', e.target.value)} maxLength={80} autoComplete="organization" /></Field>
        <Field label="One line about you" hint="Shown under the title."><input className={inputCls} value={f.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={120} autoComplete="off" /></Field>
        <Field label="About you"><textarea className={inputCls} rows={3} value={f.about} onChange={(e) => set('about', e.target.value)} maxLength={900} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="City"><input className={inputCls} value={f.city} onChange={(e) => set('city', e.target.value)} maxLength={60} autoComplete="address-level2" /></Field>
          <Field label="Areas you serve"><input className={inputCls} value={f.serviceArea} onChange={(e) => set('serviceArea', e.target.value)} maxLength={120} autoComplete="off" /></Field>
        </div>
        <Field label="What should visitors do?" hint="This is the one button on your page.">
          <select className={inputCls} value={f.goal} onChange={(e) => set('goal', e.target.value)}>{goalsFor(cat).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <Field label="Page type">
          <select className={inputCls} value={f.mode} onChange={(e) => set('mode', e.target.value)}>
            <option value="TEMPLATE">A page made for me</option>
            <option value="EXISTING_PAGE">I use my own website (only add a button and form)</option>
          </select>
        </Field>
        {f.mode === 'EXISTING_PAGE' && <Field label="Your website address"><input className={inputCls} value={f.existingPageUrl} onChange={(e) => set('existingPageUrl', e.target.value)} inputMode="url" autoComplete="url" placeholder="https://" /></Field>}
        {cat?.regulated === 'realEstate' && <Field label="RERA registration number" hint="Shown on your page and on every post. Needed for promotion."><input className={inputCls} value={f.reraNumber} onChange={(e) => set('reraNumber', e.target.value)} maxLength={60} autoComplete="off" /></Field>}
      </Card>

      {f.mode === 'TEMPLATE' && (
        <>
          <Card padded className="space-y-3">
            <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">{p.goal === 'CART_ORDER' ? 'Products' : 'Services'}</div><Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setServices((s) => [...s, { name: '', price: '', description: '' }])}>Add</Button></div>
            {services.length === 0 && <p className="text-sm text-slate-500">Add what you offer. Prices are optional but customers trust pages that show them.</p>}
            {services.map((s, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
                {s.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.image} alt="" className="h-16 w-16 rounded-lg object-cover" /> : null}
                <div className="grid grid-cols-[1fr_7rem_auto] gap-2">
                  <input className={inputCls} placeholder="Name" aria-label="Name" value={s.name} onChange={(e) => setServices((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={120} autoComplete="off" />
                  <input className={inputCls} placeholder="Price" aria-label="Price in rupees" inputMode="decimal" value={s.price ?? ''} onChange={(e) => setServices((a) => a.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} autoComplete="off" />
                  <button type="button" aria-label="Remove" onClick={() => setServices((a) => a.filter((_, j) => j !== i))} className="rounded-lg p-2 text-slate-400 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
                <input className={inputCls} placeholder="A short description (optional)" aria-label="Description" value={s.description ?? ''} onChange={(e) => setServices((a) => a.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} maxLength={240} autoComplete="off" />
              </div>
            ))}
            <p className="text-xs text-slate-500">Photos for products come from your catalogue in Website Manager. <Link href="/dashboard/my-website" className="font-semibold underline">Open Website Manager</Link></p>
          </Card>

          <Card padded className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Offer (optional)</div>
            <Field label="Offer headline"><input className={inputCls} value={f.offerHeadline} onChange={(e) => set('offerHeadline', e.target.value)} maxLength={80} autoComplete="off" /></Field>
            <Field label="Offer details"><input className={inputCls} value={f.offerText} onChange={(e) => set('offerText', e.target.value)} maxLength={240} autoComplete="off" /></Field>
            <Field label="Banner picture address (optional)"><input className={inputCls} value={f.heroImage} onChange={(e) => set('heroImage', e.target.value)} inputMode="url" autoComplete="off" placeholder="https://" /></Field>
            <Field label="Address"><input className={inputCls} value={f.address} onChange={(e) => set('address', e.target.value)} maxLength={240} autoComplete="street-address" /></Field>
            <Field label="Google Maps link"><input className={inputCls} value={f.mapsLink} onChange={(e) => set('mapsLink', e.target.value)} inputMode="url" autoComplete="off" /></Field>
            <Field label="Opening hours"><input className={inputCls} value={f.hours} onChange={(e) => set('hours', e.target.value)} maxLength={160} autoComplete="off" /></Field>
          </Card>

          <Card padded className="space-y-3">
            <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Questions people ask (optional)</div><Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setFaqs((a) => [...a, { q: '', a: '' }])}>Add</Button></div>
            {faqs.length === 0 && <p className="text-sm text-slate-500">If you add none, we show common questions for your trade.</p>}
            {faqs.map((x, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <input className={inputCls} placeholder="Question" aria-label="Question" value={x.q} onChange={(e) => setFaqs((a) => a.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)))} maxLength={160} autoComplete="off" />
                <textarea className={inputCls} placeholder="Answer" aria-label="Answer" rows={2} value={x.a} onChange={(e) => setFaqs((a) => a.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))} maxLength={500} />
                <button type="button" onClick={() => setFaqs((a) => a.filter((_, j) => j !== i))} className="text-xs text-slate-400 underline">Remove</button>
              </div>
            ))}
          </Card>
        </>
      )}

      {f.mode === 'EXISTING_PAGE' && (
        <Card padded className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">Add the button to your website</div>
          <p className="text-sm text-slate-600">Paste this line just before the end of the page on your website. It adds one button at the bottom of the screen and a request form. It does not touch anything else on your page.</p>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{data.embed}</pre>
          <Button size="sm" variant="outline" leftIcon={<Copy className="h-4 w-4" />} onClick={async () => setMsg((await copy(data.embed)) ? { tone: 'ok', text: 'Copied.' } : { tone: 'info', text: 'Select the line above and copy it.' })}>Copy</Button>
        </Card>
      )}

      {p.goal === 'CART_ORDER' && feed.data && (
        <Card padded className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">Google Shopping feed</div>
          <p className="text-sm text-slate-600">{feed.data.items} product{feed.data.items === 1 ? ' is' : 's are'} ready for Google Merchant Centre. Items need a price and a picture.</p>
          <input className={inputCls} readOnly value={feed.data.url} aria-label="Feed address" onFocus={(e) => e.currentTarget.select()} autoComplete="off" />
          {feed.data.skipped.length > 0 && <ul className="text-xs text-amber-800">{feed.data.skipped.slice(0, 5).map((s) => <li key={s.name}>{s.name}: {s.why}</li>)}</ul>}
        </Card>
      )}

      <Card padded>
        <div className="text-sm font-semibold text-slate-900">Your own address</div>
        <p className="mt-1 text-sm text-slate-600">Want your page on your own domain? <Link href="/dashboard/domain-management" className="font-semibold underline">Set up a domain</Link>.</p>
      </Card>

      {!suspended && (
        <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg md:bottom-4">
          <Button variant="outline" loading={busy === 'save'} onClick={save}>Save</Button>
          <Button className="flex-1" loading={busy === 'publish'} onClick={publish}>{live ? 'Save and keep live' : 'Publish my page'}</Button>
          {live && <Button variant="ghost" loading={busy === 'unpublish'} onClick={unpublish}>Take down</Button>}
        </div>
      )}
      {live && p.verificationStatus === 'VERIFIED' && <p className="text-center text-sm text-slate-500">Next: <button className="font-semibold underline" onClick={() => go('promote')}>let us promote your page</button>.</p>}
    </div>
  );
}

function formOf(p: Profile) {
  return {
    businessName: p.businessName, tagline: p.tagline ?? '', about: p.about ?? '', city: p.city, serviceArea: p.serviceArea ?? '', address: p.address ?? '', mapsLink: p.mapsLink ?? '', hours: p.hours ?? '',
    heroImage: p.heroImage ?? '', goal: p.goal, mode: p.mode, existingPageUrl: p.existingPageUrl ?? '', reraNumber: p.reraNumber ?? '', offerHeadline: p.offer?.headline ?? '', offerText: p.offer?.text ?? '',
  };
}

function VerifyPhone({ onDone, initial }: { onDone: () => void; initial: string }) {
  const [phone, setPhone] = useState(initial);
  const [otpId, setOtpId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function request(): Promise<void> {
    setBusy(true); setErr('');
    try { const r = await ls<{ otpId: string }>('/leadspace/page/verify-phone/request', { method: 'POST', body: { phone } }); setOtpId(r.otpId); } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }
  async function confirm(): Promise<void> {
    setBusy(true); setErr('');
    try { await ls('/leadspace/page/verify-phone/confirm', { method: 'POST', body: { phone, otpId, code: code.trim() } }); onDone(); } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }
  return (
    <Card padded className="space-y-3 border-amber-200 bg-amber-50">
      <div className="text-sm font-semibold text-slate-900">Verify your WhatsApp number</div>
      <p className="text-sm text-slate-700">We send a code to your WhatsApp. This is also the number where your new-lead alerts arrive. Pages that are not verified are not shown in search and are not promoted.</p>
      {!otpId ? (
        <div className="flex gap-2">
          <input className={inputCls} type="tel" inputMode="numeric" placeholder="10-digit mobile number" aria-label="Your WhatsApp number" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} autoComplete="tel" />
          <Button loading={busy} onClick={request}>Send code</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input className={inputCls} inputMode="numeric" placeholder="6-digit code" aria-label="Verification code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} maxLength={6} autoComplete="one-time-code" />
          <Button loading={busy} onClick={confirm}>Verify</Button>
        </div>
      )}
      {err && <Alert>{err}</Alert>}
    </Card>
  );
}
