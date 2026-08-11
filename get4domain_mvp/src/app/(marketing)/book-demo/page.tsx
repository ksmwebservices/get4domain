'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck, Check, ArrowRight, ArrowLeft, ShieldCheck, Smartphone, Building2, PlayCircle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import PageHero from '@/components/PageHero';
import { api } from '@/lib/api';
import { INDUSTRIES } from '@/data/industries-list';
import { setSession } from '@/lib/auth';

interface Sandbox { vendorId: string; token: string; industry: string; expiresAt: string | null; customerToken?: string | null }

// Canonical industry list — the SAME 20 used by /industries and /demo/[id]. The
// dropdown value is the canonical `id`, so it feeds /demo/[id] + seedVendor directly.

type Step = 'industry' | 'details' | 'otp' | 'done';
const STEPS: { key: Step; label: string }[] = [
  { key: 'industry', label: 'Industry' },
  { key: 'details', label: 'You' },
  { key: 'otp', label: 'Verify' },
];

export default function BookDemoPage() {
  const [step, setStep] = useState<Step>('industry');
  const [industry, setIndustry] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  // Normalise to a clean 10-digit Indian mobile: strip +91 / 0 prefix, spaces,
  // dashes, brackets — keep the last 10 digits. This is what's sent everywhere.
  const normalizedPhone = (() => {
    const d = phone.replace(/\D/g, '');
    return d.length > 10 ? d.slice(-10) : d;
  })();
  const validPhone = normalizedPhone.length === 10;
  const industryName = INDUSTRIES.find((i) => i.id === industry)?.name ?? '';

  const sendOtp = async () => {
    if (!validPhone) { setError('Enter a valid 10-digit mobile number.'); return; }
    setError(''); setLoading(true); setDevCode(null);
    try {
      const res = await api.requestOtp(normalizedPhone);
      if (res.data?.devCode) setDevCode(res.data.devCode as string);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.verifyDemoLead({ name, phone: normalizedPhone, industry, code });
      setSandbox((res.data?.sandbox as Sandbox | undefined) ?? null);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Seat the sandbox session + tour context and enter the unified tour on the
  // demo website. The floating TourNav then switches between website / dashboard /
  // customer portal in the same session (no re-auth).
  const startTour = () => {
    if (!sandbox) return;
    localStorage.setItem('g4d_token', sandbox.token);
    localStorage.setItem('g4d_tour', JSON.stringify({ industry: sandbox.industry, customerToken: sandbox.customerToken ?? null }));
    setSession({
      id: sandbox.vendorId,
      name: name || 'Demo User',
      email: '',
      role: 'vendor',
      businessName: `${industryName || 'Your'} Demo`,
      industry: sandbox.industry,
      plan: 'Demo Sandbox',
      initials: (name || 'D').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2),
    });
    window.location.href = `/demo/${sandbox.industry}`;
  };

  /* --------------------------------- done ---------------------------------- */
  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-50/50 via-white to-white">
        <header className="pt-8 px-5">
          <div className="container-mx">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 shadow-md">
                <CalendarCheck className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">Get4<span className="text-primary-600">Domain</span></span>
            </Link>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-5 py-16 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-100">
              <Check className="h-10 w-10 text-success-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Mobile verified 🎉</h1>
            <p className="mt-3 text-slate-600">
              Thanks, {name.split(' ')[0] || 'there'}. Your {industryName || 'business'} demo is ready. Take an interactive tour
              of Get4Domain, or our team will call you to walk through it.
            </p>
            <div className="mt-6 flex justify-center">
              {sandbox ? (
                <Button size="lg" leftIcon={<PlayCircle className="h-5 w-5" />} onClick={startTour}>Start Interactive Tour</Button>
              ) : (
                <Link href={`/demo/${industry || 'general'}`}><Button size="lg" variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />}>Explore Your Demo Site</Button></Link>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              {sandbox
                ? 'One tour, everything included — switch between your website, dashboard and customer portal from the floating menu. Sandbox expires in 48 hours.'
                : 'The guided interactive demo is rolling out shortly. You’re on the list.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------- wizard --------------------------------- */
  return (
    <>
      <PageHero
        eyebrow="Book a Free Demo"
        title="See Get4Domain for your business"
        description="Takes under a minute — pick your industry, verify your mobile, and get instant access to your demo."
        breadcrumbs={[{ label: 'Book a Demo' }]}
      />

      <section className="pb-24">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-lg">

            {/* Stepper */}
            <div className="mb-8 flex items-center">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${i < stepIndex ? 'bg-success-500 text-white' : i === stepIndex ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`mt-1.5 text-[11px] font-medium ${i === stepIndex ? 'text-primary-700' : 'text-slate-400'}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`mx-1 h-0.5 flex-1 rounded ${i < stepIndex ? 'bg-success-400' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>

            {/* Step: industry */}
            {step === 'industry' && (
              <div className="card-base p-6">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 mb-1"><Building2 className="h-4 w-4 text-primary-600" /> Your industry</h3>
                <p className="text-xs text-slate-500 mb-4">We&apos;ll tailor the demo to your line of business.</p>
                <select required value={industry} onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                  <option value="">Select your industry</option>
                  {INDUSTRIES.map((ind) => <option key={ind.id} value={ind.id}>{ind.icon} {ind.name}</option>)}
                </select>
                <Button className="mt-6" size="lg" fullWidth disabled={!industry} onClick={() => { setError(''); setStep('details'); }} rightIcon={<ArrowRight className="h-4 w-4" />}>Continue</Button>
              </div>
            )}

            {/* Step: details */}
            {step === 'details' && (
              <div className="card-base p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-900">Your details</h3>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name <span className="text-error-500">*</span></label>
                  <input type="text" placeholder="Ravi Kumar" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Mobile Number <span className="text-error-500">*</span></label>
                  <input type="tel" inputMode="numeric" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  <p className="mt-1.5 text-xs text-slate-400">We&apos;ll send a one-time code to verify this number.</p>
                </div>
                {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('industry')} leftIcon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
                  <Button fullWidth loading={loading} disabled={!name.trim() || !validPhone} onClick={sendOtp} rightIcon={<ArrowRight className="h-4 w-4" />}>Send Code</Button>
                </div>
              </div>
            )}

            {/* Step: otp */}
            {step === 'otp' && (
              <div className="card-base p-6 space-y-4">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-primary-600" /> Verify your mobile</h3>
                <p className="text-sm text-slate-500">Enter the 6-digit code sent to <strong className="text-slate-700">+91 {normalizedPhone}</strong>.</p>
                {devCode && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                    Dev mode (SMS not configured): your code is <strong>{devCode}</strong>.
                  </div>
                )}
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" inputMode="numeric" maxLength={8} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
                <Button size="lg" fullWidth loading={loading} disabled={code.length < 4} onClick={verify} leftIcon={<ShieldCheck className="h-5 w-5" />}>Verify &amp; Continue</Button>
                <div className="flex items-center justify-between text-xs">
                  <button onClick={() => { setStep('details'); setError(''); }} className="text-slate-500 hover:text-slate-700">← Change number</button>
                  <button onClick={sendOtp} disabled={loading} className="font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50">Resend code</button>
                </div>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-slate-400">Free demo · No spam · Your number is only used to verify you.</p>
          </div>
        </div>
      </section>
    </>
  );
}
