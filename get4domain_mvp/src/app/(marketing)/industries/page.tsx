import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { INDUSTRIES } from '@/data/industries-list';

export const metadata: Metadata = {
  title: '20+ Industry Solutions — Restaurant, Travel, Clinic & More',
  description: 'Get4Domain serves 20+ industries with industry-specific websites and Workplace dashboards. Your dashboard speaks your business language — Bookings, Orders, Appointments and more.',
  alternates: { canonical: 'https://get4domain.com/industries' },
};

// Categories with the richest live demo content (full sub-category demo sites).
const RICH_DEMO = new Set(['clinic', 'salon', 'gym', 'restaurant', 'retail', 'professional', 'travel', 'realestate', 'education']);

export default function IndustriesPage() {
  return (
    <>
      {/* HERO + GRID — dark, homepage visual family */}
      <div className="relative overflow-hidden bg-slate-950 text-slate-100">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary-600/15 blur-[120px]" />
          <div className="absolute right-0 top-20 h-[26rem] w-[26rem] rounded-full bg-warning-500/10 blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>

        <div className="relative mx-auto max-w-3xl px-4 pb-4 pt-16 text-center sm:px-6 md:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            20+ industries
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Built for <span className="text-gradient-hero">every industry.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Your website and Workplace speak your business&apos;s language. Pick your industry to see a live demo and what your dashboard looks like.
          </p>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 md:pb-24 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((ind) => (
              <div key={ind.id} className="group flex flex-col rounded-2xl border border-white/5 bg-slate-800/60 p-6 backdrop-blur-xl transition-all hover:border-primary-400/20 hover:shadow-glow">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/60 text-2xl">{ind.icon}</span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white">{ind.name}</h2>
                    {RICH_DEMO.has(ind.id) && <span className="text-[11px] font-medium text-success-300">● Live demo ready</span>}
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm text-slate-400">
                  Records become <span className="font-semibold text-slate-200">{ind.records}</span>, Contacts become <span className="font-semibold text-slate-200">{ind.contacts}</span>.
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <Link href={`/industries/${ind.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-300 transition-all group-hover:gap-2.5 hover:text-primary-200">
                    Explore <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href={`/demo/${ind.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white">
                    <Play className="h-3.5 w-3.5" /> Live demo
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DON'T SEE YOUR INDUSTRY — light close */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Don&apos;t see your industry?</h2>
          <p className="mt-3 text-slate-600">We configure new industries in days. Book a demo and we&apos;ll tailor a website + Workplace to how your business actually works.</p>
          <Link href="/book-demo" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-medium text-white transition hover:bg-primary-500">Book a Free Demo <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </>
  );
}
