import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Layers, Megaphone, Code2 } from 'lucide-react';
import Faq from '@/components/marketing/Faq';
import PlanComparison from '@/components/marketing/pricing/PlanComparison';
import ProductComparison from '@/components/marketing/pricing/ProductComparison';
import WhyGet4Domain from '@/components/marketing/WhyGet4Domain';
import CampaignPricing from '@/components/marketing/pricing/CampaignPricing';
import ManagedServicesSection from '@/components/marketing/pricing/ManagedServicesSection';
import { fetchLivePricing, applyLivePricing } from '@/lib/pricing';

// Revalidate every 5 min so admin Pricing Manager edits reflect without a redeploy.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Pricing — DomainApp, DomainCampaign & Managed Services',
  description: 'All Get4Domain pricing in one place: DomainApp Workspace ₹11,988/yr or BOS ₹23,988/yr (+ GST), DomainCampaign managed ads from ₹2,000/month by ad budget, and custom-quoted Managed Services for bespoke software and marketing.',
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
  ['Reel script', '₹10'], ['Document (ID/letterhead)', '₹10-20'],
  ['We post on your page', '₹10'], ['WhatsApp message', '₹1'], ['SMS', '₹0.50'],
  ['Email', '₹0.10'], ['Extra campaign page', '₹20'],
];

const FAQS = [
  { q: 'What happens after I pay?', a: 'Your site deploys instantly on a ready-made industry template and we complete content & theme customization within 24 hours. We set up your Workplace dashboard and give you a one-time AI Studio credit (₹499 Workspace, ₹1,299 BOS) to start creating content immediately.' },
  { q: 'What is the Workplace?', a: 'The Workplace is your central business workspace — contacts, catalog, bookings/orders, invoicing, CRM, campaigns, AI tools and analytics, tailored to your industry, without the complexity of heavy ERP software.' },
  { q: 'How does the wallet work?', a: 'Your plan includes a one-time AI Studio credit. Use it for AI content, campaigns and messaging. When it runs low, top up from ₹499. Credits are valid for 90 days.' },
  { q: 'Can I use my own domain?', a: 'Yes. A free subdomain is included with every plan. You can also buy a domain through our dashboard or connect an existing one — custom domain is a separate service.' },
  { q: 'What industries do you support?', a: '20+ industries including Travel, Restaurant, Clinic, Salon, Hotel, Education, Retail, and more. Your Workplace adapts to your industry.' },
  { q: 'How am I billed?', a: 'Both DomainApp plans are billed annually, upfront: Workspace ₹11,988 + 18% GST once a year (₹999/month equivalent), BOS ₹23,988 + 18% GST once a year (₹1,999/month equivalent). There is no quarterly or monthly billing option. DomainCampaign is billed monthly; Managed Services are billed per the proposal you approve.' },
  { q: 'What does BOS add over Workspace?', a: 'BOS includes everything in Workspace plus WhatsApp bot reply, full accounting with P&L and GSTR filing, HRM (staff, attendance and payroll), inventory management, task management and assigning, 6 SEO keywords, 4 theme customizations a year and a ₹1,299 one-time AI Studio credit.' },
  { q: 'What is the difference between DomainApp, DomainCampaign and Managed Services?', a: 'DomainApp is the subscription: your industry website plus the software to run your business. DomainCampaign is a managed service where our team runs your Meta & Google ads and organic growth for a flat monthly fee set by your ad budget. Managed Services is custom work — bespoke web/mobile apps, CRM/ERP, and managed marketing or production — scoped and quoted per project. You can use any of them on their own or together.' },
  { q: 'How much does DomainCampaign cost?', a: 'A flat management fee set by your monthly ad budget: up to ₹20,000 → ₹2,000/month; ₹20,001 to ₹1,00,000 → ₹5,000/month; above ₹1,00,000 → ₹10,000/month, plus 18% GST. Enterprise and multi-brand clients get a custom quote. Your ad spend is paid directly to Meta/Google and is separate.' },
  { q: 'How do I get a Managed Services quote?', a: 'Use "Get a Custom Quote" on this page. Tell us what you need, our team follows up to scope it, and you receive an itemized proposal. There is no fixed price list because every engagement is different.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel anytime — your website stays live until the end of the year you have already paid for.' },
];

export default async function PricingPage() {
  // Live pricing (admin source of truth) with the constants in lib/pricing as fallback.
  const live = await fetchLivePricing();
  const terms = applyLivePricing(live);
  const u = live?.usage ?? {};
  const rupee = (n?: number): string => (n == null ? '' : `₹${n % 1 === 0 ? n : n.toFixed(2)}`);
  const pct = (credits: number, pay: number): string => `${Math.max(0, Math.round((credits / pay - 1) * 100))}% bonus`;
  const usageRows: [string, string][] = live
    ? [
        ['Social media post (AI)', rupee(u.social_post)], ['Festival poster (AI)', rupee(u.festival_poster)],
        ['Blog article (AI)', rupee(u.blog_article)], ['Reel script', rupee(u.reel_script)],
        ['Document (ID/letterhead)', rupee(u.document)],
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

  // The three products, as jump tiles in the hero so none of them is below the fold.
  const tiles = [
    { href: '#compare', icon: Layers, name: 'DomainApp', price: `${terms.workspace.headline} – ${terms.bos.headline}`, unit: '/month, billed annually', blurb: 'Industry website + the software to run your business. Workspace or BOS.', cta: 'Compare plans', accent: false },
    { href: '#domain-campaign', icon: Megaphone, name: 'DomainCampaign', price: 'From ₹2,000', unit: '/month, by ad budget', blurb: 'Our team runs your Meta & Google ads and organic growth.', cta: 'See fees & scope', accent: false },
    { href: '#managed-services', icon: Code2, name: 'Managed Services', price: 'Custom quote', unit: 'scoped per project', blurb: 'Bespoke web/mobile apps, CRM/ERP and managed marketing, built for you.', cta: 'Get a custom quote', accent: true },
  ];

  return (
    <>
      {/* HERO — all three products visible above the fold */}
      <div className="relative overflow-hidden bg-slate-950 text-slate-100">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary-600/15 blur-[120px]" />
          <div className="absolute right-0 top-10 h-[26rem] w-[26rem] rounded-full bg-warning-500/10 blur-[110px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-10 text-center sm:px-6 md:pb-16 md:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-primary-300 backdrop-blur-xl">
            Simple pricing
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl md:mt-4 md:text-5xl">
            Three ways to work with us. <span className="text-gradient-hero">One price page.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-400 md:mt-4 md:text-lg">
            A subscription to run your business, a team to run your ads, or a custom build — compare all three below.
          </p>

          <div className="mt-6 grid gap-3 text-left md:mt-10 md:grid-cols-3 md:gap-4">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <a
                  key={t.name}
                  href={t.href}
                  className={`group flex flex-col rounded-2xl border p-4 backdrop-blur-xl md:p-6 transition-all hover:-translate-y-0.5 ${t.accent ? 'border-warning-400/50 bg-warning-400/10 shadow-glow-amber' : 'border-white/10 bg-slate-800/60 hover:border-primary-400/30'}`}
                >
                  <span className={`hidden h-10 w-10 items-center justify-center rounded-xl md:flex ${t.accent ? 'bg-warning-400 text-slate-900' : 'bg-gradient-to-br from-primary-400 to-primary-600 text-white'}`}><Icon className="h-5 w-5" /></span>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300 md:mt-4 md:text-sm">{t.name}</p>
                  <p className="mt-0.5 text-xl font-bold text-white md:mt-1 md:text-3xl">{t.price}</p>
                  <p className="text-xs text-slate-400">{t.unit}</p>
                  <p className="mt-3 hidden text-sm text-slate-400 md:block">{t.blurb}</p>
                  <span className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold md:mt-4 ${t.accent ? 'text-warning-300' : 'text-primary-300'}`}>
                    {t.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </a>
              );
            })}
          </div>
          <p className="mt-5 text-xs text-slate-500">DomainApp and DomainCampaign prices exclude 18% GST. Managed Services are quoted per project.</p>
        </div>
      </div>

      {/* COMPARE — one table: Workspace | BOS | DomainCampaign | Managed Services */}
      <ProductComparison workspace={terms.workspace} bos={terms.bos} />

      {/* 1 · DOMAINAPP — plan cards */}
      <PlanComparison workspace={terms.workspace} bos={terms.bos} />

      {/* 2 · DOMAINCAMPAIGN — fee table + scope */}
      <CampaignPricing />

      {/* 3 · MANAGED SERVICES — custom-quoted, loudest block on the page */}
      <ManagedServicesSection />

      {/* WHY GET4DOMAIN — differentiation + cost comparison */}
      <WhyGet4Domain tone="light" />

      {/* PAY AS YOU USE — wallet (applies to DomainApp) */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">DomainApp wallet: pay only for what you use</h2>
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

      <Faq items={FAQS} subtitle="Everything about DomainApp, DomainCampaign and Managed Services." />
    </>
  );
}
