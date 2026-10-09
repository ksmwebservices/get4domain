import Link from 'next/link';
import { CAMPAIGN_BRACKETS as BRACKETS } from '@/data/platform-features';
import { ArrowRight, Check, Target, PenTool, BarChart3, Search, Users2, Share2, type LucideIcon } from 'lucide-react';

/**
 * LeadSpace Managed Ads on /pricing: the full spend-bracket fee table (PRD §88) and the complete
 * service scope. Brackets mirror backend/domain-campaign-fee.ts and the /leadspace page.
 */

const SCOPE: { icon: LucideIcon; name: string; points: string[] }[] = [
  {
    icon: Target, name: 'Ads management',
    points: ['Meta (Facebook & Instagram) and Google Ads', 'Set up, launched and optimized by our team every month', 'You own and fund the ad accounts — spend goes straight to the platforms'],
  },
  {
    icon: PenTool, name: 'Content',
    points: ['Posts, creative and campaign assets produced for you', 'Scheduled and published on your behalf', 'Built around your offers and industry'],
  },
  {
    icon: BarChart3, name: 'Analytics & reporting',
    points: ['Monthly statement: your actual ad spend and the fee billed', 'Fee calculation shown line by line — no black box', 'Spend recorded by your account manager from the ad accounts'],
  },
  {
    icon: Search, name: 'SEO / GEO / AEO',
    points: ['Organic search visibility', 'Local / geo visibility', 'Answer-engine optimization, worked on continuously'],
  },
  {
    icon: Users2, name: 'Organic distribution — groups',
    points: ['Your offers shared into relevant local groups and communities'],
  },
  {
    icon: Share2, name: 'Organic distribution — links',
    points: ['Your site and campaign links placed and shared where your customers already are'],
  },
];

export default function CampaignPricing() {
  return (
    <section id="domain-campaign" className="scroll-mt-24 border-t border-slate-200 bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-600">2 · LeadSpace Managed Ads</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Want us to run your ads &amp; growth?</h2>
          <p className="mt-3 text-slate-600">A managed service — our team plans, runs and optimizes your paid ads and organic growth every month. A flat management fee set by your monthly ad budget. Available with or without a DomainApp plan.</p>
        </div>

        {/* FEE TABLE */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 sm:grid-cols-3 sm:px-5">
            <span>Monthly ad budget</span>
            <span className="text-right sm:text-left">Management fee</span>
            <span className="hidden sm:block">Example</span>
          </div>
          {BRACKETS.map((b) => (
            <div key={b.range} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 border-b border-slate-100 px-4 py-3.5 sm:grid-cols-3 sm:px-5">
              <span className="text-sm font-medium text-slate-800">{b.range}</span>
              <span className="text-right text-lg font-bold text-primary-700 sm:text-left">{b.fee}<span className="text-xs font-medium text-slate-500">/month</span></span>
              <span className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:text-sm">{b.example}</span>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-x-2 bg-warning-50/60 px-4 py-3.5 sm:grid-cols-3 sm:px-5">
            <span className="text-sm font-medium text-slate-800">Enterprise / multi-brand</span>
            <span className="text-right text-lg font-bold text-slate-900 sm:text-left">Custom quote</span>
            <span className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:text-sm">Fee agreed per client — <Link href="/leadspace#get-started" className="font-semibold text-primary-700 hover:underline">talk to us</Link></span>
          </div>
        </div>
        <ul className="mx-auto mt-4 grid max-w-3xl gap-1.5 text-sm text-slate-600 sm:grid-cols-3">
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />Fees are + 18% GST</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />Ad spend is separate, paid directly to Meta / Google</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />Flat fee, not a % of spend. No retainer</li>
        </ul>

        {/* SCOPE */}
        <h3 className="mt-14 text-center text-xl font-bold text-slate-900">Everything included in the management fee</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCOPE.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.name} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50"><Icon className="h-5 w-5 text-primary-600" /></span>
                <p className="mt-3 text-base font-bold text-slate-900">{s.name}</p>
                <ul className="mt-2 space-y-1.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-slate-600"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{p}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-slate-500">
          Not the same as the campaign tools inside DomainApp (landing pages, AI content, messaging, which are part of your subscription) — LeadSpace Managed Ads is our team doing the work for you.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/leadspace#get-started" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-7 py-3.5 font-semibold text-white transition-all hover:bg-primary-700 sm:w-auto">
            Start with LeadSpace Managed Ads <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="/leadspace#managed-ads" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 font-medium text-slate-700 hover:bg-slate-100 sm:w-auto">
            See full details
          </Link>
        </div>
      </div>
    </section>
  );
}
