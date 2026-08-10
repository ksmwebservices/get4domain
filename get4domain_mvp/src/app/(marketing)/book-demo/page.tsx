'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck, Check, Phone, MessageCircle, ArrowRight, ArrowLeft,
  Globe, Megaphone, Building2, Sparkles, Clock, User, CalendarDays,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import PageHero from '@/components/PageHero';
import { api } from '@/lib/api';

const industries = [
  'Restaurant & Food', 'Travel & Tours', 'Real Estate', 'Clinic & Hospital',
  'School & College', 'Construction & Interior', 'Retail & Shopping', 'Salon & Spa',
  'Gym & Fitness', 'CA & Professional Services', 'Events & Entertainment',
  'Finance & Insurance', 'Automobile & Showroom', 'Logistics & Transport',
  'Diagnostic Lab', 'Hotel & Hospitality', 'Photography & Studio',
  'IT & Software Company', 'Agriculture & Farm', 'Coaching & Tuition', 'Other',
];

// One product (DomainApp — everything included). These are *goals*, not separate
// plans, so the demo can be tailored to what the visitor cares about most.
const interests = [
  { id: 'website', label: 'A professional website', desc: 'An industry website that wins customers', icon: Globe },
  { id: 'campaigns', label: 'Reach more customers', desc: 'WhatsApp, social, ads & lead follow-up', icon: Megaphone },
  { id: 'manage', label: 'Run my business', desc: 'Bookings, invoices, CRM in one place', icon: Building2 },
  { id: 'everything', label: 'Show me everything', desc: 'The full DomainApp — all features', icon: Sparkles },
];

const TIME_SLOTS = ['10:00 AM', '11:30 AM', '1:00 PM', '3:00 PM', '4:30 PM', '6:00 PM'];

/** Next `count` working days (skips Sundays), starting tomorrow. */
function upcomingDays(count = 8): Date[] {
  const days: Date[] = [];
  const d = new Date();
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue; // skip Sunday
    days.push(new Date(d));
  }
  return days;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const STEPS = ['You', 'Details', 'Slot', 'Confirm'];

export default function BookDemoPage() {
  const days = useMemo(() => upcomingDays(8), []);

  const [step, setStep] = useState(0); // 0..3
  const [interest, setInterest] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', phone: '', email: '', business: '', industry: '', message: '',
  });

  const interestObj = interests.find((i) => i.id === interest);

  const canNext =
    step === 0 ? Boolean(interest && form.industry) :
    step === 1 ? Boolean(form.name && form.phone && form.business) :
    step === 2 ? Boolean(selectedDay && selectedSlot) :
    true;

  const goNext = () => {
    if (!canNext) {
      setError(
        step === 0 ? 'Please choose a goal and your industry.' :
        step === 1 ? 'Please fill in your name, mobile and business name.' :
        'Please pick a preferred date and time.',
      );
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, 3));
  };
  const goBack = () => { setError(''); setStep((s) => Math.max(s - 1, 0)); };

  const prettyDay = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.createLead({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        business: form.business,
        industry: form.industry,
        interest: interestObj?.label ?? interest ?? 'Not sure',
        preferredDate: selectedDay || undefined,
        preferredSlot: selectedSlot || undefined,
        message: form.message || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request — please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------- success ---------------------------------- */
  if (submitted) {
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
            <h1 className="text-2xl font-bold text-slate-900">Demo Booked!</h1>
            <p className="mt-3 text-slate-600">
              Thanks, {form.name.split(' ')[0] || 'there'}. Our consultant will call you
              {selectedDay && selectedSlot ? <> around <strong>{selectedSlot}</strong> on <strong>{prettyDay(selectedDay)}</strong></> : <> within <strong>24 hours</strong></>} for a live demo tailored to your {form.industry || 'business'}.
            </p>

            {selectedDay && selectedSlot && (
              <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 text-left">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-primary-600 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{prettyDay(selectedDay)}</div>
                    <div className="text-xs text-slate-500">{selectedSlot} · ~30 minutes</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <div className="card-base p-4 flex items-center gap-3 text-left">
                <Phone className="h-5 w-5 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Consultant Call</div>
                  <div className="text-xs text-slate-500">On your registered number {form.phone}</div>
                </div>
              </div>
              <div className="card-base p-4 flex items-center gap-3 text-left">
                <MessageCircle className="h-5 w-5 text-success-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">WhatsApp Confirmation</div>
                  <div className="text-xs text-slate-500">Booking confirmation sent to your WhatsApp</div>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
              <Link href="/industries"><Button variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />}>Explore Industries</Button></Link>
              <Link href="/"><Button>Back to Home</Button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------- wizard ---------------------------------- */
  return (
    <>
      <PageHero
        eyebrow="Book a Free Demo"
        title="See Get4Domain for your business"
        description="A quick 3-step booking. Pick a slot that suits you — our consultant calls you for a 30-minute live demo tailored to your industry."
        breadcrumbs={[{ label: 'Book a Demo' }]}
      />

      <section className="pb-24">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-2xl">

            {/* Stepper */}
            <div className="mb-8">
              <div className="flex items-center">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                        i < step ? 'bg-success-500 text-white' : i === step ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {i < step ? <Check className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={`mt-1.5 text-[11px] font-medium ${i === step ? 'text-primary-700' : 'text-slate-400'}`}>{s}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`mx-1 h-0.5 flex-1 rounded ${i < step ? 'bg-success-400' : 'bg-slate-200'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 0 — goal + industry */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="card-base p-6">
                  <h3 className="text-base font-bold text-slate-900 mb-1">What matters most to you?</h3>
                  <p className="text-xs text-slate-500 mb-5">Everything is included in DomainApp — this just helps us tailor the demo.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {interests.map((item) => {
                      const Icon = item.icon;
                      const on = interest === item.id;
                      return (
                        <button key={item.id} type="button" onClick={() => setInterest(item.id)}
                          className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${on ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${on ? 'bg-primary-100' : 'bg-slate-100'}`}>
                            <Icon className={`h-[18px] w-[18px] ${on ? 'text-primary-600' : 'text-slate-500'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 leading-tight">{item.label}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                          </div>
                          {on && <Check className="ml-auto h-4 w-4 text-primary-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="card-base p-6">
                  <h3 className="text-base font-bold text-slate-900 mb-1">Your industry <span className="text-error-500">*</span></h3>
                  <p className="text-xs text-slate-500 mb-4">We&apos;ll show the workspace built for your line of business.</p>
                  <select required value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                    <option value="">Select your industry</option>
                    {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                  {form.industry && form.industry !== 'Other' && (
                    <p className="mt-3 text-sm text-primary-700">Great — we&apos;ll tailor the demo to your <strong>{form.industry}</strong> business.</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 1 — details */}
            {step === 1 && (
              <div className="card-base p-6">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 mb-5"><User className="h-4 w-4 text-primary-600" /> Your details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name <span className="text-error-500">*</span></label>
                    <input required type="text" placeholder="Ravi Kumar" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Mobile Number <span className="text-error-500">*</span></label>
                    <input required type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
                    <input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Name <span className="text-error-500">*</span></label>
                    <input required type="text" placeholder="Ravi Enterprises" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — slot picker */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="card-base p-6">
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 mb-1"><CalendarDays className="h-4 w-4 text-primary-600" /> Pick a date</h3>
                  <p className="text-xs text-slate-500 mb-4">Choose a day that works for your demo call.</p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                    {days.map((d) => {
                      const iso = isoDay(d);
                      const on = selectedDay === iso;
                      return (
                        <button key={iso} type="button" onClick={() => setSelectedDay(iso)}
                          className={`flex min-w-[68px] flex-col items-center rounded-xl border-2 px-3 py-2.5 transition-all ${on ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <span className={`text-[11px] font-medium ${on ? 'text-primary-600' : 'text-slate-400'}`}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                          <span className={`text-lg font-bold ${on ? 'text-primary-700' : 'text-slate-800'}`}>{d.getDate()}</span>
                          <span className={`text-[11px] ${on ? 'text-primary-600' : 'text-slate-400'}`}>{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="card-base p-6">
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 mb-1"><Clock className="h-4 w-4 text-primary-600" /> Pick a time</h3>
                  <p className="text-xs text-slate-500 mb-4">All times are IST. Slots are approximate — the consultant confirms on call.</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {TIME_SLOTS.map((slot) => {
                      const on = selectedSlot === slot;
                      return (
                        <button key={slot} type="button" onClick={() => setSelectedSlot(slot)}
                          className={`rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition-all ${on ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — confirm */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="card-base p-6">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Review your booking</h3>
                  <dl className="space-y-3 text-sm">
                    {[
                      ['Name', form.name],
                      ['Business', form.business],
                      ['Industry', form.industry],
                      ['Mobile', form.phone],
                      ...(form.email ? [['Email', form.email]] : []),
                      ['Interested in', interestObj?.label ?? '—'],
                      ['Preferred slot', selectedDay && selectedSlot ? `${prettyDay(selectedDay)} · ${selectedSlot}` : '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="text-right font-medium text-slate-900">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="card-base p-6">
                  <h3 className="text-base font-bold text-slate-900 mb-3">Anything specific to discuss? <span className="text-xs font-normal text-slate-400">(optional)</span></h3>
                  <textarea rows={3} placeholder="e.g. I want to see how bookings & invoices work for my business…"
                    value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none" />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>
            )}

            {/* Nav */}
            <div className="mt-6 flex items-center gap-3">
              {step > 0 && (
                <Button variant="outline" onClick={goBack} leftIcon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
              )}
              {step < 3 ? (
                <Button size="lg" fullWidth onClick={goNext} rightIcon={<ArrowRight className="h-4 w-4" />}>Continue</Button>
              ) : (
                <Button size="lg" fullWidth loading={loading} onClick={submit} leftIcon={<CalendarCheck className="h-5 w-5" />}>Confirm Demo Booking</Button>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">Free 30-minute demo · No obligation, no spam.</p>
          </div>
        </div>
      </section>
    </>
  );
}
