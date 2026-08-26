import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import Faq from '@/components/marketing/Faq';
import HeroMockup from '@/components/marketing/HeroMockup';
import PlatformSection from '@/components/marketing/home/PlatformSection';
import FeatureGrid from '@/components/marketing/home/FeatureGrid';
import DashboardPreview from '@/components/marketing/home/DashboardPreview';
import CommunicationHub from '@/components/marketing/home/CommunicationHub';
import AIStudio from '@/components/marketing/home/AIStudio';
import HomePricing from '@/components/marketing/home/HomePricing';

export const metadata: Metadata = {
  title: 'Get4Domain — Your Online Identity Partner | ₹999/month',
  description:
    "Get4Domain is India's complete online identity platform. One plan — DomainApp ₹999/month: industry website, business workspace, CRM, campaigns and AI Studio, everything included.",
  alternates: { canonical: 'https://get4domain.com' },
};

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
  { icon: '⚙️', title: 'We Deploy & Customize', desc: 'Your site deploys instantly on a ready-made template — content & theme customized within 24 hours.' },
  { icon: '🚀', title: 'You Run Your Business', desc: 'Log in to your workspace. Everything works. We handle the rest.' },
];

const TESTIMONIALS = [
  { quote: 'Get4Domain replaced 5 different tools we were paying for. Now everything is in one place.', name: 'Jayachandran', biz: 'MR Travels, Chennai' },
  { quote: "Our leads increased 3x after switching to Get4Domain's campaign management.", name: 'Restaurant owner', biz: 'Coimbatore' },
  { quote: "The best part is the AI content — I don't need to hire a social media manager anymore.", name: 'Salon owner', biz: 'Bangalore' },
];

const FAQS = [
  { q: 'What is Get4Domain?', a: 'Get4Domain is a complete online identity platform for Indian SMBs. It combines your business website, operations (CRM, invoicing, HR), and marketing campaigns into one platform — so you can build, manage and grow your entire online presence from one place.' },
  { q: 'Do I need technical knowledge to use it?', a: 'No. Your site deploys instantly on a ready-made industry template, and we customize the content and theme within 24 hours. You simply log in to a Workplace tailored to your industry and start working — no coding or design skills needed.' },
  { q: 'How much does it cost?', a: 'One simple plan: DomainApp is ₹999/month and includes everything — your industry website, business workspace, CRM, campaigns and AI Studio with ₹499 of free AI credit. Top up your wallet (from ₹499) only when you need more AI content, campaigns or messaging.' },
  { q: 'I already have a website — is this still useful?', a: 'Yes. Use Get4Domain just for the workspace — CRM/TeleCRM, AI Studio, campaigns, WhatsApp/SMS/email, and accounts with expense tracking and GST-statement prep — without needing a new website.' },
];

export default function HomePage() {
  return (
    <>
      {/* SECTION 1 — HERO (direct port of the Bolt hero grid; renders its own dark section) */}
      <HeroMockup />

      {/* SECTIONS 2–7 — PRODUCT SHOWCASE (ported Bolt homepage sections; continuous dark region) */}
      <div className="relative overflow-hidden bg-slate-950 text-slate-100">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60rem]">
          <div className="absolute left-1/4 top-40 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary-600/10 blur-[130px]" />
          <div className="absolute right-0 top-[36rem] h-[26rem] w-[26rem] rounded-full bg-warning-500/8 blur-[120px]" />
        </div>
        <div className="relative">
          <PlatformSection />
          <FeatureGrid />
          <DashboardPreview />
          <CommunicationHub />
          <AIStudio />
          <HomePricing />
        </div>
      </div>

      {/* SECTION — INDUSTRIES */}
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
            <Link href="/industries" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700">View All 20+ Industries <ArrowRight className="h-4 w-4" /></Link>
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

      {/* SECTION 8 — BOTTOM CTA (direct port of CTAFooter.tsx CTASection; glass card + glow) */}
      <section className="relative overflow-hidden bg-slate-950 py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-800/60 p-8 text-center backdrop-blur-xl sm:p-12">
            {/* glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-500/15 blur-[80px]" />
              <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-warning-500/10 blur-[60px]" />
            </div>

            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-500/15 px-3.5 py-1.5 text-xs font-medium text-primary-300">
              <Sparkles className="h-3.5 w-3.5" /> Get started today
            </div>

            <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Your business deserves <span className="text-gradient-hero">better software</span>
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-slate-400">
              Join 50+ businesses running on Get4Domain. Instant deploy, live in 24 hours. No setup fees, no contracts, no per-feature pricing.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/book-demo" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
                Buy Now — ₹999/mo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/demo/clinic" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-800/60 px-6 py-3 font-medium text-slate-100 backdrop-blur-xl transition-all hover:bg-slate-800/80 sm:w-auto">
                <Play className="h-4 w-4 text-primary-300" /> Visit Demo
              </Link>
            </div>

            <div className="mt-6 text-xs text-slate-400">
              14-day money-back guarantee · Cancel anytime · GST compliant
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
