import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import Faq from '@/components/marketing/Faq';

export const metadata: Metadata = {
  title: 'Get4Domain — Your Online Identity Partner | ₹999/month',
  description:
    "Get4Domain is India's complete online identity platform. One plan — DomainApp ₹999/month: industry website, business workspace, CRM, campaigns and AI Studio, everything included.",
  alternates: { canonical: 'https://get4domain.com' },
};

// Everything included in the single DomainApp plan.
const PLAN_FEATURES = [
  'Professional industry website (we build)',
  'Mini BOS workspace (contacts, catalog, records, invoicing)',
  'CRM + TeleCRM',
  'Campaign pages + social media',
  'AI Studio with ₹499 free credit',
  'Team access',
  'Free subdomain + hosting + SSL',
];

const MODULES = [
  { icon: '📋', title: 'DomainApp', desc: 'Contacts, catalog, records, invoicing — adapted to your industry' },
  { icon: '📣', title: 'Growth Hub', desc: 'Landing pages, social media, paid ads — all managed for you' },
  { icon: '📞', title: 'TeleCRM', desc: 'Smart call queue, AI summaries, pipeline tracking' },
  { icon: '✨', title: 'AI Studio', desc: 'Social posts, reels, blogs, posters — created by AI in seconds' },
  { icon: '💬', title: 'Communication Hub', desc: 'Unified inbox for WhatsApp, SMS and Email' },
  { icon: '🌐', title: 'Website Manager', desc: 'Professional industry website with an easy CMS' },
  { icon: '👥', title: 'Customer Hub', desc: 'Your customers track bookings, invoices and support' },
  { icon: '📊', title: 'Analytics Hub', desc: 'Revenue, leads, campaigns — all your numbers in one view' },
  { icon: '💳', title: 'Wallet & Billing', desc: 'Prepaid wallet for services, transparent usage tracking' },
  { icon: '⚙️', title: 'Admin Platform', desc: 'Manage your team, integrations and settings' },
];

const INDUSTRIES = [
  { icon: '🚗', label: 'Travel & Tours', href: '/industries/travel' },
  { icon: '🍽️', label: 'Restaurant & Cafe', href: '/industries/restaurant' },
  { icon: '🏥', label: 'Clinic & Healthcare', href: '/industries/clinic' },
  { icon: '🏨', label: 'Hotel & Hospitality', href: '/industries/hotel' },
  { icon: '💇', label: 'Salon & Beauty', href: '/industries/salon' },
  { icon: '🏗️', label: 'Construction', href: '/industries/construction' },
  { icon: '🎓', label: 'Education & Coaching', href: '/industries/education' },
  { icon: '🛒', label: 'Retail & E-commerce', href: '/industries/retail' },
];

const STEPS = [
  { icon: '📋', title: 'Tell Us Your Business', desc: 'Book a free demo. We understand your industry and needs.' },
  { icon: '⚙️', title: 'We Set Everything Up', desc: 'Website, dashboard, integrations — ready in 5-7 days.' },
  { icon: '🚀', title: 'You Run Your Business', desc: 'Log in to your workspace. Everything works. We handle the rest.' },
];

const TESTIMONIALS = [
  { quote: 'Get4Domain replaced 5 different tools we were paying for. Now everything is in one place.', name: 'Jayachandran', biz: 'MR Travels, Chennai' },
  { quote: "Our leads increased 3x after switching to Get4Domain's campaign management.", name: 'Restaurant owner', biz: 'Coimbatore' },
  { quote: "The best part is the AI content — I don't need to hire a social media manager anymore.", name: 'Salon owner', biz: 'Bangalore' },
];

const FAQS = [
  { q: 'What is Get4Domain?', a: 'Get4Domain is a complete online identity platform for Indian SMBs. It combines your business website, operations (CRM, invoicing, HR), and marketing campaigns into one platform — so you can build, manage and grow your entire online presence from one place.' },
  { q: 'Do I need technical knowledge to use it?', a: 'No. We set up your website, dashboard and integrations for you within 5-7 days. You simply log in to a workspace tailored to your industry and start working — no coding or design skills needed.' },
  { q: 'How much does it cost?', a: 'One simple plan: DomainApp is ₹999/month and includes everything — your industry website, business workspace, CRM, campaigns and AI Studio with ₹499 of free AI credit. Top up your wallet (from ₹499) only when you need more AI content, campaigns or messaging.' },
];

export default function HomePage() {
  return (
    <>
      {/* SECTION 1 — HERO */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-5 lg:px-8">
          <div className="lg:col-span-3">
            <span className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white">
              🚀 India&apos;s #1 Online Identity Platform
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
              Build, Manage &amp; Grow<br />Your Online Identity
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              One platform for your business website, operations, CRM, marketing campaigns, and customer management. Built for Indian SMBs.
            </p>
            <p className="mt-5 text-sm font-medium text-slate-500">50+ Businesses · 20+ Industries · ₹999/month — Everything Included</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/book-demo" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#modules" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-50">
                Watch Demo
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-400">No credit card required · Setup in 24 hours · Cancel anytime</p>
          </div>

          {/* Dashboard preview mockup */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 shadow-xl">
              <div className="rounded-xl bg-white p-4">
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                    <span className="text-xs font-semibold text-slate-700">Today&apos;s Revenue</span>
                    <span className="text-sm font-bold text-emerald-600">₹42,500</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ k: 'Leads', v: 28 }, { k: 'Bookings', v: 16 }, { k: 'Invoices', v: 34 }].map((s) => (
                      <div key={s.k} className="rounded-lg bg-slate-50 px-2 py-2.5 text-center">
                        <div className="text-sm font-bold text-slate-900">{s.v}</div>
                        <div className="text-[10px] text-slate-500">{s.k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="h-20 rounded-lg bg-gradient-to-t from-blue-100 to-transparent" />
                  <div className="flex gap-2">
                    <div className="h-8 flex-1 rounded-lg bg-blue-600" />
                    <div className="h-8 flex-1 rounded-lg bg-slate-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — TRUST BAR */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-slate-500">Trusted by businesses across India</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
            {['50+ Businesses', '20+ Industries', '4.9★ Rating', '24h Support', 'GST Compliant'].map((s) => (
              <span key={s} className="text-base font-bold text-slate-800">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 — 10 MODULES */}
      <section id="modules" className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Everything Your Business Needs. One Platform.</h2>
            <p className="mt-3 text-slate-600">10 powerful modules that work together seamlessly.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {MODULES.map((m) => (
              <div key={m.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="text-2xl">{m.icon}</div>
                <h3 className="mt-3 text-base font-bold text-slate-900">{m.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — ONE PLAN */}
      <section className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">One Plan. Everything You Need.</h2>
          </div>
          <div className="mt-12 rounded-2xl border-2 border-blue-500 bg-white p-8 shadow-md">
            <div className="text-3xl">📋</div>
            <h3 className="mt-4 text-2xl font-bold text-slate-900">DomainApp — ₹999<span className="text-base font-normal text-slate-400">/month</span></h3>
            <p className="mt-1 font-medium text-blue-600">Industry website + Business workspace + Campaigns + AI Studio</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />{f}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-600">Plus wallet top-up for campaigns, AI content &amp; messaging.</p>
            <div className="mt-6">
              <Link href="/book-demo" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700">Get Started — ₹999/month <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <p className="mt-4 text-center text-sm text-slate-400">Just ₹999/month. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* SECTION 5 — INDUSTRIES */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Built for Every Industry</h2>
            <p className="mt-3 text-slate-600">20+ industry-specific configurations. Your workspace adapts to how YOUR business actually works.</p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {INDUSTRIES.map((ind) => (
              <Link key={ind.href} href={ind.href} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="text-3xl">{ind.icon}</span>
                <span className="text-sm font-semibold text-slate-800">{ind.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/industries" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700">View All 20+ Industries <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* SECTION 6 — HOW IT WORKS */}
      <section className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Go Live in 3 Simple Steps</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <span className="absolute right-6 top-6 text-sm font-bold text-slate-200">0{i + 1}</span>
                <div className="text-3xl">{s.icon}</div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7 — TESTIMONIALS */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Businesses Love Get4Domain</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-amber-400">★★★★★</div>
                <blockquote className="mt-3 text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-slate-900">{t.name}</span>
                  <span className="block text-slate-500">{t.biz}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <Faq items={FAQS} subtitle="Everything you need to know about the platform." />

      {/* SECTION 8 — CTA */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 md:py-24 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Ready to Build Your Online Identity?</h2>
          <p className="mt-3 text-slate-300">Join 50+ businesses already growing with Get4Domain</p>
          <div className="mt-8">
            <Link href="/book-demo" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-slate-900 transition hover:bg-slate-100">
              Book Your Free Demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-5 text-sm text-slate-400">No credit card · No commitment · Setup in 24 hours</p>
        </div>
      </section>
    </>
  );
}
