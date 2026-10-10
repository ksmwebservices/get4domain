'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, MessageCircle, Shield } from 'lucide-react';
import { deviceId, post, track, utmFromUrl } from '../leadspace-client';
import type { FormField, ServiceItem, Theme } from './model';
import { hexToRgba } from './ui';

// A customer has to leave this page to read the WhatsApp code, and many phones reload the page when they come back. The details and the cart are kept on this
// phone for a while so nothing has to be typed again, and a code that was already requested can still be entered. The code itself and the consent tick are never kept.
const DRAFT_MS = 6 * 3_600_000;
const CODE_MS = 9 * 60_000;
interface Draft { at: number; values: Record<string, string>; cart: Record<string, number>; otpId: string | null; otpAt: number | null }
const draftKey = (slug: string): string => `ls:draft:${slug}`;
function loadDraft(slug: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(slug));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && typeof d.at === 'number' && Date.now() - d.at < DRAFT_MS ? d : null;
  } catch { return null; }
}
function saveDraft(slug: string, d: Draft | null): void {
  try { if (d) window.localStorage.setItem(draftKey(slug), JSON.stringify(d)); else window.localStorage.removeItem(draftKey(slug)); } catch { /* private mode: the form still works, it just forgets */ }
}

/** True when this phone has an unfinished request for this page (so the page can open on it after a reload). */
export function hasDraft(slug: string): boolean {
  const d = loadDraft(slug);
  return !!d && (!!d.otpId || Object.keys(d.values ?? {}).length > 0 || Object.values(d.cart ?? {}).some((q) => q > 0));
}

const priceOf = (t: string | null): number => (t ? parseInt(t.replace(/[^\d]/g, ''), 10) || 0 : 0);
const today = (): string => new Date().toISOString().slice(0, 10);

interface Props {
  slug: string; theme: Theme; businessName: string; primaryButton: string; consentText: string;
  fields: FormField[]; services: ServiceItem[];
  cart: Record<string, number>; setCart: React.Dispatch<React.SetStateAction<Record<string, number>>>; onCartRemove: (name: string) => void;
}

type Step = 'details' | 'verify' | 'done';

/** Your design (details, six code boxes, thank-you) wired to the real thing: a WhatsApp code to the customer, one verified request, no payment on the page. */
export default function AppLeadForm({ slug, theme, businessName, primaryButton, consentText, fields, services, cart, setCart, onCartRemove }: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('details');
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [thanks, setThanks] = useState('');
  const [restored, setRestored] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const started = useRef(false);
  const ready = useRef(false);
  const otpAt = useRef<number | null>(null);

  const cartField = fields.some((f) => f.kind === 'cart');
  const inputFields = fields.filter((f) => f.kind !== 'cart');
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const touch = (): void => { if (!started.current) { started.current = true; track(slug, 'form'); } };

  // Come back to what was typed (after the first paint, so the server and the browser render the same page).
  useEffect(() => {
    const d = loadDraft(slug);
    if (d) {
      setValues(d.values ?? {}); setCart(d.cart ?? {});
      if (d.otpId && d.otpAt && Date.now() - d.otpAt < CODE_MS) { setOtpId(d.otpId); otpAt.current = d.otpAt; setStep('verify'); setConsent(true); }
      if (Object.keys(d.values ?? {}).length || Object.keys(d.cart ?? {}).length) setRestored(true);
    }
    ready.current = true;
  }, [slug, setCart]);

  useEffect(() => {
    if (!ready.current || step === 'done') return;
    const empty = Object.keys(values).length === 0 && Object.values(cart).every((q) => !q);
    if (empty && !otpId) { saveDraft(slug, null); return; }
    saveDraft(slug, { at: Date.now(), values, cart, otpId, otpAt: otpId ? otpAt.current : null });
  }, [slug, values, cart, otpId, step]);

  useEffect(() => { if (step === 'verify') refs.current[0]?.focus(); }, [step]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  function change(key: string, v: string): void {
    touch();
    setValues((p) => ({ ...p, [key]: v }));
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    for (const f of inputFields) {
      const v = (values[f.key] ?? '').trim();
      if (f.required && !v) e[f.key] = `${f.label} is required`;
      if (f.kind === 'tel' && v && v.replace(/\D/g, '').slice(-10).length < 10) e[f.key] = 'Enter a valid 10-digit mobile number';
    }
    if (cartField && cartCount === 0) e.cart = 'Add at least one item to your order';
    if (!consent) e._consent = 'Please tick the box to agree before we send a code';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function payload(): Record<string, unknown> {
    const p: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.key === 'name' || f.key === 'phone') continue;
      if (f.kind === 'cart') p.items = Object.entries(cart).filter(([, q]) => q > 0).map(([name, qty]) => ({ name, qty }));
      else if (values[f.key]) p[f.key] = values[f.key];
    }
    return p;
  }

  async function sendCode(): Promise<void> {
    if (!validate()) return;
    setBusy(true); setProblem('');
    try {
      const r = await post<{ otpId: string }>('/leadspace/public/otp', { slug, phone: values.phone, consent: true, deviceId: deviceId() });
      otpAt.current = Date.now();
      setOtpId(r.otpId); setDigits(['', '', '', '', '', '']); setStep('verify'); setCooldown(30);
      saveDraft(slug, { at: Date.now(), values, cart, otpId: r.otpId, otpAt: otpAt.current });
    } catch (e) { setProblem((e as Error).message); } finally { setBusy(false); }
  }

  async function confirm(): Promise<void> {
    const code = digits.join('');
    if (!/^\d{6}$/.test(code)) { setProblem('Enter all 6 digits of the code from WhatsApp.'); return; }
    setBusy(true); setProblem('');
    try {
      const r = await post<{ message: string }>('/leadspace/public/event', { slug, name: values.name, phone: values.phone, payload: payload(), otpId, code, idempotencyKey: `ls:${slug}:${otpId ?? ''}`, source: 'page', utm: utmFromUrl(), deviceId: deviceId() });
      setThanks(r.message); setStep('done'); saveDraft(slug, null); setCart({});
    } catch (e) { setProblem((e as Error).message); } finally { setBusy(false); }
  }

  // One digit at a time, or a whole code at once (phone auto-fill and paste put several digits into one box): spread them over the boxes from here.
  function digit(i: number, v: string): void {
    const all = v.replace(/\D/g, '');
    setProblem('');
    if (all.length > 1) {
      setDigits((p) => { const n = [...p]; all.slice(0, 6 - i).split('').forEach((c, k) => { n[i + k] = c; }); return n; });
      refs.current[Math.min(i + all.length, 5)]?.focus();
      return;
    }
    const d = all.slice(-1);
    setDigits((p) => { const n = [...p]; n[i] = d; return n; });
    if (d && i < 5) refs.current[i + 1]?.focus();
  }
  function paste(e: React.ClipboardEvent): void {
    e.preventDefault();
    const s = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!s) return;
    setDigits(s.split('').concat(Array(6 - s.length).fill('')).slice(0, 6));
    refs.current[Math.min(s.length, 5)]?.focus();
  }

  const priced = Object.entries(cart).filter(([, q]) => q > 0);
  const allPriced = priced.length > 0 && priced.every(([n]) => priceOf(services.find((s) => s.name === n)?.priceText ?? null) > 0);
  const total = priced.reduce((a, [n, q]) => a + priceOf(services.find((s) => s.name === n)?.priceText ?? null) * q, 0);

  if (step === 'done') {
    return (
      <div role="status" className="lsa-scale-in flex flex-col items-center px-5 py-8 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: hexToRgba(theme.accent, 0.1) }}><CheckCircle2 size={44} style={{ color: theme.accent }} /></div>
        <h2 className="mb-2 text-xl font-bold" style={{ color: theme.ink }}>Request received</h2>
        <p className="max-w-xs text-sm leading-relaxed text-gray-600">{thanks}</p>
        <div className="mt-5 flex w-full max-w-xs items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: theme.soft }}>
          <MessageCircle size={20} className="flex-shrink-0" style={{ color: theme.accent }} />
          <p className="text-xs leading-relaxed text-gray-600">Keep your phone nearby. {businessName} will contact you on this number.</p>
        </div>
        <button type="button" onClick={() => { setStep('details'); setValues({}); setConsent(false); setOtpId(null); setDigits(['', '', '', '', '', '']); started.current = false; }} className="mt-6 text-sm font-semibold" style={{ color: theme.accentDark }}>Send another request</button>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="lsa-tab px-5 py-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: hexToRgba(theme.accent, 0.1) }}><MessageCircle size={28} style={{ color: theme.accent }} /></div>
          <h2 className="text-lg font-bold" style={{ color: theme.ink }}>Enter the code from WhatsApp</h2>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-gray-600">We sent a 6-digit code to your WhatsApp number. Enter it below to send your request.</p>
        </div>
        <div className="mb-4 flex justify-center gap-2" onPaste={paste}>
          {digits.map((d, i) => (
            <input key={i} ref={(el) => { refs.current[i] = el; }} type="text" inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? 6 : 6 - i} value={d} onChange={(e) => digit(i, e.target.value)} onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }}
              className="h-14 w-11 rounded-xl border-2 bg-white text-center text-xl font-bold focus:outline-none" aria-label={`Digit ${i + 1}`}
              style={{ borderColor: d ? theme.accent : problem ? '#ef4444' : '#d1d5db', color: theme.ink }} />
          ))}
        </div>
        {problem ? <p role="alert" className="mb-4 text-center text-sm text-red-600">{problem}</p> : null}
        <button type="button" onClick={() => void confirm()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white active:scale-[0.97] disabled:opacity-60" style={{ backgroundColor: theme.accent, minHeight: '48px' }}>
          {busy ? <><Loader2 size={18} className="animate-spin" /> Confirming...</> : 'Confirm and send'}
        </button>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={() => { setStep('details'); setOtpId(null); setProblem(''); }} className="flex items-center gap-1 text-sm font-medium text-gray-600"><ArrowLeft size={16} /> Back</button>
          <button type="button" disabled={busy || cooldown > 0} onClick={() => { setConsent(true); void sendCode(); }} className="text-sm font-semibold disabled:opacity-60" style={{ color: theme.accentDark }}>{cooldown > 0 ? `Send again in ${cooldown}s` : 'Send the code again'}</button>
        </div>
      </div>
    );
  }

  return (
    <form className="lsa-tab px-5 py-6" noValidate onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
      {restored ? (
        <p className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: theme.soft, color: theme.accentDark }}>
          Welcome back. Your details are still here.{' '}
          <button type="button" className="underline" onClick={() => { setValues({}); setCart({}); setConsent(false); setRestored(false); saveDraft(slug, null); }}>Start again</button>
        </p>
      ) : null}

      {cartField && cartCount > 0 ? (
        <div className="mb-5 overflow-hidden rounded-2xl border border-gray-100">
          <div className="px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: theme.soft, color: theme.accentDark }}>Your order ({cartCount} {cartCount === 1 ? 'item' : 'items'})</div>
          <div className="divide-y divide-gray-50">
            {priced.map(([name, qty]) => {
              const svc = services.find((s) => s.name === name);
              const unit = priceOf(svc?.priceText ?? null);
              return (
                <div key={name} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" style={{ color: theme.ink }}>{name}</p><p className="text-xs text-gray-500">{svc?.priceText ? `${svc.priceText} x ${qty}` : `x ${qty}`}</p></div>
                  <div className="flex items-center gap-3">
                    {unit > 0 ? <span className="text-sm font-semibold" style={{ color: theme.ink }}>Rs {(unit * qty).toLocaleString('en-IN')}</span> : null}
                    <button type="button" onClick={() => onCartRemove(name)} className="min-h-[36px] text-xs text-gray-500 underline">Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
          {allPriced ? <div className="flex items-center justify-between px-4 py-2.5 font-bold" style={{ backgroundColor: theme.soft }}><span className="text-sm" style={{ color: theme.ink }}>Total (shop confirms the final amount)</span><span className="text-sm" style={{ color: theme.accentDark }}>Rs {total.toLocaleString('en-IN')}</span></div> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {inputFields.map((f) => <Field key={f.key} f={f} value={values[f.key] ?? ''} error={errors[f.key]} theme={theme} onChange={(v) => change(f.key, v)} />)}
      </div>
      {errors.cart ? <p role="alert" className="mt-3 text-sm text-red-600">{errors.cart}</p> : null}

      <label className="mt-4 flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" checked={consent} onChange={(e) => { touch(); setConsent(e.target.checked); if (e.target.checked) setErrors((p) => { const n = { ...p }; delete n._consent; return n; }); }} className="mt-0.5 flex-shrink-0" style={{ accentColor: theme.accent, width: 18, height: 18 }} />
        <span className="text-xs leading-relaxed text-gray-600">{consentText}</span>
      </label>
      {errors._consent ? <p role="alert" className="mt-1.5 text-sm text-red-600">{errors._consent}</p> : null}
      {problem ? <p role="alert" className="mt-3 text-sm text-red-600">{problem}</p> : null}
      {Object.keys(errors).some((k) => k !== 'cart' && k !== '_consent') ? <p role="alert" className="mt-3 text-center text-sm text-red-600">Please check the highlighted fields</p> : null}

      <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-60 hover:shadow-lg" style={{ backgroundColor: theme.accent, boxShadow: `0 4px 14px ${hexToRgba(theme.accent, 0.3)}`, minHeight: '48px' }}>
        {busy ? <><Loader2 size={18} className="animate-spin" /> Sending the code...</> : <>{primaryButton} <ArrowRight size={18} /></>}
      </button>
      <div className="mt-4 flex items-center justify-center gap-1.5"><Shield size={14} className="text-gray-400" /><p className="text-xs text-gray-500">Your details are shared only with {businessName}</p></div>
    </form>
  );
}

function Field({ f, value, error, theme, onChange }: { f: FormField; value: string; error?: string; theme: Theme; onChange: (v: string) => void }): React.ReactElement {
  const id = `lsf-${f.key}`;
  const base = `w-full rounded-xl border-2 bg-white px-4 py-3 text-base focus:outline-none ${error ? 'border-red-300' : 'border-gray-200'}`;
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => { if (!error) e.currentTarget.style.borderColor = theme.accent; };
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => { if (!error) e.currentTarget.style.borderColor = ''; };
  const style = { color: theme.ink } as React.CSSProperties;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold" style={{ color: theme.ink }}>{f.label}{f.required ? <span style={{ color: theme.accentDark }}> *</span> : <span className="font-normal text-gray-500"> (optional)</span>}</label>
      {f.kind === 'textarea' ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} onFocus={focus} onBlur={blur} placeholder={f.hint} rows={3} maxLength={1000} className={`${base} resize-none`} style={style} />
      ) : f.kind === 'select' ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} onFocus={focus} onBlur={blur} className={`${base} cursor-pointer`} style={style}>
          <option value="">Choose</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.kind === 'date' ? (
        <input id={id} type="date" min={today()} value={value} onChange={(e) => onChange(e.target.value)} onFocus={focus} onBlur={blur} className={base} style={style} />
      ) : (
        <input id={id} type={f.kind === 'tel' ? 'tel' : 'text'} inputMode={f.kind === 'tel' ? 'numeric' : undefined} autoComplete={f.key === 'name' ? 'name' : f.kind === 'tel' ? 'tel' : 'off'} maxLength={f.kind === 'tel' ? 15 : 120} value={value} onChange={(e) => onChange(e.target.value)} onFocus={focus} onBlur={blur} className={base} style={style} />
      )}
      {f.hint && f.kind !== 'textarea' ? <p className="mt-1 text-xs text-gray-500">{f.hint}</p> : null}
      {error ? <p role="alert" className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
