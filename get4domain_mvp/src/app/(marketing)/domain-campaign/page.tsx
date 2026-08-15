import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Campaign Features | DomainApp',
  description: 'Campaigns are included in your DomainApp plan (₹999/month) — landing pages, social media, WhatsApp/SMS/email messaging and AI content. No separate subscription.',
  alternates: { canonical: 'https://get4domain.com/domain-campaign' },
};

const STEPS = [
  { n: 1, title: 'You describe what to promote', desc: 'Tell us the offer, product or announcement.' },
  { n: 2, title: 'Our AI creates the content', desc: 'Posts, captions, posters and reels, on brand.' },
  { n: 3, title: 'You approve with one click', desc: 'Nothing goes out without your approval.' },
  { n: 4, title: 'We post on your social pages', desc: 'Published directly to your Facebook & Instagram.' },
  { n: 5, title: 'Leads flow into your CRM', desc: 'Every enquiry lands in TeleCRM, ready to call.' },
];

const CAPABILITIES = [
  'Campaign landing pages with lead capture',
  'Social media posting (we post on your page)',
  'WhatsApp, SMS & email campaigns',
  'AI content — posts, posters, reels',
  'Lead pipeline + TeleCRM follow-up',
  'Campaign analytics (reach, clicks, leads)',
];

const RATES: [string, string][] = [
  ['Social media post (AI)', '₹5'], ['We post on your page', '₹10'], ['Extra campaign page', '₹20'],
  ['WhatsApp message', '₹1'], ['SMS', '₹0.50'], ['Email', '₹0.10'],
];

export default function CampaignFeaturesPage() {
  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-16 text-center sm:px-6 md:pt-24 lg:px-8">
          <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-sm font-medium text-white">📣 Included in DomainApp</span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">Campaigns, Built In</h1>
          <p className="mt-5 text-lg text-slate-600">
            Campaigns aren&apos;t a separate product — they&apos;re part of your DomainApp plan. Create landing pages, post to social, message customers and generate leads, all from one dashboard.
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-900">Included in your DomainApp plan — no extra subscription.</p>
          <div className="mt-8">
            <Link href="/book-demo" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">Get Started with DomainApp — ₹999/month <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">How campaigns work</h2>
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

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900">What&apos;s included</h2>
          <ul className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <li key={c} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />{c}</li>
            ))}
          </ul>
          <p className="mt-8 text-center text-sm text-slate-600">Campaign &amp; messaging usage is billed from your wallet (₹499 free credit included):</p>
          <div className="mx-auto mt-4 max-w-md overflow-hidden rounded-2xl border border-slate-200">
            {RATES.map(([label, rate], i) => (
              <div key={label} className={`flex items-center justify-between px-5 py-2.5 text-sm ${i % 2 ? 'bg-white' : 'bg-slate-50'}`}>
                <span className="text-slate-600">{label}</span><span className="font-semibold text-slate-900">{rate}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white md:text-3xl">One plan. Website, workspace, campaigns &amp; AI.</h2>
          <p className="mt-3 text-slate-300">Everything included at ₹999/month.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/domain-app" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-slate-900 hover:bg-slate-100">Explore DomainApp <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/book-demo" className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-800">Book a Free Demo</Link>
          </div>
        </div>
      </section>
    </>
  );
}
