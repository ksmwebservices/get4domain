'use client';

import { useRef, useState } from 'react';
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
      setOtp(r); setStep('code');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function confirm(): Promise<void> {
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from WhatsApp.'); return; }
    setBusy(true); setError('');
    try {
      const r = await post<{ message: string }>('/leadspace/public/event', {
        slug, name: values.name, phone: values.phone, payload: payload(), otpId: otp?.otpId, code: code.trim(), idempotencyKey: key, source: 'page', utm: utmFromUrl(), deviceId: deviceId(),
      });
      setThanks(r.message); setStep('done');
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
          <button type="button" className="text-sm underline text-slate-600" onClick={() => { setStep('details'); setCode(''); setError(''); }}>Wrong number? Go back</button>
        </div>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60" style={{ background: theme.accent }}>
        {busy ? 'Please wait...' : step === 'details' ? form.submitLabel : 'Confirm and send'}
      </button>
    </form>
  );
}
