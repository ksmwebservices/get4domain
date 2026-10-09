import type { Metadata } from 'next';
import { ArrowRight, Target, PenTool, BarChart3, Search, Users2, Share2, Check } from 'lucide-react';
import Faq from '@/components/marketing/Faq';
import DomainCampaignForm from '@/components/marketing/DomainCampaignForm';

export const metadata: Metadata = {
  title: 'LeadSpace: a free page, and you pay only for customers who verify',
  description: 'A free landing page for your business, customers verified on WhatsApp, a prepaid wallet you control, and promotion on our own pages for your city and trade. Managed paid ads are available too.',
  alternates: { canonical: 'https://get4domain.com/leadspace' },
};

const HOW: { title: string; blurb: string }[] = [
  { title: 'Tell us your trade and city', blurb: 'We write the page for you from your details and your catalogue: offer, services with prices, trust points, map and answers to common questions. Or add just a button and a form to the website you already have.' },
  { title: 'Customers verify on WhatsApp', blurb: 'A visitor fills in the request, gets a code on WhatsApp and confirms. You only receive real people who agreed to be contacted.' },
  { title: 'You pay per verified customer', blurb: 'Top up a prepaid wallet. Each verified customer is charged once at a price you can see. If your wallet is empty your page keeps working and customers are held for you.' },
];

const INCLUDED: { title: string; blurb: string }[] = [
  { title: 'Alerts the moment someone asks', blurb: 'On WhatsApp, by e-mail and as a notification on your phone, with one tap to call or chat.' },
  { title: 'Promotion on our own pages', blurb: 'We post about you on our themed pages for your city and trade, and send the people who respond to your page.' },
  { title: 'Bookings, appointments, site visits and orders', blurb: 'Pick one goal for your page. Orders are requests you confirm; no payment is taken on the page.' },
  { title: 'GST tax invoice for every refill', blurb: 'E-mailed and listed in your wallet. Unused balance can be refunded on request.' },
];

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
  { q: 'Is LeadSpace really free?', a: 'The page is free and there is no monthly fee. You pay only when a customer verifies their number on WhatsApp, from a wallet you top up yourself.' },
  { q: 'What if my wallet runs out?', a: 'Your page keeps working. New customers are held for you and shown with a hidden number; when you refill, they are released oldest first. You can choose instead to show customers a polite message.' },
  { q: 'Can I use it with the website I already have?', a: 'Yes. Choose the option that adds only a button and a request form to your existing website. Nothing on your website is changed.' },
  { q: 'Which businesses can use it?', a: 'Home services, builders and interiors, real estate, freelancers, start-ups, photographers and event planners, tutors, salons, shops, food and catering, advocates and clinics. Advocates and clinics get information-only pages and are not promoted unless our team allows it; real estate needs a RERA number to be promoted.' },
  { q: 'How is pricing calculated?', a: 'Our management fee is a flat monthly amount set by your monthly ad budget: up to ₹20,000 → ₹2,000/month; ₹20,001 to ₹1,00,000 → ₹5,000/month; above ₹1,00,000 → ₹10,000/month. Enterprise and multi-brand clients are quoted a custom fee. Plus 18% GST. Your ad spend itself is paid directly to Meta/Google and is separate from our fee.' },
  { q: 'How is my ad spend recorded?', a: 'Your account manager records your actual monthly spend directly from your Meta and Google ad accounts, and your monthly statement shows that figure alongside the fee calculation — so every number is checked against the source and fully transparent.' },
  { q: 'Is this the same as the campaign tools in my DomainApp plan?', a: 'No. DomainApp includes basic campaign tools (landing pages, AI content, messaging) as part of your subscription. LeadSpace Managed Ads is a separate, managed service — our team actually plans, runs and optimizes paid ads and organic growth on your behalf, billed against your ad spend.' },
  { q: 'Do I need to already be a Get4Domain customer?', a: 'No — LeadSpace Managed Ads is available whether or not you use DomainApp, though if you do, we can pre-fill your details from your dashboard.' },
  { q: 'Who actually spends the ad budget?', a: 'You fund and own your Meta/Google ad accounts directly — we plan, execute and optimize campaigns within the budget you set. Our fee is for that management work, calculated from what you actually spent.' },
];

export default function LeadSpacePage() {
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
          LeadSpace
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          A free page for your business. <span className="text-gradient-hero">Pay only for customers who verify.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          Get a landing page in minutes, built from your details. Every enquiry, booking, appointment, site visit and order is checked on WhatsApp before it reaches you. No monthly fee, no contract.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="/register?product=leadspace" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-400 px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-warning-300 hover:shadow-glow-amber sm:w-auto">
            Start free <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a href="#how" className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-800 sm:w-auto">
            How it works
          </a>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {HOW.map((h, i) => (
            <div key={h.title} className="rounded-2xl border border-white/5 bg-slate-800/60 p-6 backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500/20 text-sm font-bold text-primary-300">{i + 1}</div>
              <h2 className="mt-4 text-base font-bold text-white">{h.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{h.blurb}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {INCLUDED.map((x) => (
            <div key={x.title} className="flex gap-3 rounded-2xl border border-white/5 bg-slate-800/40 p-5">
              <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-300" aria-hidden />
              <div><p className="text-sm font-semibold text-white">{x.title}</p><p className="mt-0.5 text-sm text-slate-400">{x.blurb}</p></div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-slate-400">The price of a verified customer is set per trade and city and shown to you before you add a rupee. A customer who is not real can be reported and the amount comes back to your wallet.</p>
      </section>

      {/* MANAGED ADS */}
      <section id="managed-ads" className="relative border-t border-white/5 bg-slate-900/40 pt-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300">LeadSpace Managed Ads</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">Want us to run your <span className="text-gradient-hero">paid ads too?</span></h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Managed Meta &amp; Google ads, content, analytics and organic SEO/GEO/AEO growth, set up, run and optimized by our team every month. It sits alongside LeadSpace: the customers it brings are verified the same way.</p>
          <div className="mx-auto mt-7 flex max-w-sm flex-col items-center gap-1 rounded-2xl border border-warning-400/30 bg-warning-400/10 px-6 py-4">
            <span className="text-3xl font-bold text-warning-200">From ₹2,000/month</span>
            <span className="text-sm text-slate-300">management fee, set by your ad budget · + 18% GST</span>
          </div>
          <div className="mt-7">
            <a href="#get-started" className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-800">Talk to us <ArrowRight className="h-4 w-4" /></a>
          </div>
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

      <Faq items={FAQ} subtitle="LeadSpace and LeadSpace Managed Ads, explained." />
    </div>
  );
}
