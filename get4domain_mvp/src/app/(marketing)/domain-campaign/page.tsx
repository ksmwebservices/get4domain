import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Faq from '@/components/marketing/Faq';

export const metadata: Metadata = {
  title: 'DomainCampaign — AI Marketing & Lead Generation for Indian SMBs',
  description: 'DomainCampaign is your growth engine — we create content, manage your social media, run campaigns and generate leads. Wallet-based, from ₹999. No subscription.',
  alternates: { canonical: 'https://get4domain.com/domain-campaign' },
};

const STEPS = [
  { n: 1, title: 'You describe what to promote', desc: 'Tell us the offer, product or announcement.' },
  { n: 2, title: 'Our AI creates the content', desc: 'Posts, captions, posters and reels, on brand.' },
  { n: 3, title: 'You approve with one click', desc: 'Review and approve — nothing goes out without you.' },
  { n: 4, title: 'We post on your social pages', desc: 'Published directly to your Facebook & Instagram.' },
  { n: 5, title: 'Leads flow into your CRM', desc: 'Every enquiry lands in TeleCRM, ready to call.' },
];

const CHANNELS = ['📘 Facebook', '📸 Instagram', '▶️ YouTube', '🗺️ Google Business Profile', '💬 WhatsApp', '✉️ Email', '📱 SMS'];

const RATES = [
  ['Social media post (AI)', '₹5'], ['Reel script', '₹10'], ['Blog post', '₹15'],
  ['Festival poster', '₹8'], ['We post on your page', '₹10'], ['WhatsApp message', '₹1'],
  ['SMS', '₹0.50'], ['Email', '₹0.10'],
];

const FAQS = [
  { q: 'How does DomainCampaign work?', a: 'You tell us what to promote, our AI generates the content, you approve it with one click, and we publish it to your social pages. Any leads that come in flow straight into your TeleCRM so your team can follow up.' },
  { q: 'Do I need to manage social media accounts myself?', a: 'No. Get4Domain manages the channels for you. You connect your Facebook/Instagram page once, and we handle posting via the official APIs — your own page and brand shown to your customers.' },
  { q: 'How is it priced?', a: 'There is no monthly subscription. You top up a prepaid wallet (from ₹999, valid 90 days) and pay per action — e.g. ₹5 per AI social post, ₹10 to publish to your page, ₹1 per WhatsApp message. You only pay for what you use.' },
  { q: 'What do I get for free?', a: 'Every DomainCampaign account includes a campaign landing page, Lead CRM, TeleCRM, AI Studio access and campaign analytics at no usage cost — you only pay for content generation and messaging you actually send.' },
];

export default function DomainCampaignPage() {
  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-16 text-center sm:px-6 md:pt-24 lg:px-8">
          <div className="text-4xl">📣</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">DomainCampaign — Your Growth Engine</h1>
          <p className="mt-5 text-lg text-slate-600">We create content, manage your social media, run campaigns and generate leads. You focus on business.</p>
          <div className="mt-8">
            <Link href="/book-demo?product=campaign" className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700">Get Started with ₹999 <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">How it works</h2>
          <ol className="mt-12 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{s.n}</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-slate-600">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Channels */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900">Channels we manage</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {CHANNELS.map((c) => (
              <span key={c} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Wallet pricing */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Wallet-based pricing</h2>
            <p className="mt-3 text-slate-600">No monthly subscription. Top up from ₹999. Pay per action.</p>
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
            {RATES.map(([label, rate], i) => (
              <div key={label} className={`flex items-center justify-between px-5 py-3 text-sm ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-900">{rate}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/book-demo?product=campaign" className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700">Get Started with ₹999 <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <Faq items={FAQS} title="DomainCampaign — People Also Ask" />
    </>
  );
}
