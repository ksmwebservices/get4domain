import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import Faq from '@/components/marketing/Faq';

export const metadata: Metadata = {
  title: 'Pricing — DomainApp ₹999/month, Everything Included',
  description: 'Simple pricing. One plan — DomainApp ₹999/month: industry website, business workspace, CRM, campaigns and AI Studio with ₹499 free credit. Top up only when you use more.',
  alternates: { canonical: 'https://get4domain.com/pricing' },
};

const INCLUDED = [
  {
    group: 'WEBSITE',
    items: ['Professional industry website', 'Free subdomain (vendorname.get4domain.com)', 'Free hosting + SSL', 'Mobile responsive, SEO optimized', 'Basic CMS for content updates'],
  },
  {
    group: 'BUSINESS WORKSPACE (Mini BOS)',
    items: ['Contacts management (industry-labeled)', 'Products/Services catalog', 'Bookings/Orders/Appointments', 'GST invoicing', 'Basic accounts (income/expense/P&L)'],
  },
  {
    group: 'CRM & CALLING',
    items: ['Lead pipeline (Kanban)', 'TeleCRM with call queue', 'Follow-up reminders'],
  },
  {
    group: 'CAMPAIGNS',
    items: ['1 campaign landing page (free)', 'Campaign management', 'Social media coordination'],
  },
  {
    group: 'AI STUDIO',
    items: ['₹499 free credit included', 'Text, images, posters, reels, documents'],
  },
  {
    group: 'TEAM & SUPPORT',
    items: ['Team access with roles', '24/7 AI support + human within 24hrs'],
  },
];

const TOPUPS = [
  { pay: '₹499', credits: '₹499 credits', bonus: 'Minimum top-up' },
  { pay: '₹999', credits: '₹1,100 credits', bonus: '10% bonus' },
  { pay: '₹2,499', credits: '₹3,000 credits', bonus: '20% bonus' },
  { pay: '₹4,999', credits: '₹6,500 credits', bonus: '30% bonus' },
];

const USAGE: [string, string][] = [
  ['Social media post (AI)', '₹5'], ['Festival poster (AI)', '₹8'], ['Blog article (AI)', '₹15'],
  ['Reel/Video script', '₹10'], ['Video generation', '₹50-100'], ['Document (ID/letterhead)', '₹10-20'],
  ['We post on your page', '₹10'], ['WhatsApp message', '₹1'], ['SMS', '₹0.50'],
  ['Email', '₹0.10'], ['Extra campaign page', '₹20'],
];

const FAQS = [
  { q: 'What happens after I pay ₹999?', a: 'We build your industry website in 5-7 days, set up your dashboard, and give you ₹499 AI Studio credit to start creating content immediately.' },
  { q: 'What is Mini BOS?', a: 'A lightweight business workspace tailored to your industry. Manage contacts, services, bookings/orders, and invoices — without the complexity of heavy ERP software.' },
  { q: 'How does the wallet work?', a: 'Your plan includes ₹499 free credit. Use it for AI content, campaigns, and messaging. When it runs low, top up from ₹499. Credits are valid for 90 days.' },
  { q: 'Can I use my own domain?', a: 'Yes. Buy a domain through our dashboard or connect your existing domain. Free subdomain included with every plan.' },
  { q: 'What industries do you support?', a: '20+ industries including Travel, Restaurant, Clinic, Salon, Hotel, Education, Retail, and more. Your workspace adapts to your industry.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Monthly subscription — cancel anytime. Your website stays live until the current month ends.' },
];

export default function PricingPage() {
  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-16 text-center sm:px-6 md:pt-24 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">Simple Pricing. No Surprises.</h1>
          <p className="mt-4 text-lg text-slate-600">One plan. Everything included. Pay more only when you use more.</p>
        </div>
      </section>

      {/* MAIN CARD */}
      <section className="pb-4">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border-2 border-blue-500 bg-white p-8 shadow-lg">
            <span className="inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">All-in-One</span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">DomainApp</h2>
            <p className="mt-2 text-4xl font-bold text-slate-900">₹999 <span className="text-lg font-normal text-slate-400">/month</span></p>
            <p className="text-sm text-slate-500">Everything included · Cancel anytime</p>

            <div className="mt-6 space-y-5">
              {INCLUDED.map((section) => (
                <div key={section.group}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{section.group}</p>
                  <ul className="mt-2 space-y-2">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3">
              <Link href="/book-demo" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">Get Started — ₹999/month <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/book-demo" className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">Book a Free Demo</Link>
            </div>
          </div>
        </div>
      </section>

      {/* WALLET */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-900">Pay As You Use</h3>
            <p className="mt-2 text-slate-600">Your plan includes ₹499 free AI Studio credit. Need more? Top up anytime.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {TOPUPS.map((t) => (
              <div key={t.pay} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <p className="text-xl font-bold text-slate-900">{t.pay}</p>
                <p className="mt-1 text-sm text-slate-600">→ {t.credits}</p>
                <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{t.bonus}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
            {USAGE.map(([label, rate], i) => (
              <div key={label} className={`flex items-center justify-between px-5 py-2.5 text-sm ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-900">{rate}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">Admin can adjust rates. Rates shown are starting prices.</p>
        </div>
      </section>

      {/* CUSTOM DOMAIN */}
      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-slate-900">Want Your Own Domain?</h3>
          <p className="mt-3 text-slate-600">Free subdomain included. Upgrade to a custom domain anytime.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">Search &amp; buy: from <span className="font-semibold">₹599/year</span> (.in) to <span className="font-semibold">₹999/year</span> (.com)</div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">Already own a domain? Map it for <span className="font-semibold">₹500 one-time</span> setup</div>
          </div>
          <Link href="/dashboard/domain-management" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-100">Search Domain Availability <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <Faq items={FAQS} subtitle="Everything about the DomainApp plan." />
    </>
  );
}
