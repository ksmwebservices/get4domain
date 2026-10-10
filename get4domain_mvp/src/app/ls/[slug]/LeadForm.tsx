'use client';

import { useEffect, useRef, useState } from 'react';
import { deviceId, post, track, utmFromUrl } from './leadspace-client';

interface FormField { key: string; label: string; kind: 'text' | 'tel' | 'textarea' | 'date' | 'select' | 'cart'; required: boolean; options?: string[]; hint?: string }
export interface LeadFormModel {
  slug: string;
  theme: { accent: string; accentDark: string; soft: string; ink: string };
  form: { goal: string; fields: FormField[]; submitLabel: string; consentText: string };
  cartItems: string[];
}

const today = (): string => new Date().toISOString().slice(0, 10);
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none';

// A customer has to leave this page to read the WhatsApp code, and many phones reload the page when they come back. The cart and the details are kept on this
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

/** Three steps on one card: your details, the code sent to your WhatsApp, and the thank-you. No payment is taken here. */
export default function LeadForm({ model }: { model: LeadFormModel }): React.ReactElement {
  const { slug, theme, form } = model;
  const [values, setValues] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Record<string, number>>({});
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<'details' | 'code' | 'done'>('details');
  const [otp, setOtp] = useState<{ otpId: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState('');
  const started = useRef(false);
  const [restored, setRestored] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const ready = useRef(false);

  // Come back to what was typed. Only after the first paint so the server and browser render the same page.
  useEffect(() => {
    const d = loadDraft(slug);
    if (d) {
      setValues(d.values ?? {}); setCart(d.cart ?? {});
      if (d.otpId && d.otpAt && Date.now() - d.otpAt < CODE_MS) { setOtp({ otpId: d.otpId }); setStep('code'); setConsent(true); }
      if (Object.keys(d.values ?? {}).length || Object.keys(d.cart ?? {}).length) setRestored(true);
    }
    ready.current = true;
  }, [slug]);

  useEffect(() => {
    if (!ready.current || step === 'done') return;
    const empty = Object.keys(values).length === 0 && Object.values(cart).every((q) => !q);
    if (empty && !otp) { saveDraft(slug, null); return; }
    saveDraft(slug, { at: Date.now(), values, cart, otpId: otp?.otpId ?? null, otpAt: otp ? (loadDraft(slug)?.otpAt ?? Date.now()) : null });
  }, [slug, values, cart, otp, step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const touch = (): void => { if (!started.current) { started.current = true; track(slug, 'form'); } };
  const set = (k: string, v: string): void => { touch(); setValues((p) => ({ ...p, [k]: v })); };
  const key = `ls:${slug}:${otp?.otpId ?? ''}`;

  function payload(): Record<string, unknown> {
    const p: Record<string, unknown> = {};
    for (const f of form.fields) {
      if (f.key === 'name' || f.key === 'phone') continue;
      if (f.kind === 'cart') p.items = Object.entries(cart).filter(([, q]) => q > 0).map(([name, qty]) => ({ name, qty }));
      else if (values[f.key]) p[f.key] = values[f.key];
    }
    return p;
  }

  function check(): string {
    if (!consent) return 'Please tick the box to agree before we send a code.';
    for (const f of form.fields) {
      if (!f.required) continue;
      if (f.kind === 'cart') { if (!Object.values(cart).some((q) => q > 0)) return 'Choose at least one item.'; continue; }
      if (!(values[f.key] ?? '').trim()) return `Please fill in: ${f.label}.`;
    }
    if (!/^\d{10}$/.test((values.phone ?? '').replace(/\D/g, '').slice(-10))) return 'Enter a valid 10-digit mobile number.';
    return '';
  }

  async function sendCode(): Promise<void> {
    const problem = check();
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      const r = await post<{ otpId: string }>('/leadspace/public/otp', { slug, phone: values.phone, consent: true, deviceId: deviceId() });
      setOtp(r); setStep('code'); setCooldown(30);
      saveDraft(slug, { at: Date.now(), values, cart, otpId: r.otpId, otpAt: Date.now() });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function confirm(): Promise<void> {
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from WhatsApp.'); return; }
    setBusy(true); setError('');
    try {
      const r = await post<{ message: string }>('/leadspace/public/event', {
        slug, name: values.name, phone: values.phone, payload: payload(), otpId: otp?.otpId, code: code.trim(), idempotencyKey: key, source: 'page', utm: utmFromUrl(), deviceId: deviceId(),
      });
      setThanks(r.message); setStep('done'); saveDraft(slug, null);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (step === 'done') {
    return (
      <div id="request" role="status" className="rounded-2xl p-6 text-center" style={{ background: theme.soft, border: `1px solid ${theme.accent}` }}>
        <p className="text-xl font-bold" style={{ color: theme.accentDark }}>Request received</p>
        <p className="mt-2 text-slate-700">{thanks}</p>
        <p className="mt-3 text-sm text-slate-500">Keep your phone nearby. The business will contact you on this number.</p>
      </div>
    );
  }

  return (
    <form id="request" onSubmit={(e) => { e.preventDefault(); void (step === 'details' ? sendCode() : confirm()); }} className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${theme.accent}` }} noValidate>
      {step === 'details' && restored ? (
        <p className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: theme.soft, color: theme.accentDark }}>
          Welcome back. Your details are still here.{' '}
          <button type="button" className="underline" onClick={() => { setValues({}); setCart({}); setConsent(false); setRestored(false); saveDraft(slug, null); }}>Start again</button>
        </p>
      ) : null}
      {step === 'details' ? (
        <>
          <div className="space-y-4">
            {form.fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}{f.required ? '' : ' (optional)'}</span>
                {f.kind === 'textarea' ? (
                  <textarea className={inputCls} rows={3} maxLength={1000} placeholder={f.hint} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
                ) : f.kind === 'select' ? (
                  <select className={inputCls} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="">Choose</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.kind === 'date' ? (
                  <input className={inputCls} type="date" min={today()} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
                ) : f.kind === 'cart' ? (
                  <div className="space-y-2">
                    {model.cartItems.map((name) => (
                      <div key={name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                        <span className="text-sm text-slate-800">{name}</span>
                        <span className="flex items-center gap-2">
                          <button type="button" aria-label={`One less ${name}`} className="h-9 w-9 rounded-full border border-slate-300 text-lg" onClick={() => { touch(); setCart((c) => ({ ...c, [name]: Math.max(0, (c[name] ?? 0) - 1) })); }}>-</button>
                          <span className="w-6 text-center">{cart[name] ?? 0}</span>
                          <button type="button" aria-label={`One more ${name}`} className="h-9 w-9 rounded-full border border-slate-300 text-lg" onClick={() => { touch(); setCart((c) => ({ ...c, [name]: Math.min(99, (c[name] ?? 0) + 1) })); }}>+</button>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <input className={inputCls} type={f.kind === 'tel' ? 'tel' : 'text'} inputMode={f.kind === 'tel' ? 'numeric' : undefined} autoComplete={f.key === 'name' ? 'name' : f.kind === 'tel' ? 'tel' : 'off'} maxLength={f.kind === 'tel' ? 15 : 120} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
                )}
                {f.hint && f.kind !== 'textarea' ? <span className="mt-1 block text-xs text-slate-500">{f.hint}</span> : null}
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consent} onChange={(e) => { touch(); setConsent(e.target.checked); }} />
            <span>{form.consentText}</span>
          </label>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">We sent a 6-digit code to your WhatsApp number. Enter it to send your request.</p>
          <input className={`${inputCls} text-center text-2xl tracking-widest`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Verification code" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <button type="button" className="underline text-slate-600" onClick={() => { setStep('details'); setCode(''); setError(''); setOtp(null); }}>Wrong number? Go back</button>
            <button type="button" className="underline text-slate-600 disabled:no-underline disabled:opacity-60" disabled={busy || cooldown > 0} onClick={() => { setConsent(true); void sendCode(); }}>{cooldown > 0 ? `Send the code again in ${cooldown}s` : 'Did not get it? Send again'}</button>
          </div>
        </div>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60" style={{ background: theme.accent }}>
        {busy ? 'Please wait...' : step === 'details' ? form.submitLabel : 'Confirm and send'}
      </button>
    </form>
  );
}
