'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Monitor, Plus, Smartphone, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';
import type { DesignsView, Extras } from './SiteContentTabs';

/**
 * The Website Manager tabs that belong to the engine shell (industry designs round 2): Navigation (the header items, the five bottom-bar labels and the main button), Popup form
 * (which optional fields the popup shows, the thank-you message and where notices go), Preview (desktop and phone, popup and bottom bar visible), social links and the
 * marketplace (paid themes). Every setting here is saved in the vendor's own site draft (extras.navigation, extras.popup, extras.social), so Publish and Versions cover them.
 */
export interface ShellExtras {
  navigation?: { header?: { label: string; target: string }[]; bottom?: { key: string; label: string }[]; primaryLabel?: string };
  popup?: { email?: 'hidden' | 'optional' | 'required'; message?: 'hidden' | 'optional' | 'required'; confirm?: string; notifyPhone?: string; notifyEmail?: string };
  social?: { x?: string; customLabel?: string; customUrl?: string };
  pagePlan?: { order?: string[]; hidden?: string[] };
}
export type FullExtras = Extras & ShellExtras;

const field = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';
const lbl = 'mb-1.5 block text-xs font-medium text-slate-600';
const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/* ── Navigation ── */
export function NavigationTab({ extras, set, designs, pageChoices }: { extras: FullExtras; set: (next: FullExtras) => void; designs: DesignsView | null; pageChoices: { target: string; label: string }[] }) {
  const nav = extras.navigation ?? {};
  const header = nav.header ?? [];
  const slots = designs?.shell?.bottomNav ?? [];
  const labels = new Map((nav.bottom ?? []).map((b) => [b.key, b.label]));
  const put = (patch: Partial<NonNullable<ShellExtras['navigation']>>): void => set({ ...extras, navigation: { ...nav, ...patch } });
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Main button</h2>
        <p className="text-xs text-slate-500">The words on your main button and on the centre of the phone bar. Leave empty to use the standard words for your kind of business{designs?.ctaLabel ? ` ("${designs.ctaLabel}")` : ''}.</p>
        <input className={`${field} mt-2 max-w-xs`} maxLength={24} value={nav.primaryLabel ?? ''} placeholder={designs?.ctaLabel ?? 'Book now'} onChange={(e) => put({ primaryLabel: e.target.value })} />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Menu at the top</h2>
        <p className="text-xs text-slate-500">The links in the top menu, up to 8. Leave it empty and your pages are listed for you.</p>
        <div className="mt-2 space-y-2">
          {header.map((h, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className={field} placeholder="Words on the link" maxLength={24} value={h.label} onChange={(e) => put({ header: header.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <select className={field} value={pageChoices.some((p) => p.target === h.target) ? h.target : 'custom'} onChange={(e) => put({ header: header.map((x, j) => (j === i ? { ...x, target: e.target.value === 'custom' ? 'https://' : e.target.value } : x)) })}>
                {pageChoices.map((p) => <option key={p.target} value={p.target}>{p.label}</option>)}
                <option value="custom">A web, phone or e-mail link</option>
              </select>
              <button type="button" aria-label="Remove link" className="text-slate-400 hover:text-error-600" onClick={() => put({ header: header.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
              {!pageChoices.some((p) => p.target === h.target) && <input className={`${field} sm:col-span-3`} placeholder="https://, tel: or mailto:" value={h.target} onChange={(e) => put({ header: header.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)) })} />}
            </div>
          ))}
          {header.length < 8 && <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => put({ header: [...header, { label: '', target: pageChoices[0]?.target ?? 'home' }] })}>Add a link</Button>}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Bar at the bottom of the phone</h2>
        <p className="text-xs text-slate-500">Five buttons, made for your kind of business. You can change the words (up to 14 letters). The middle one is your main button.</p>
        {slots.length === 0 && <p className="mt-2 text-sm text-slate-500">Your category has no bar set up yet; the standard one is used.</p>}
        <div className="mt-2 grid gap-3 sm:grid-cols-5">
          {slots.map((s, i) => (
            <div key={s.key}>
              <label className={lbl}>{i === 2 ? 'Middle (main button)' : `Button ${i + 1}`}</label>
              <input className={field} maxLength={14} placeholder={s.label} value={labels.get(s.key) ?? ''} onChange={(e) => put({ bottom: [...(nav.bottom ?? []).filter((b) => b.key !== s.key), ...(e.target.value ? [{ key: s.key, label: e.target.value }] : [])] })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Popup form ── */
const MODE_LABEL: Record<string, string> = { hidden: 'Do not ask', optional: 'Ask, but not required', required: 'Ask and require' };
export function PopupTab({ extras, set, designs }: { extras: FullExtras; set: (next: FullExtras) => void; designs: DesignsView | null }) {
  const p = extras.popup ?? {};
  const put = (patch: Partial<NonNullable<ShellExtras['popup']>>): void => set({ ...extras, popup: { ...p, ...patch } });
  const steps = designs?.shell?.popup.steps ?? [];
  const kindWords: Record<string, string> = { choose: 'choose one', when: 'date and time', dates: 'dates', count: 'how many', mode: 'what kind', cart: 'cart', details: 'name and phone', confirm: 'check and send' };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{designs?.shell?.popup.title ?? 'The popup'}</h2>
        <p className="text-xs text-slate-500">When a visitor presses your main button, a short form opens on top of your page. The steps are made for your kind of business{steps.length ? `: ${steps.map((s) => s.label.replace(/\?$/, '')).join(' → ')}` : ''}. Name and phone are always asked, because you need them to call back.</p>
        {steps.length > 0 && <ol className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">{steps.map((s, i) => <li key={s.key} className="rounded-full bg-slate-100 px-3 py-1">{i + 1}. {kindWords[s.kind] ?? s.kind}</li>)}</ol>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lbl}>E-mail address</label><select className={field} value={p.email ?? 'optional'} onChange={(e) => put({ email: e.target.value as 'optional' })}>{Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className={lbl}>Message box</label><select className={field} value={p.message ?? 'optional'} onChange={(e) => put({ message: e.target.value as 'optional' })}>{Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="sm:col-span-2"><label className={lbl}>Thank-you message <span className="text-slate-400">— shown after the visitor sends the form</span></label><textarea rows={2} maxLength={300} className={field} value={p.confirm ?? ''} placeholder={designs?.shell?.popup.confirm ?? 'Thank you. We will call you shortly.'} onChange={(e) => put({ confirm: e.target.value })} /></div>
        <div><label className={lbl}>Tell me by phone <span className="text-slate-400">— a number to alert when a request comes in</span></label><input className={field} maxLength={20} value={p.notifyPhone ?? ''} onChange={(e) => put({ notifyPhone: e.target.value })} /></div>
        <div><label className={lbl}>Tell me by e-mail</label><input type="email" className={field} maxLength={160} value={p.notifyEmail ?? ''} onChange={(e) => put({ notifyEmail: e.target.value })} /></div>
      </div>
      <p className="text-xs text-slate-500">Every request lands in your Leads list as well. Use the Preview tab and press “Open the form” to see exactly what visitors see.</p>
    </div>
  );
}

/* ── Social links beside the About tab ── */
export function SocialExtraFields({ extras, set }: { extras: FullExtras; set: (next: FullExtras) => void }) {
  const s = extras.social ?? {};
  const put = (patch: Partial<NonNullable<ShellExtras['social']>>): void => set({ ...extras, social: { ...s, ...patch } });
  return (
    <>
      <div><label className={lbl}>X (Twitter)</label><input className={field} value={s.x ?? ''} placeholder="https://x.com/yourname" onChange={(e) => put({ x: e.target.value })} /></div>
      <div><label className={lbl}>Another link — name</label><input className={field} maxLength={24} value={s.customLabel ?? ''} placeholder="Blog" onChange={(e) => put({ customLabel: e.target.value })} /></div>
      <div className="sm:col-span-2"><label className={lbl}>Another link — address</label><input className={field} value={s.customUrl ?? ''} placeholder="https://" onChange={(e) => put({ customUrl: e.target.value })} /></div>
      <p className="text-xs text-slate-500 sm:col-span-2">Only the links you fill in are shown; an empty link hides its icon. Your phone number becomes a WhatsApp link, and your address and Google Maps link make the map.</p>
    </>
  );
}

/* ── Preview: desktop and phone, with the popup and the bottom bar ── */
export function PreviewTab({ previewUrl, onRefresh, busy }: { previewUrl: string; onRefresh: () => void; busy: boolean }) {
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [popup, setPopup] = useState(false);
  const src = previewUrl ? `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}${popup ? 'popup=1&' : ''}v=${popup ? 'p' : 'n'}` : '';
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 p-1">
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${device === 'desktop' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}><Monitor className="h-4 w-4" />Computer</button>
          <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${device === 'phone' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}><Smartphone className="h-4 w-4" />Phone</button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setPopup((v) => !v)}>{popup ? 'Close the form' : 'Open the form'}</Button>
        <Button size="sm" variant="outline" onClick={onRefresh} loading={busy}>Refresh preview</Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">This is your site with your own words, as it will look. On the phone you see the bar at the bottom; “Open the form” shows the popup. Nothing you try here is sent.</p>
      {src
        ? <div className={`mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${device === 'phone' ? 'mx-auto w-[390px] max-w-full' : 'w-full'}`}><iframe key={src} title="Preview of your site" src={src} className={`block w-full border-0 bg-white ${device === 'phone' ? 'h-[760px]' : 'h-[620px]'}`} /></div>
        : <p className="mt-4 text-sm text-slate-500">Press Refresh preview to see your site.</p>}
    </div>
  );
}

/* ── Marketplace: paid themes for the vendor's category ── */
interface MarketTheme { key: string; name: string; version: number; author: string; description: string | null; id: string; priceYearlyPaise: number; gstPaise: number; totalPaise: number; owned: { endsAt: string; daysLeft: number } | null; expired: boolean }
interface RzpResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s);
  });
}

export function MarketplacePanel({ previewBase, current, onUse, businessName }: { previewBase: string; current: string | null; onUse: (designKey: string) => void; businessName: string }) {
  const [themes, setThemes] = useState<MarketTheme[] | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { api.siteDocThemes().then((r) => setThemes(((r.data as { themes?: MarketTheme[] })?.themes ?? []))).catch(() => setThemes([])); }, []);
  useEffect(() => { load(); }, [load]);

  const buy = async (t: MarketTheme): Promise<void> => {
    setBusy(t.key); setMsg(null);
    try {
      if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) throw new Error('Payments are not switched on yet. Please contact support and we will set up your theme.');
      const o = (await api.siteDocThemeOrder(t.key)).data as { orderId: string; amount: number; currency: string };
      const ok = await loadRazorpay();
      const Rzp = (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (!ok || !Rzp) throw new Error('The payment window could not open. Please check your connection and try again.');
      await new Promise<void>((resolve, reject) => {
        new Rzp({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, order_id: o.orderId, amount: o.amount, currency: o.currency, name: 'Get4Domain', description: `${t.name}: one year`,
          handler: (r: RzpResponse) => { api.siteDocThemeConfirm(t.key, { razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature }).then(() => resolve()).catch(reject); },
          modal: { ondismiss: () => reject(new Error('The payment was not completed. Nothing was charged.')) },
          prefill: { name: businessName },
        }).open();
      });
      setMsg({ ok: true, text: `${t.name} is yours for a year. Press “Use this theme” to put it on your site.` });
      load();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'We could not complete the purchase. If money was taken, it is safe: contact support and we will start your theme.' }); }
    finally { setBusy(''); }
  };

  if (themes === null) return <p className="mt-6 text-sm text-slate-500">Loading themes...</p>;
  if (themes.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-slate-900">More themes</h2>
      <p className="text-xs text-slate-500">Premium designs made for your kind of business. Look at any of them with your own words for free. A theme is yours for a year at the price shown (GST included). If the year ends and you do not renew, your site goes back to a free design; nothing you wrote is lost.</p>
      {msg && <div role={msg.ok ? 'status' : 'alert'} className={`mt-3 rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-success-200 bg-success-50 text-success-700' : 'border-error-200 bg-error-50 text-error-700'}`}>{msg.text}</div>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {themes.map((t) => {
          const key = `t:${t.key}`; const on = current === key;
          const src = previewBase ? `${previewBase}${previewBase.includes('?') ? '&' : '?'}design=${encodeURIComponent(key)}` : '';
          return (
            <div key={t.key} className={`overflow-hidden rounded-2xl border ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200'}`}>
              <div className="relative h-56 overflow-hidden bg-slate-100" aria-hidden={!src}>
                {src ? <iframe title={`${t.name} with your content`} src={src} loading="lazy" tabIndex={-1} className="pointer-events-none absolute left-0 top-0 h-[900px] w-[1280px] origin-top-left border-0" style={{ transform: 'scale(0.36)' }} /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Preview loading</div>}
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-sm font-semibold text-slate-900">{t.name}{on && <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">In use</span>}</div><div className="text-xs text-slate-500">by {t.author}</div></div>
                  <div className="text-right text-xs text-slate-600"><div className="text-sm font-semibold text-slate-900">{rupees(t.totalPaise)} / year</div><div>{rupees(t.priceYearlyPaise)} + {rupees(t.gstPaise)} GST</div></div>
                </div>
                {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                {t.owned && <p className="inline-flex items-center gap-1 text-xs text-success-700"><CheckCircle2 className="h-3.5 w-3.5" />Yours until {new Date(t.owned.endsAt).toLocaleDateString('en-IN')}{t.owned.daysLeft <= 30 ? ` (${t.owned.daysLeft} day${t.owned.daysLeft === 1 ? '' : 's'} left)` : ''}</p>}
                {t.expired && !t.owned && <p className="text-xs text-amber-800">Your year with this theme has ended, so your site is showing a free design. Renew to bring it back.</p>}
                <div className="flex flex-wrap gap-2">
                  {t.owned && !on && <Button size="sm" onClick={() => onUse(key)}>Use this theme</Button>}
                  {(!t.owned || t.owned.daysLeft <= 30) && <Button size="sm" variant={t.owned ? 'outline' : 'primary'} onClick={() => void buy(t)} disabled={!!busy} leftIcon={busy === t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>{t.owned || t.expired ? 'Renew for a year' : `Buy for a year`}</Button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
