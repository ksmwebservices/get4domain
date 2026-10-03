import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight, Megaphone, Code2 } from 'lucide-react';
import Faq from '@/components/marketing/Faq';
import HomePricing from '@/components/marketing/home/HomePricing';
import { fetchLivePricing } from '@/lib/pricing';
import { WORKSPACE_INCLUDED, BOS_EXTRA, CAMPAIGN_BRACKETS, CAMPAIGN_INCLUDES, MANAGED_INCLUDES, isComingSoon } from '@/lib/plan-features';

// Revalidate every 5 min so admin Pricing Manager edits reflect without a redeploy.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Pricing — DomainApp Workspace ₹999/mo or BOS ₹1,999/mo, billed annually',
  description: 'Simple annual pricing. Workspace ₹11,988/year + GST or BOS ₹23,988/year + GST: industry website, CRM, accounting, campaigns and AI Studio with a one-time AI Studio credit. Pay-per-use from your wallet only when you use more.',
  alternates: { canonical: 'https://get4domain.com/pricing' },
};

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
  { q: 'Do you also run ads or build custom software?', a: 'Yes, as separate optional services. DomainCampaign is managed Meta & Google ads and growth from ₹2,000/month (by ad budget). Managed Services covers custom web/mobile apps, bespoke CRM/ERP and managed marketing, quoted per project. See the "Want us to do it for you?" section above.' },
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
                const comingSoon = isComingSoon(item);
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

      {/* MORE WAYS TO GROW — DomainCampaign + Managed Services summaries (light) */}
      <section id="more-services" className="border-t border-slate-200 bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Want us to do it for you?</h2>
            <p className="mt-3 text-slate-600">Beyond the DomainApp subscription, our team can run your growth or build custom software — separate, optional services.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div id="domain-campaign" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50"><Megaphone className="h-5 w-5 text-primary-600" /></span>
                <p className="text-xs font-bold uppercase tracking-wider text-primary-600">DomainCampaign</p>
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">Managed paid ads &amp; growth</h3>
              <p className="mt-2 text-sm text-slate-600">We plan, run and optimize your Meta &amp; Google ads and organic growth every month. A flat management fee set by your monthly ad budget — your ad spend goes straight to the platforms.</p>
              <ul className="mt-4 space-y-2">
                {CAMPAIGN_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{item}</li>
                ))}
              </ul>
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                {CAMPAIGN_BRACKETS.map((b, i) => (
                  <div key={b.range} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                    <span className="text-slate-600">{b.range}</span>
                    <span className="font-semibold text-slate-900">{b.fee}/month</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">Management fee + 18% GST. Enterprise or multi-brand: custom quote.</p>
              <div className="mt-auto pt-6"><Link href="/domain-campaign" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-100">Learn more <ArrowRight className="h-4 w-4" /></Link></div>
            </div>

            <div id="managed-services" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50"><Code2 className="h-5 w-5 text-primary-600" /></span>
                <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Managed Services</p>
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">Custom software &amp; marketing, built for you</h3>
              <p className="mt-2 text-sm text-slate-600">For work beyond any subscription tier: bespoke applications and ongoing managed marketing, delivered end to end by our team and scoped to your project.</p>
              <ul className="mt-4 space-y-2">
                {MANAGED_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{item}</li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <span className="font-semibold">Custom-quoted per project</span> — no fixed price list, because the work itself isn&apos;t fixed.
              </div>
              <div className="mt-auto pt-6"><Link href="/managed-services#quote" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-100">Get a custom quote <ArrowRight className="h-4 w-4" /></Link></div>
            </div>
          </div>
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
