'use client';

import { Rocket, ArrowRight, CheckCircle2, Globe, Megaphone, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Button from './ui/Button';

const stats = [
  { value: '50+', label: 'Businesses Launched' },
  { value: '20+', label: 'Industries Served' },
  { value: '₹999', label: 'Starting' },
];

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden pt-28 pb-16 lg:pt-36 lg:pb-24">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-white to-white" />
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary-200/30 blur-3xl" />
        <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-secondary-200/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="container-mx container-px">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left content */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-600" />
              </span>
              SaaS Platform for Indian SMBs
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl text-balance">
              Professional{' '}
              <span className="gradient-text">Business Launch</span>{' '}
              Made Easy
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-slate-600 max-w-xl">
              Get4Domain gives Indian SMBs a complete platform — professional websites, business management software and managed digital marketing. One subscription, everything included.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Globe className="h-4 w-4 text-primary-600 flex-shrink-0" />
                <span><strong>DomainApp</strong> — Business Website + CRM + HR + Accounting + Invoicing</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Megaphone className="h-4 w-4 text-secondary-500 flex-shrink-0" />
                <span><strong>DomainCampaign</strong> — Managed Social Media, SEO & Digital Marketing</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/book-demo">
                <Button size="lg" leftIcon={<CalendarCheck className="h-5 w-5" />} rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Book a Free Demo
                </Button>
              </Link>
              <Link href="/industries">
                <Button size="lg" variant="outline">
                  See Industry Demos
                </Button>
              </Link>
            </div>

            <p className="mt-4 text-xs text-slate-400">No commitment required. Our consultant calls you within 24 hours.</p>

            {/* Stats */}
            <div className="mt-10 flex flex-wrap gap-6 border-t border-slate-100 pt-8">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — product showcase cards */}
          <div className="relative hidden lg:block">
            <div className="relative">
              {/* DomainApp card */}
              <div className="card-base p-6 shadow-premium mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">DomainApp</div>
                    <div className="text-xs text-slate-500">Business Operating System</div>
                  </div>
                  <span className="ml-auto rounded-full bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-700">Live Demo</span>
                </div>
                <div className="relative h-40 rounded-xl overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=800"
                    alt="MR Travels — DomainApp"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="text-sm font-bold text-white">MR Travels</div>
                    <div className="text-xs text-white/70">mrtravels.get4domain.com</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Website', 'Fleet CRM', 'Invoicing', 'Trip Sheets', 'Reports'].map(f => (
                    <span key={f} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">{f}</span>
                  ))}
                </div>
              </div>

              {/* DomainCampaign badge */}
              <div className="card-base p-4 flex items-center gap-3 shadow-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-500 flex-shrink-0">
                  <Megaphone className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900">DomainCampaign</div>
                  <div className="text-xs text-slate-500">120 posts/mo · SEO · GBP · Reports</div>
                </div>
                <span className="rounded-full bg-secondary-50 px-2.5 py-1 text-xs font-semibold text-secondary-700 flex-shrink-0">Managed</span>
              </div>

              {/* Floating badge */}
              <div className="absolute -right-4 top-4 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-card">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success-500" />
                  <span className="text-xs font-semibold text-slate-700">GST Compliant</span>
                </div>
              </div>
              <div className="absolute -left-4 bottom-16 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-card">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success-500" />
                  <span className="text-xs font-semibold text-slate-700">20+ Industries</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
