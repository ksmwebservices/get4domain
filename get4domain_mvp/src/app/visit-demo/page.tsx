'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, ArrowLeft, Smartphone, Play, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { getCategory, getSubcategories } from '@/data/demo-site';

/**
 * The ONE entry point to any demo. Middleware redirects every un-verified /demo/* hit
 * here. The visitor verifies name + mobile OTP; on success /api/demo/verify mints the
 * server-side pass and returns the demo URL to navigate to. No demo content is ever
 * reachable without passing through this flow.
 */
function VisitDemoInner() {
  const params = useSearchParams();
  const to = params.get('to') || '';
  const { category, sub } = useMemo(() => {
    const parts = to.split('?')[0].split('/').filter(Boolean); // ['demo', cat, sub?]
    const cat = parts[1] || '';
    const seg3 = parts[2];
    const s = seg3 && getSubcategories(cat).some((x) => x.id === seg3 && x.id !== 'general') ? seg3 : undefined;
    return { category: cat, sub: s };
  }, [to]);
  const catName = category ? getCategory(category)?.name ?? 'this' : 'this';

  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizedPhone = (() => { const d = phone.replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; })();
  const validPhone = normalizedPhone.length === 10;

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
      const res = await fetch('/api/demo/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: normalizedPhone, code, category, sub, to }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        if (j?.redirect) { window.location.href = j.redirect; return; }
        throw new Error(j?.error || 'Invalid or expired code. Please try again.');
      }
      try {
        sessionStorage.setItem('g4d_demo_verified', '1');
        sessionStorage.setItem('g4d_demo_phone', normalizedPhone);
        sessionStorage.setItem('g4d_demo_name', name);
      } catch { /* ignore */ }
      window.location.href = j.redirect || to || '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code. Please try again.');
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary-400/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-16 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 h-[30rem] w-[30rem] rounded-full bg-primary-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-warning-500/10 blur-[110px]" />
      </div>
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3 py-1 text-[11px] font-medium text-primary-300">
          <Play className="h-3 w-3" /> {catName} demo
        </div>

        {step === 'details' ? (
          <>
            <h1 className="flex items-center gap-2 text-lg font-bold"><Lock className="h-4 w-4 text-primary-300" /> Verify to view the demo</h1>
            <p className="mt-1 text-sm text-slate-400">Demos are shown after a quick mobile verification. Enter your name and number and we&apos;ll text a one-time code.</p>
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
            <h1 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-4 w-4 text-primary-300" /> Verify your mobile</h1>
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
        <p className="mt-2 text-center text-[11px] text-slate-500"><Link href="/" className="hover:text-slate-300">← Back to Get4Domain</Link></p>
      </div>
    </div>
  );
}

export default function VisitDemoPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading…</div>}>
      <VisitDemoInner />
    </Suspense>
  );
}
