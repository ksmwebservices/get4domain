import type { Metadata } from 'next';
import { ArrowRight, Target, PenTool, BarChart3, Search, Users2, Share2, Check } from 'lucide-react';
import Faq from '@/components/marketing/Faq';
import DomainCampaignForm from '@/components/marketing/DomainCampaignForm';

export const metadata: Metadata = {
  title: 'DomainCampaign — Managed Paid Ads & Growth',
  description: 'We run your Meta & Google ads, content and organic growth. Management fee from ₹2,000/month, set by your monthly ad budget.',
  alternates: { canonical: 'https://get4domain.com/domain-campaign' },
};

const CAPABILITIES: { icon: typeof Target; name: string; blurb: string }[] = [
  { icon: Target, name: 'Managed Paid Ads', blurb: 'Meta (Facebook & Instagram) and Google Ads — set up, launched and optimized by our team every month.' },
  { icon: PenTool, name: 'Content Management', blurb: 'Posts, creative and campaign assets produced and scheduled for you.' },
  { icon: BarChart3, name: 'Analytics & Reporting', blurb: 'A monthly statement showing exactly what was spent and what you were billed — no black box.' },
  { icon: Search, name: 'SEO / GEO / AEO', blurb: 'Organic search, local/geo visibility and answer-engine optimization, worked on continuously.' },
  { icon: Users2, name: 'Group & Community Posting', blurb: 'Your offers shared into relevant local groups and communities.' },
  { icon: Share2, name: 'Link Sharing', blurb: 'Your site and campaign links placed and shared where your customers already are.' },
];

const BRACKET_EXAMPLES = [
  { range: 'Up to ₹20,000 ad budget', spend: '₹15,000', fee: '₹2,000' },
  { range: '₹20,001 – ₹1,00,000', spend: '₹50,000', fee: '₹5,000' },
  { range: 'Above ₹1,00,000', spend: '₹1,50,000', fee: '₹10,000' },
];

const FAQ = [
  { q: 'How is pricing calculated?', a: 'Our management fee is a flat monthly amount set by your monthly ad budget: up to ₹20,000 → ₹2,000/month; ₹20,001 to ₹1,00,000 → ₹5,000/month; above ₹1,00,000 → ₹10,000/month. Enterprise and multi-brand clients are quoted a custom fee. Plus 18% GST. Your ad spend itself is paid directly to Meta/Google and is separate from our fee.' },
  { q: 'How is my ad spend recorded?', a: 'Your account manager records your actual monthly spend directly from your Meta and Google ad accounts, and your monthly statement shows that figure alongside the fee calculation — so every number is checked against the source and fully transparent.' },
  { q: 'Is this the same as the campaign tools in my DomainApp plan?', a: 'No. DomainApp includes basic campaign tools (landing pages, AI content, messaging) as part of your subscription. DomainCampaign is a separate, managed service — our team actually plans, runs and optimizes paid ads and organic growth on your behalf, billed against your ad spend.' },
  { q: 'Do I need to already be a Get4Domain customer?', a: 'No — DomainCampaign is available whether or not you use DomainApp, though if you do, we can pre-fill your details from your dashboard.' },
  { q: 'Who actually spends the ad budget?', a: 'You fund and own your Meta/Google ad accounts directly — we plan, execute and optimize campaigns within the budget you set. Our fee is for that management work, calculated from what you actually spent.' },
];

export default function DomainCampaignPage() {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60rem]">
        <div className="absolute -left-20 -top-32 h-[36rem] w-[36rem] rounded-full bg-primary-600/15 blur-[130px]" />
        <div className="absolute right-0 top-16 h-[28rem] w-[28rem] rounded-full bg-warning-500/10 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      {/* HERO */}
      <section className="relative mx-auto max-w-3xl px-4 pb-6 pt-16 text-center sm:px-6 md:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
          DomainCampaign
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          We run your <span className="text-gradient-hero">paid ads &amp; growth.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          Managed Meta &amp; Google ads, content, analytics and organic SEO/GEO/AEO growth — set up, run and optimized by our team every month.
        </p>

        <div className="mx-auto mt-7 flex max-w-sm flex-col items-center gap-1 rounded-2xl border border-warning-400/30 bg-warning-400/10 px-6 py-4">
          <span className="text-3xl font-bold text-warning-200">From ₹2,000/month</span>
          <span className="text-sm text-slate-300">management fee, set by your ad budget · + 18% GST</span>
        </div>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#get-started" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
            Get Started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a href="#get-started" className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-800 sm:w-auto">
            Talk to us
          </a>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.name} className="flex flex-col rounded-2xl border border-white/5 bg-slate-800/60 p-6 backdrop-blur-xl transition-all hover:border-primary-400/20 hover:shadow-glow">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h2 className="mt-4 text-base font-bold text-white">{c.name}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{c.blurb}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PRICING EXPLAINER */}
      <section className="relative border-t border-white/5 bg-slate-900/60 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Pricing, worked out in the open.</h2>
          <p className="mt-3 text-slate-400">A flat monthly management fee, set by the size of your monthly ad budget. Your ad spend itself goes straight to Meta and Google — our fee is separate. No retainer, no surprise line items.</p>
          <div className="mx-auto mt-8 grid gap-4 sm:grid-cols-3">
            {BRACKET_EXAMPLES.map((b) => (
              <div key={b.range} className="rounded-2xl border border-white/5 bg-slate-800/60 p-6 text-left backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{b.range}</p>
                <p className="mt-2 text-sm text-slate-300">Spend <span className="font-semibold text-white">{b.spend}/month</span></p>
                <p className="mt-3 flex items-center gap-2 text-lg font-bold text-warning-300"><Check className="h-4 w-4" />Pay {b.fee}/month</p>
                <p className="mt-0.5 text-xs text-slate-500">management fee + GST</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-slate-400">Enterprise or multi-brand? We&apos;ll quote a custom fee — <a href="#get-started" className="font-semibold text-primary-300 hover:underline">talk to us</a>.</p>
        </div>
      </section>

      {/* FORM */}
      <section id="get-started" className="relative border-t border-white/5 py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Let&apos;s get your growth running.</h2>
            <p className="mt-3 text-slate-400">Tell us about your business — our team will follow up to get you set up.</p>
          </div>
          <DomainCampaignForm />
        </div>
      </section>

      <Faq items={FAQ} subtitle="DomainCampaign, explained." />
    </div>
  );
}
