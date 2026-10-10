'use client';

import { planDisplayName } from '@/lib/nav.generated';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, ArrowRight, Sparkles, Megaphone, Code2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PLAN_TERMS, formatINR, gstOn, totalWithGst, fetchLivePricing, applyLivePricing } from '@/lib/pricing';
import { CAMPAIGN_BRACKETS, CAMPAIGN_SUMMARY, MANAGED_SUMMARY } from '@/data/platform-features';
import { groupLines, planFeatureLines, planGains, type PlanLine } from '@/lib/plan-features';

export type PlanTier = 'Workspace' | 'BOS';
/** What the vendor reads: Essentials / Pro (internal keys stay WORKSPACE / BOS). */
const tierName = (tier: PlanTier): string => planDisplayName(tier === 'BOS' ? 'BOS' : 'WORKSPACE');

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{item}
        </li>
      ))}
    </ul>
  );
}

function Line({ l }: { l: PlanLine }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-slate-700">
      {l.state === 'INCLUDED' ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" aria-label="Included" /> : <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-label="Coming soon" />}
      <span className={l.state === 'INCLUDED' ? '' : 'text-slate-500'}>{l.label}{l.state === 'COMING_SOON' && <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Coming soon</span>}</span>
    </li>
  );
}

/**
 * The current plan's list, the Essentials to Pro difference and the optional done-for-you services.
 * The feature list is GENERATED from the feature registry (src/lib/plan-features.ts): what is built is listed, what is not yet built says "Coming soon",
 * and nothing else is claimed. The numbers (prices, free SEO keywords, theme changes, the AI Studio credit) come from the pricing config, and the
 * credit shown is the one this vendor's TERM includes, so this card and the term above it can never disagree.
 */
export default function PlanOverview({ tier, adminDeal = false, aiCreditPaise }: { tier: PlanTier; adminDeal?: boolean; aiCreditPaise?: number | null }) {
  const isBos = tier === 'BOS';
  const [terms, setTerms] = useState(PLAN_TERMS);
  useEffect(() => { fetchLivePricing().then((live) => setTerms(applyLivePricing(live))); }, []);
  const { bos } = terms;
  const plan = isBos ? terms.bos : terms.workspace;
  const credit = aiCreditPaise != null ? aiCreditPaise / 100 : plan.welcomeCredit;

  const groups = groupLines(planFeatureLines(isBos ? 'BOS' : 'WORKSPACE'));
  const gains = planGains('WORKSPACE', 'BOS');
  const total = totalWithGst(bos.baseAmount);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">What&apos;s in your {tierName(tier)} plan</h3>
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">{tierName(tier)}</span>
        </div>
        {!adminDeal && (
          <p className="mt-1 text-xs text-slate-500">{plan.billingNote} · {formatINR(plan.baseAmount)} + {formatINR(gstOn(plan.baseAmount))} GST = {formatINR(totalWithGst(plan.baseAmount))} per year</p>
        )}
        <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />AI Studio credit with your plan: <strong className="ml-1">{formatINR(credit)}</strong></li>
          <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{plan.freeSeoKeywords} free SEO keywords</li>
          <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />{plan.themeChangesPerYear} theme changes a year</li>
        </ul>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-primary-600">{g.title}</p>
              <ul className="mt-3 space-y-2">{g.lines.map((l) => <Line key={l.id} l={l} />)}</ul>
            </div>
          ))}
        </div>
      </div>

      {!isBos && adminDeal && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Want more than {planDisplayName('WORKSPACE')}?</h3>
              <p className="mt-1 text-sm text-slate-500">Your plan is on special terms, so changes are arranged with our team.</p>
            </div>
            <Link href="/dashboard/support"><Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>Contact us</Button></Link>
          </div>
        </div>
      )}

      {!isBos && !adminDeal && (
        <div className="rounded-2xl border-2 border-primary-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-warning-600" />
                <h3 className="text-base font-bold text-slate-900">Upgrade to {planDisplayName('BOS')}</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">Everything in {planDisplayName('WORKSPACE')}, plus the tools below. Everything you have already entered carries over; nothing is re-entered.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{bos.headline}<span className="text-sm font-normal text-slate-500">{bos.headlinePeriod}</span></p>
              <p className="text-[11px] text-slate-500">{formatINR(bos.baseAmount)} + {formatINR(gstOn(bos.baseAmount))} GST = {formatINR(total)} per year</p>
            </div>
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-primary-600">What you gain</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{gains.map((l) => <Line key={l.id} l={l} />)}</ul>
          <p className="mt-3 text-xs text-slate-500">{bos.freeSeoKeywords} free SEO keywords and {bos.themeChangesPerYear} theme changes a year, instead of {terms.workspace.freeSeoKeywords} and {terms.workspace.themeChangesPerYear}.</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/dashboard/support"><Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>Upgrade to {planDisplayName('BOS')}</Button></Link>
            <span className="text-xs text-slate-500">Our team activates the upgrade and sends a payment link.</span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900">Want us to do it for you?</h3>
        <p className="mt-1 text-sm text-slate-500">Separate, optional services run by our team — they&apos;re not part of your plan.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary-600" /><p className="text-xs font-bold uppercase tracking-wider text-primary-600">Managed Ads</p></div>
            <p className="mt-2 text-sm font-semibold text-slate-900">Managed paid ads &amp; growth</p>
            <List items={CAMPAIGN_SUMMARY} />
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              {CAMPAIGN_BRACKETS.map((b) => (
                <div key={b.range} className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs last:border-b-0">
                  <span className="text-slate-600">{b.range}</span><span className="font-semibold text-slate-900">{b.fee}/month</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">Management fee + 18% GST.</p>
            <Link href="/dashboard/my-services" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary-600 hover:text-primary-700">Request Managed Ads <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2"><Code2 className="h-4 w-4 text-primary-600" /><p className="text-xs font-bold uppercase tracking-wider text-primary-600">Managed Services</p></div>
            <p className="mt-2 text-sm font-semibold text-slate-900">Custom software &amp; marketing</p>
            <List items={MANAGED_SUMMARY} />
            <p className="mt-3 text-xs text-slate-500">Custom-quoted per project — no fixed price list.</p>
            <Link href="/managed-services#quote" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary-600 hover:text-primary-700">Get a custom quote <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
