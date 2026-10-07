'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Minus, ArrowRight, Sparkles, Megaphone, Code2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PLAN_TERMS, formatINR, gstOn, totalWithGst, fetchLivePricing, applyLivePricing } from '@/lib/pricing';
import {
  buildMatrix, upgradeDelta, CAMPAIGN_BRACKETS, CAMPAIGN_SUMMARY, MANAGED_SUMMARY, type Cell,
} from '@/data/platform-features';

export type PlanTier = 'Workspace' | 'BOS';

function CellView({ value }: { value: Cell }) {
  if (value === true) return <Check aria-label="Included" className="mx-auto h-4 w-4 text-success-500" />;
  if (value === false) return <Minus aria-label="Not included" className="mx-auto h-4 w-4 text-slate-400" />;
  return <span className="text-sm font-semibold text-slate-900">{value}</span>;
}

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

/** Current plan's full feature list, the Workspace → BOS upgrade delta, and the optional
 *  done-for-you services. Everything is derived from the same data the marketing /pricing page
 *  renders (src/data/platform-features.ts + PLAN_TERMS in src/lib/pricing.ts), so the two
 *  cannot disagree about what a tier includes. */
export default function PlanOverview({ tier, adminDeal = false }: { tier: PlanTier; adminDeal?: boolean }) {
  const isBos = tier === 'BOS';
  const [terms, setTerms] = useState(PLAN_TERMS);
  useEffect(() => { fetchLivePricing().then((live) => setTerms(applyLivePricing(live))); }, []);
  const { workspace, bos } = terms;
  const plan = isBos ? bos : workspace;

  // Rows the current tier includes (a string cell is a quantity, e.g. "3 keywords").
  const groups = buildMatrix(workspace, bos, formatINR)
    .map((g) => ({
      title: g.title,
      rows: g.rows
        .map((r) => ({ feature: r.feature, value: isBos ? r.bos : r.ws }))
        .filter((r) => r.value !== false),
    }))
    .filter((g) => g.rows.length > 0);

  const delta = upgradeDelta(workspace, bos, formatINR);
  const gains = delta.filter((r) => r.bos !== false);
  const total = totalWithGst(bos.baseAmount);

  return (
    <div className="space-y-6">
      {/* CURRENT PLAN — everything it includes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">What&apos;s in your {tier} plan</h3>
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">DomainApp {tier}</span>
        </div>
        {!adminDeal && (
          <p className="mt-1 text-xs text-slate-500">{plan.billingNote} · {formatINR(plan.baseAmount)} + {formatINR(gstOn(plan.baseAmount))} GST = {formatINR(totalWithGst(plan.baseAmount))} per year</p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-primary-600">{g.title}</p>
              <ul className="mt-3 space-y-2">
                {g.rows.map((r) => (
                  <li key={r.feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-500" />
                    <span>{r.feature}{typeof r.value === 'string' && <span className="ml-1.5 font-semibold text-slate-900">· {r.value}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* UPGRADE PATH — Workspace only: exactly the rows that differ */}
      {!isBos && adminDeal && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Want more than Workspace?</h3>
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
                <h3 className="text-base font-bold text-slate-900">Upgrade to BOS</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">Everything in Workspace, plus the complete back office.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{bos.headline}<span className="text-sm font-normal text-slate-500">{bos.headlinePeriod}</span></p>
              <p className="text-[11px] text-slate-500">{formatINR(bos.baseAmount)} + {formatINR(gstOn(bos.baseAmount))} GST = {formatINR(total)} per year</p>
            </div>
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-primary-600">What you gain</p>
          <List items={gains.map((r) => (typeof r.bos === 'string' && r.ws !== false ? `${r.feature}: ${String(r.ws)} → ${r.bos}` : r.feature))} />

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1fr_6rem_6rem] items-center bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 sm:grid-cols-[1fr_8rem_8rem]">
              <span>What changes</span><span className="text-center">Workspace</span><span className="text-center text-primary-600">BOS</span>
            </div>
            {delta.map((row) => (
              <div key={row.feature} className="grid grid-cols-[1fr_6rem_6rem] items-center border-t border-slate-200 px-4 py-2.5 sm:grid-cols-[1fr_8rem_8rem]">
                <span className="pr-2 text-sm text-slate-600">{row.feature}</span>
                <span className="text-center"><CellView value={row.ws} /></span>
                <span className="text-center"><CellView value={row.bos} /></span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/dashboard/support"><Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>Upgrade to BOS</Button></Link>
            <span className="text-xs text-slate-500">Our team activates the upgrade and sends a payment link.</span>
          </div>
        </div>
      )}

      {/* DONE-FOR-YOU SERVICES — separate, optional */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900">Want us to do it for you?</h3>
        <p className="mt-1 text-sm text-slate-500">Separate, optional services run by our team — they&apos;re not part of your DomainApp plan.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary-600" /><p className="text-xs font-bold uppercase tracking-wider text-primary-600">DomainCampaign</p></div>
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
            <Link href="/dashboard/my-services" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary-600 hover:text-primary-700">Request DomainCampaign <ArrowRight className="h-4 w-4" /></Link>
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
