import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import Faq from '@/components/marketing/Faq';

export const metadata: Metadata = {
  title: 'Pricing — DomainApp & DomainCampaign Plans',
  description: 'Simple, transparent pricing. DomainApp from ₹6,999/year. DomainCampaign is wallet-based from ₹999 — pay only for what you use. No hidden charges.',
  alternates: { canonical: 'https://get4domain.com/pricing' },
};

const STARTUP = [
  'Website + CMS', 'Lead forms', 'Gallery & Blog', 'WhatsApp chat',
  'Google Maps', 'Basic CRM', 'SSL & Hosting', '30-day support',
];
const ENTERPRISE = [
  'Everything in Startup, plus:', 'Advanced CRM + TeleCRM', 'GST Invoicing',
  'Payment Collection', 'Accounting (P&L, Cash Book)', 'HR & Payroll',
  'Attendance & Leave', 'Task Assignment', 'Inventory', 'Design Studio',
  'WhatsApp Bot', 'API & Webhook Access',
];
const TOPUPS = [
  { pay: '₹999', credits: '₹1,100 credits', bonus: '10% bonus' },
  { pay: '₹2,499', credits: '₹3,000 credits', bonus: '20% bonus' },
  { pay: '₹4,999', credits: '₹6,500 credits', bonus: '30% bonus' },
];
const FREE_INCLUDED = ['1 Campaign landing page', 'Lead CRM', 'TeleCRM', 'AI Studio access', 'Campaign analytics'];
const USAGE = [
  ['Social media post (AI)', '₹5'], ['Reel script', '₹10'], ['Blog post', '₹15'],
  ['Festival poster', '₹8'], ['We post on your page', '₹10'], ['WhatsApp message', '₹1'],
  ['SMS', '₹0.50'], ['Email', '₹0.10'],
];

const FAQS = [
  { q: "What's included in the setup fee?", a: 'The setup fee covers building your website, configuring your industry-specific workspace, connecting integrations (WhatsApp, payments, maps), and onboarding your data. Your platform is delivered ready-to-use in 5-7 days.' },
  { q: 'Can I switch plans later?', a: 'Yes. You can upgrade from DomainApp Startup to Enterprise at any time, and add DomainCampaign whenever you want. We prorate the difference — just ask your account manager.' },
  { q: 'How does the wallet work?', a: 'DomainCampaign runs on a prepaid wallet. You top up (minimum ₹999, valid 90 days) and pay per action — e.g. ₹5 for an AI social post, ₹1 per WhatsApp message. You only pay for what you use, with no monthly subscription.' },
  { q: 'Do you build my website?', a: 'Yes. Our team builds your website with your actual business name, services, photos and details — it is not a drag-and-drop template. You get a professional industry-specific site plus an easy CMS to edit content yourself.' },
  { q: 'What industries do you support?', a: 'We support 20+ industries including travel, restaurant, clinic, hotel, salon, gym, real estate, education, retail, construction and more. Each gets a workspace configured for how that business actually operates.' },
  { q: 'Is there a free trial?', a: 'We offer a free demo instead of a trial — a 30-minute walkthrough where we show your industry workspace live and answer every question, with no commitment. DomainCampaign also lets you start small with a ₹999 wallet top-up.' },
];

export default function PricingPage() {
  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-16 text-center sm:px-6 md:pt-24 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">Simple, Transparent Pricing</h1>
          <p className="mt-4 text-lg text-slate-600">Choose what you need. Pay only for what you use.</p>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          {/* CARD 1 — DomainApp */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-3xl">📋</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">DomainApp</h2>
            <p className="text-blue-600">Your Business Workspace</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <h3 className="text-lg font-bold text-slate-900">Startup</h3>
                <p className="mt-1 text-2xl font-bold text-slate-900">₹6,999<span className="text-sm font-normal text-slate-400">/year</span></p>
                <p className="text-xs text-slate-400">or ₹3,999 for 6 months</p>
                <p className="mt-2 text-xs text-slate-500">For businesses needing a professional website</p>
                <ul className="mt-4 space-y-2">
                  {STARTUP.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />{f}</li>
                  ))}
                </ul>
                <Link href="/book-demo?plan=startup" className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Book Demo for Startup</Link>
              </div>

              <div className="rounded-2xl border-2 border-blue-500 p-5 shadow-md">
                <span className="inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">Full Business OS</span>
                <h3 className="mt-2 text-lg font-bold text-slate-900">Enterprise</h3>
                <p className="mt-1 text-2xl font-bold text-slate-900">₹24,999<span className="text-sm font-normal text-slate-400">/year</span></p>
                <p className="text-xs text-slate-400">or ₹13,999 for 6 months</p>
                <p className="mt-2 text-xs text-slate-500">Full Business OS with all modules</p>
                <ul className="mt-4 space-y-2">
                  {ENTERPRISE.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />{f}</li>
                  ))}
                </ul>
                <Link href="/book-demo?plan=enterprise" className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Book Demo for Enterprise</Link>
              </div>
            </div>
          </div>

          {/* CARD 2 — DomainCampaign */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-3xl">📣</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">DomainCampaign</h2>
            <p className="text-indigo-600">Growth &amp; Marketing Engine</p>
            <p className="mt-4 text-sm text-slate-600">No subscription — wallet-based. Minimum top-up ₹999 (valid 90 days).</p>

            <div className="mt-5 space-y-2">
              {TOPUPS.map((t) => (
                <div key={t.pay} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                  <span className="text-sm font-semibold text-slate-900">{t.pay} → {t.credits}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{t.bonus}</span>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">What&apos;s included FREE:</p>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {FREE_INCLUDED.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />{f}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">Usage rates:</p>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                {USAGE.map(([label, rate], i) => (
                  <div key={label} className={`flex items-center justify-between px-4 py-2 text-sm ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold text-slate-900">{rate}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/book-demo?product=campaign" className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Start with ₹999</Link>
          </div>
        </div>
      </section>

      {/* COMBO */}
      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900">Need both? DomainApp + DomainCampaign</h2>
          <p className="mt-3 text-slate-600">Get DomainApp at 20% off when combined with DomainCampaign.</p>
          <Link href="/book-demo?product=combo" className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">Book Demo for Combo</Link>
        </div>
      </section>

      <Faq items={FAQS} subtitle="Pricing questions, answered." />
    </>
  );
}
