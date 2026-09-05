'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, ShieldCheck, ArrowRight, ArrowLeft, Smartphone, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { getCategory } from '@/data/demo-site';

/**
 * Mandatory demo-gate. Intercepts every click on a "/demo/..." link inside the
 * marketing tree and requires a quick name + mobile OTP verification before
 * redirecting to the actual demo. Reuses the EXISTING book-demo OTP flow:
 *   - api.requestOtp(phone)                → POST /otp/request (Fast2SMS)
 *   - api.verifyDemoLead({name,phone,industry,code}) → POST /leads/demo
 *     (verifies the OTP AND records the CRM/TeleCRM lead, same data shape as
 *     the book-demo funnel). This is a new, lighter variant — capture lead then
 *     redirect to the static demo — built alongside book-demo, never replacing it.
 *
 * Once verified in a session, later demo links go straight through (the gate
 * still runs on every link; it just doesn't re-OTP a verified visitor).
 */

const VERIFIED_KEY = 'g4d_demo_verified';
const PHONE_KEY = 'g4d_demo_phone';
const NAME_KEY = 'g4d_demo_name';

type Step = 'details' | 'otp';

export default function DemoGateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');   // the /demo/... path to reach after verify
  const [category, setCategory] = useState(''); // canonical category id → lead "industry"
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizedPhone = (() => { const d = phone.replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; })();
  const validPhone = normalizedPhone.length === 10;
  const catName = category ? getCategory(category)?.name ?? '' : '';

  const reset = () => { setName(''); setPhone(''); setCode(''); setDevCode(null); setError(''); setStep('details'); };
  const close = useCallback(() => { setOpen(false); setLoading(false); }, []);

  // Intercept demo links anywhere in the marketing tree (capture phase, before
  // Next's Link navigation). Modified clicks (new tab, etc.) pass through.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as HTMLElement | null)?.closest?.('a[href^="/demo/"]') as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute('href') || '';
      if (!/^\/demo\/[^/]+/.test(href)) return;
      e.preventDefault();
      e.stopPropagation();
      let verified = false;
      try { verified = sessionStorage.getItem(VERIFIED_KEY) === '1'; } catch { /* ignore */ }
      // Already verified this session: navigate directly. The server middleware still
      // gates the request against the signed pass cookie (re-verifying if it expired),
      // so this is never a bypass.
      if (verified) { window.location.href = href; return; }
      reset();
      setTarget(href);
      setCategory(href.split('/')[2] || '');
      setOpen(true);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, close]);

  const sendOtp = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!validPhone) { setError('Enter a valid 10-digit mobile number.'); return; }
    setError(''); setLoading(true); setDevCode(null);
    try {
      const res = await api.requestOtp(normalizedPhone);
      const dc = (res as { data?: { devCode?: string } })?.data?.devCode;
      if (dc) setDevCode(dc);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code — please try again.');
    } finally { setLoading(false); }
  };

  const verify = async () => {
    setError(''); setLoading(true);
    try {
      // Mint the server-side access pass (verifies OTP + applies cap/lock server-side).
      const res = await fetch('/api/demo/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: normalizedPhone, code, category, to: target }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        if (j?.redirect) { window.location.href = j.redirect; return; } // capped / locked → sales
        throw new Error(j?.error || 'Invalid or expired code. Please try again.');
      }
      try {
        sessionStorage.setItem(VERIFIED_KEY, '1');
        sessionStorage.setItem(PHONE_KEY, normalizedPhone);
        sessionStorage.setItem(NAME_KEY, name);
      } catch { /* ignore */ }
      window.location.href = j.redirect || target;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code. Please try again.');
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

  return (
    <>
      {children}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Verify to view the demo">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            {/* glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary-500/15 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-warning-500/10 blur-3xl" />
            </div>
            <button onClick={close} aria-label="Close" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3 py-1 text-[11px] font-medium text-primary-300">
              <Play className="h-3 w-3" /> {catName ? `${catName} demo` : 'Live demo'}
            </div>

            {step === 'details' ? (
              <>
                <h2 className="text-lg font-bold text-white">See the live demo</h2>
                <p className="mt-1 text-sm text-slate-400">Quick verify — enter your name and mobile and we&apos;ll text a one-time code. Then you&apos;re straight into the demo.</p>
                <div className="mt-5 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">Full name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Kumar" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">Mobile number</label>
                    <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
                  </div>
                  {error && <div className="rounded-xl border border-error-500/30 bg-error-500/10 px-4 py-2.5 text-sm text-error-300">{error}</div>}
                  <button onClick={sendOtp} disabled={loading || !name.trim() || !validPhone}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber disabled:opacity-50">
                    {loading ? 'Sending…' : 'Send code'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="flex items-center gap-2 text-lg font-bold text-white"><ShieldCheck className="h-4 w-4 text-primary-300" /> Verify your mobile</h2>
                <p className="mt-1 text-sm text-slate-400">Enter the 6-digit code sent to <strong className="text-slate-200">+91 {normalizedPhone}</strong>.</p>
                {devCode && (
                  <div className="mt-3 rounded-xl border border-warning-400/30 bg-warning-500/10 px-4 py-2.5 text-sm text-warning-200">
                    Dev mode (SMS not configured): your code is <strong>{devCode}</strong>.
                  </div>
                )}
                <div className="relative mt-4">
                  <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="text" inputMode="numeric" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
                    className="w-full rounded-xl border border-white/10 bg-slate-800/60 py-3 pl-10 pr-4 text-center text-lg font-bold tracking-[0.3em] text-white focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
                {error && <div className="mt-3 rounded-xl border border-error-500/30 bg-error-500/10 px-4 py-2.5 text-sm text-error-300">{error}</div>}
                <button onClick={verify} disabled={loading || code.length < 4}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber disabled:opacity-50">
                  <ShieldCheck className="h-4 w-4" /> {loading ? 'Verifying…' : 'Verify & view demo'}
                </button>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <button onClick={() => { setStep('details'); setError(''); }} className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200"><ArrowLeft className="h-3 w-3" /> Change number</button>
                  <button onClick={sendOtp} disabled={loading} className="font-semibold text-primary-300 hover:text-primary-200 disabled:opacity-50">Resend code</button>
                </div>
              </>
            )}

            <p className="mt-4 text-center text-[11px] text-slate-500">No spam · Your number is only used to verify you.</p>
          </div>
        </div>
      )}
    </>
  );
}
