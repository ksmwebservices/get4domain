'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Check, Phone, MessageCircle, ArrowRight, Globe, Megaphone, Building2 } from 'lucide-react';
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

const interestedIn = [
  { id: 'domainapp-startup', label: 'DomainApp Startup', desc: '₹6,999/yr', icon: Globe },
  { id: 'domainapp-enterprise', label: 'DomainApp Enterprise', desc: '₹24,999/yr', icon: Globe },
  { id: 'campaign-starter', label: 'DomainCampaign Starter', desc: '₹6,999/yr', icon: Megaphone },
  { id: 'campaign-business', label: 'DomainCampaign Business', desc: '₹29,999/yr', icon: Megaphone },
  { id: 'both', label: 'DomainApp + DomainCampaign', desc: 'Combined', icon: Building2 },
  { id: 'not-sure', label: 'Not sure — advise me', desc: 'Consultant will guide', icon: CalendarCheck },
];

export default function BookDemoPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    business: '',
    industry: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError('Please select what you are interested in.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.createLead({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        business: form.business,
        industry: form.industry,
        interest: interestedIn.find((i) => i.id === selected)?.label ?? selected,
        message: form.message || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request — please try again.');
    } finally {
      setLoading(false);
    }
  };

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
              Thank you for your interest. Our consultant will call you within <strong>24 hours</strong> to understand your requirements and show a live demo.
            </p>
            <div className="mt-6 space-y-3">
              <div className="card-base p-4 flex items-center gap-3 text-left">
                <Phone className="h-5 w-5 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Consultant Call</div>
                  <div className="text-xs text-slate-500">Within 24 hours on your registered number</div>
                </div>
              </div>
              <div className="card-base p-4 flex items-center gap-3 text-left">
                <MessageCircle className="h-5 w-5 text-success-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">WhatsApp Confirmation</div>
                  <div className="text-xs text-slate-500">Demo booking confirmation sent to your WhatsApp</div>
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

  return (
    <>
      <PageHero
        eyebrow="Book a Demo"
        title="Talk to Our Business Consultant"
        description="Fill this short form. Our consultant will call you within 24 hours, show you a live demo for your industry and recommend the right plan."
        breadcrumbs={[{ label: 'Book a Demo' }]}
      />

      <section className="pb-20">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Personal details */}
              <div className="card-base p-6">
                <h3 className="text-base font-bold text-slate-900 mb-5">Your Details</h3>
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

              {/* Industry */}
              <div className="card-base p-6">
                <h3 className="text-base font-bold text-slate-900 mb-5">Business Industry <span className="text-error-500">*</span></h3>
                <select required value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                  <option value="">Select your industry</option>
                  {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>

              {/* Interested in */}
              <div className="card-base p-6">
                <h3 className="text-base font-bold text-slate-900 mb-2">I am interested in <span className="text-error-500">*</span></h3>
                <p className="text-xs text-slate-500 mb-5">Not sure? Choose "advise me" — our consultant will recommend based on your goals.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {interestedIn.map((item) => {
                    const Icon = item.icon;
                    const isSelected = selected === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelected(item.id)}
                        className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${isSelected ? 'border-primary-500 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${isSelected ? 'bg-primary-100' : 'bg-slate-100'}`}>
                          <Icon className={`h-4.5 w-4.5 ${isSelected ? 'text-primary-600' : 'text-slate-500'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 leading-tight">{item.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                        </div>
                        {isSelected && <Check className="ml-auto h-4 w-4 text-primary-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message */}
              <div className="card-base p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">Anything specific you want to discuss?</h3>
                <textarea
                  rows={3}
                  placeholder="e.g. I want to see how the booking system works for a travel business..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>
              )}

              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={loading}
                leftIcon={<CalendarCheck className="h-5 w-5" />}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Book My Free Demo
              </Button>

              <p className="text-center text-xs text-slate-400">
                Our consultant will call you within 24 hours. No obligation, no spam.
              </p>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
