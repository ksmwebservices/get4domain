import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import Faq from '@/components/marketing/Faq';
import HomePricing from '@/components/marketing/home/HomePricing';
import { fetchLivePricing } from '@/lib/pricing';

// Revalidate every 5 min so admin Pricing Manager edits reflect without a redeploy.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Pricing — DomainApp Workspace ₹999/mo or BOS ₹1,999/mo, billed annually',
  description: 'Simple annual pricing. Workspace ₹11,988/year + GST or BOS ₹23,988/year + GST: industry website, CRM, accounting, campaigns and AI Studio with a one-time AI Studio credit. Pay-per-use from your wallet only when you use more.',
  alternates: { canonical: 'https://get4domain.com/pricing' },
};

// What each annual plan includes. BOS = Workspace + the items below; HRM and
// Office management are flagged "coming soon" — they are not built yet
// (confirmed by the 01-Oct-2026 engineering audit), so BOS never claims them
// as live.
const WORKSPACE_INCLUDED = [
  { group: 'WEBSITE', items: ['Professional industry website', 'Free subdomain (vendorname.get4domain.com)', 'Free hosting + SSL', 'Mobile responsive, SEO optimized', 'Basic CMS for content updates'] },
  { group: 'WORKPLACE', items: ['Contacts management (industry-labeled)', 'Products/Services catalog', 'Bookings/Orders/Appointments', 'GST invoicing', 'Basic expense management', 'Staff dashboard management'] },
  { group: 'CRM & TELECRM', items: ['Lead pipeline (Kanban)', 'TeleCRM with call queue', 'Follow-up reminders', 'Website auto-bot reply'] },
  { group: 'GROWTH HUB', items: ['3 free SEO keywords', 'SEO/GEO/AEO + blog + social + GMB + directory + 20 backlinks bundle', '2 theme changes/year'] },
  { group: 'AI STUDIO', items: ['₹499 one-time credit included', 'Text, images, posters, reels, documents'] },
  { group: 'TEAM & SUPPORT', items: ['Team access with roles', 'Instant AI support assistant (human callback if needed)'] },
];
const BOS_EXTRA = [
  'Everything in Workspace',
  'WhatsApp bot reply too',
  'Task management & assigning',
  'Full GST + P&L accounting',
  'HRM — coming soon',
  'Office management — coming soon',
  '₹1,299 one-time AI Studio credit',
  '6 free SEO keywords',
  '4 theme changes/year',
];

// Wallet pay-per-use — real starting rates (admin-adjustable).
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
  { q: 'What happens after I pay?', a: 'Your site deploys instantly on a ready-made industry template and we complete content & theme customization within 24 hours. We set up your Workplace dashboard and give you a one-time AI Studio credit (₹499 Workspace, ₹1,299 BOS) to start creating content immediately.' },
  { q: 'What is the Workplace?', a: 'The Workplace is your central business workspace — contacts, catalog, bookings/orders, invoicing, CRM, campaigns, AI tools and analytics, tailored to your industry, without the complexity of heavy ERP software.' },
  { q: 'How does the wallet work?', a: 'Your plan includes a one-time AI Studio credit. Use it for AI content, campaigns and messaging. When it runs low, top up from ₹499. Credits are valid for 90 days.' },
  { q: 'Can I use my own domain?', a: 'Yes. A free subdomain is included with every plan. You can also buy a domain through our dashboard or connect an existing one — custom domain is a separate service.' },
  { q: 'What industries do you support?', a: '20+ industries including Travel, Restaurant, Clinic, Salon, Hotel, Education, Retail, and more. Your Workplace adapts to your industry.' },
  { q: 'How am I billed?', a: 'Both plans are billed annually, upfront: Workspace ₹11,988 + 18% GST once a year (₹999/month equivalent), BOS ₹23,988 + 18% GST once a year (₹1,999/month equivalent). There is no quarterly or monthly billing option.' },
  { q: 'Is HRM / Office management included in BOS?', a: 'They are on the BOS roadmap and shown as "coming soon" — not yet available. Everything else listed under BOS is live today.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel anytime — your website stays live until the end of the year you have already paid for.' },
];

export default async function PricingPage() {
  // Live pricing (admin source of truth) with the constants above as fallback.
  const live = await fetchLivePricing();
  const u = live?.usage ?? {};
  const rupee = (n?: number): string => (n == null ? '' : `₹${n % 1 === 0 ? n : n.toFixed(2)}`);
  const pct = (credits: number, pay: number): string => `${Math.max(0, Math.round((credits / pay - 1) * 100))}% bonus`;
  const usageRows: [string, string][] = live
    ? [
        ['Social media post (AI)', rupee(u.social_post)], ['Festival poster (AI)', rupee(u.festival_poster)],
        ['Blog article (AI)', rupee(u.blog_article)], ['Reel/Video script', rupee(u.reel_script)],
        ['Video generation', rupee(u.video_generation)], ['Document (ID/letterhead)', rupee(u.document)],
        ['We post on your page', rupee(u.social_post_publish)], ['WhatsApp message', rupee(u.whatsapp_message)],
        ['SMS', rupee(u.sms_message)], ['Email', rupee(u.email_message)], ['Extra campaign page', rupee(u.extra_campaign_page)],
      ]
    : USAGE;
  const topupRows = live
    ? [
        { pay: '₹499', credits: '₹499 credits', bonus: 'Minimum top-up' },
        { pay: '₹999', credits: `₹${live.topups['999'].toLocaleString('en-IN')} credits`, bonus: pct(live.topups['999'], 999) },
        { pay: '₹2,499', credits: `₹${live.topups['2499'].toLocaleString('en-IN')} credits`, bonus: pct(live.topups['2499'], 2499) },
        { pay: '₹4,999', credits: `₹${live.topups['4999'].toLocaleString('en-IN')} credits`, bonus: pct(live.topups['4999'], 4999) },
      ]
    : TOPUPS;
  return (
    <>
      {/* HERO + PRICING BLOCK — dark, homepage visual family */}
      <div className="relative overflow-hidden bg-slate-950 text-slate-100">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary-600/15 blur-[120px]" />
          <div className="absolute right-0 top-10 h-[26rem] w-[26rem] rounded-full bg-warning-500/10 blur-[110px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 pb-2 pt-16 text-center sm:px-6 md:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            Simple pricing
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Two plans. <span className="text-gradient-hero">No surprises.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Workspace or BOS, billed annually. Pay more only when you actually use variable services — from your wallet.
          </p>
        </div>
        {/* Reuses the homepage pricing block: Workspace/BOS toggle, plan card, comparison table, Buy Now CTA. */}
        <div className="relative">
          <HomePricing />
        </div>
      </div>

      {/* EVERYTHING INCLUDED — light detail */}
      <section className="border-t border-slate-200 bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Everything in Workspace</h2>
            <p className="mt-3 text-slate-600">Every Workspace subscription unlocks the whole platform — website, Workplace, CRM, campaigns and AI Studio.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WORKSPACE_INCLUDED.map((section) => (
              <div key={section.group} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-primary-600">{section.group}</p>
                <ul className="mt-3 space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-16 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">BOS adds the full back office</h2>
            <p className="mt-3 text-slate-600">BOS includes everything in Workspace, plus:</p>
          </div>
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {BOS_EXTRA.map((item) => {
                const comingSoon = item.includes('coming soon');
                return (
                  <li key={item} className={`flex items-start gap-2.5 text-sm ${comingSoon ? 'text-slate-400' : 'text-slate-700'}`}>
                    <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${comingSoon ? 'text-slate-300' : 'text-success-500'}`} />{item}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* PAY AS YOU USE — light */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Pay only for what you use</h2>
            <p className="mt-3 text-slate-600">Your plan includes a one-time AI Studio credit (₹499 Workspace, ₹1,299 BOS). Variable usage (AI, WhatsApp, SMS, email) is billed per use from your wallet.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topupRows.map((t) => (
              <div key={t.pay} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <p className="text-xl font-bold text-slate-900">{t.pay}</p>
                <p className="mt-1 text-sm text-slate-600">→ {t.credits}</p>
                <span className="mt-2 inline-block rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-700">{t.bonus}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
            {usageRows.map(([label, rate], i) => (
              <div key={label} className={`flex items-center justify-between px-5 py-2.5 text-sm ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-900">{rate}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">Starting rates, admin-adjustable. You always see what consumed your wallet.</p>
        </div>
      </section>

      {/* CUSTOM DOMAIN — light */}
      <section className="border-t border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900">Want your own domain?</h2>
          <p className="mt-3 text-slate-600">A free subdomain is included. A custom domain is a separate, optional service.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">Search &amp; buy: from <span className="font-semibold">₹599/year</span> (.in) to <span className="font-semibold">₹999/year</span> (.com)</div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">Already own a domain? Map it for <span className="font-semibold">₹500 one-time</span> setup</div>
          </div>
          <Link href="/dashboard/domain-management" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-100">Search domain availability <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <Faq items={FAQS} subtitle="Everything about the DomainApp plan." />
    </>
  );
}
