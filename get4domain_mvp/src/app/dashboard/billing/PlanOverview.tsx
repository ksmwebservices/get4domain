'use client';

import Link from 'next/link';
import { Check, ArrowRight, Sparkles, Megaphone, Code2, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PLAN_TERMS, formatINR, gstOn, totalWithGst } from '@/lib/pricing';
import {
  WORKSPACE_INCLUDED, BOS_EXTRA, CAMPAIGN_BRACKETS, CAMPAIGN_INCLUDES, MANAGED_INCLUDES, isComingSoon,
} from '@/lib/plan-features';

export type PlanTier = 'Workspace' | 'BOS';

const bos = PLAN_TERMS.bos;
const ws = PLAN_TERMS.workspace;

// Rows for the Workspace → BOS comparison. Numbers come from PLAN_TERMS (the same source the
// marketing pricing card uses); the feature rows mirror BOS_EXTRA in lib/plan-features.
const COMPARISON: { label: string; workspace: string | boolean; bos: string | boolean; soon?: boolean }[] = [
  { label: 'Industry website, CRM, TeleCRM, invoicing, expenses', workspace: true, bos: true },
  { label: 'Website auto-bot reply', workspace: true, bos: true },
  { label: 'WhatsApp bot reply', workspace: false, bos: true },
  { label: 'Task management & assigning', workspace: false, bos: true },
  { label: 'Full GST + P&L accounting', workspace: false, bos: true },
  { label: 'HRM', workspace: false, bos: true, soon: true },
  { label: 'Office management', workspace: false, bos: true, soon: true },
  { label: 'One-time AI Studio credit', workspace: formatINR(ws.welcomeCredit), bos: formatINR(bos.welcomeCredit) },
  { label: 'Free SEO keywords', workspace: String(ws.freeSeoKeywords), bos: String(bos.freeSeoKeywords) },
  { label: 'Theme changes / year', workspace: String(ws.themeChangesPerYear), bos: String(bos.themeChangesPerYear) },
];

function Cell({ value, soon }: { value: string | boolean; soon?: boolean }) {
  if (typeof value === 'string') return <span className="text-sm font-semibold text-slate-900">{value}</span>;
  if (!value) return <span className="text-sm text-slate-400">—</span>;
  if (soon) return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><Clock className="h-3.5 w-3.5" />Coming soon</span>;
  return <Check className="mx-auto h-4 w-4 text-success-500" />;
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => {
        const soon = isComingSoon(item);
        return (
          <li key={item} className={`flex items-start gap-2.5 text-sm ${soon ? 'text-slate-400' : 'text-slate-700'}`}>
            <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${soon ? 'text-slate-400' : 'text-success-500'}`} />{item}
          </li>
        );
      })}
    </ul>
  );
}

/** Full feature list for the vendor's current plan, the Workspace → BOS upgrade comparison,
 *  and the optional managed services. Data is shared with the marketing /pricing page. */
export default function PlanOverview({ tier }: { tier: PlanTier }) {
  const isBos = tier === 'BOS';
  const bosOnly = BOS_EXTRA.filter((i) => i !== 'Everything in Workspace');
  const total = totalWithGst(bos.baseAmount);

  return (
    <div className="space-y-6">
      {/* CURRENT PLAN — everything it includes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">What&apos;s in your {tier} plan</h3>
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">DomainApp {tier}</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKSPACE_INCLUDED.map((section) => (
            <div key={section.group} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-primary-600">{section.group}</p>
              <FeatureList items={section.items} />
            </div>
          ))}
          {isBos && (
            <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4 sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-bold uppercase tracking-wider text-primary-600">BOS — full back office</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {bosOnly.map((item) => {
                  const soon = isComingSoon(item);
                  return (
                    <li key={item} className={`flex items-start gap-2.5 text-sm ${soon ? 'text-slate-400' : 'text-slate-700'}`}>
                      <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${soon ? 'text-slate-400' : 'text-success-500'}`} />{item}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        {isBos && <p className="mt-3 text-xs text-slate-500">Everything in Workspace is included in BOS. Items marked coming soon are on the roadmap and not yet available.</p>}
      </div>

      {/* UPGRADE PATH — Workspace only */}
      {!isBos && (
        <div className="rounded-2xl border-2 border-primary-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-warning-600" />
                <h3 className="text-base font-bold text-slate-900">Upgrade to BOS</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">Everything in Workspace, plus the full back office.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{bos.headline}<span className="text-sm font-normal text-slate-500">{bos.headlinePeriod}</span></p>
              <p className="text-[11px] text-slate-500">{formatINR(bos.baseAmount)} + {formatINR(gstOn(bos.baseAmount))} GST = {formatINR(total)} per year</p>
            </div>
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-primary-600">What you gain</p>
          <FeatureList items={bosOnly} />

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 sm:grid-cols-[1fr_7rem_7rem]">
              <span>Compare</span><span className="text-center">Workspace</span><span className="text-center text-primary-600">BOS</span>
            </div>
            {COMPARISON.map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center border-t border-slate-200 px-4 py-2.5 sm:grid-cols-[1fr_7rem_7rem]">
                <span className="pr-2 text-sm text-slate-600">{row.label}</span>
                <span className="text-center"><Cell value={row.workspace} /></span>
                <span className="text-center"><Cell value={row.bos} soon={row.soon} /></span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/dashboard/support"><Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>Upgrade to BOS</Button></Link>
            <span className="text-xs text-slate-500">Our team activates the upgrade and sends a payment link.</span>
          </div>
        </div>
      )}

      {/* MANAGED SERVICES — separate, optional */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900">Want us to do it for you?</h3>
        <p className="mt-1 text-sm text-slate-500">Separate, optional services run by our team — they&apos;re not part of your DomainApp plan.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary-600" /><p className="text-xs font-bold uppercase tracking-wider text-primary-600">DomainCampaign</p></div>
            <p className="mt-2 text-sm font-semibold text-slate-900">Managed paid ads &amp; growth</p>
            <FeatureList items={CAMPAIGN_INCLUDES} />
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              {CAMPAIGN_BRACKETS.map((b) => (
                <div key={b.range} className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs last:border-b-0">
                  <span className="text-slate-600">{b.range}</span><span className="font-semibold text-slate-900">{b.fee}/month</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">Management fee + 18% GST.</p>
            <Link href="/dashboard/my-services" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary-600 hover:text-primary-700">Request DomainCampaign <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2"><Code2 className="h-4 w-4 text-primary-600" /><p className="text-xs font-bold uppercase tracking-wider text-primary-600">Managed Services</p></div>
            <p className="mt-2 text-sm font-semibold text-slate-900">Custom software &amp; marketing</p>
            <FeatureList items={MANAGED_INCLUDES} />
            <p className="mt-3 text-xs text-slate-500">Custom-quoted per project — no fixed price list.</p>
            <Link href="/managed-services#quote" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary-600 hover:text-primary-700">Get a custom quote <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
