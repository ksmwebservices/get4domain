import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import AcceptNotice from '@/components/site/AcceptNotice';
import PricingPlans, { type PlanRow } from '@/components/site/PricingPlans';
import { assertV3Public } from '@/lib/v3-public/guard';
import { ADDON_PACKS, fetchPlans, formatRupees, netAmountPaise, priceFor, PUBLIC_TERMS, type PublicPlan, type PublicPlans } from '@/lib/v3-public/plans';
import { faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.pricing.metaTitle, description: SITE.pricing.metaDescription, path: '/pricing' });
}

/** The text a feature cell shows: words only, never the API's upsell text (which is free text written elsewhere). */
function featureText(f: PublicPlan['features'][number]): string {
  const P = SITE.pricing;
  if (f.state === 'LIMITED') return f.limit !== null ? `${P.featureUpTo} ${f.limit}${f.unit ? ` ${f.unit}` : ''}` : P.featureIncluded;
  if (f.state === 'LOCKED_PREVIEW') return P.featurePreview;
  return P.featureIncluded;
}

function rowsOf(data: PublicPlans): PlanRow[] {
  return data.plans.map((p) => {
    const prices: Record<number, string | null> = {};
    for (const t of PUBLIC_TERMS) {
      const { paise } = priceFor(p, t, data.tax);
      prices[t] = paise === null ? null : formatRupees(paise);
    }
    const pending = !p.prices.some((x) => netAmountPaise(x, data.tax) !== null);
    return { key: p.key, name: p.name, description: p.description, prices, pending };
  });
}

export default async function PricingPage() {
  assertV3Public();
  const P = SITE.pricing;
  const r = await fetchPlans();
  const data = r.kind === 'ok' ? r.data : null;
  const rows = data ? rowsOf(data) : [];
  // the add-ons the API lists win; the fixed list is only the fallback while the API is unreachable (a price shows only when the API gives one)
  const addons = data?.addons && data.addons.length ? data.addons : ADDON_PACKS.map((a) => ({ key: a.key, name: a.name, description: null, priceMinor: null }));
  // the feature comparison: one table, rows are features in the API's order, columns are the plans
  const keys: Array<{ key: string; name: string }> = [];
  if (data) for (const p of data.plans) for (const f of p.features) if (!keys.some((k) => k.key === f.key)) keys.push({ key: f.key, name: f.name });
  return (
    <>
      <JsonLd items={[faqLd(P.faq)]} />
      <h1 className="text-3xl font-bold text-slate-900">{P.h1}</h1>
      <p className="mt-2 text-slate-600">{P.intro}</p>

      <section aria-labelledby="free-title" className="mt-8 rounded-xl border border-slate-200 p-5">
        <h2 id="free-title" className="text-xl font-semibold text-slate-900">{P.free.name}</h2>
        <p className="mt-1 text-slate-600">{P.free.tagline}</p>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">{P.free.points.map((x) => <li key={x}>{x}</li>)}</ul>
        <Link href="/register?plan=free" className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">{P.free.cta}</Link>
      </section>

      <section aria-labelledby="plans-title" className="mt-10">
        <h2 id="plans-title" className="mb-4 text-xl font-semibold text-slate-900">{P.plansHeading}</h2>
        {data && rows.length > 0 ? <PricingPlans terms={data.terms.length ? data.terms : [...PUBLIC_TERMS]} plans={rows} /> : <p className="text-slate-600" role="status">{r.kind === 'ok' ? P.empty : P.loadError}</p>}
      </section>
      <AcceptNotice className="mt-4 text-sm text-slate-600" />

      <section aria-labelledby="compare-title" className="mt-10">
        <h2 id="compare-title" className="mb-3 text-xl font-semibold text-slate-900">{P.compareHeading}</h2>
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{P.compareCaption}</caption>
          <thead><tr className="border-b border-slate-300"><th scope="col" className="py-2 pr-3" /><th scope="col" className="py-2 pr-3">{P.compareFree}</th><th scope="col" className="py-2">{P.comparePaid}</th></tr></thead>
          <tbody>
            {P.compareRows.map((row) => (
              <tr key={row.label} className="border-b border-slate-200"><th scope="row" className="py-2 pr-3 font-medium text-slate-900">{row.label}</th><td className="py-2 pr-3 text-slate-700">{row.free}</td><td className="py-2 text-slate-700">{row.paid}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {data && keys.length > 0 ? (
        <section aria-labelledby="features-title" className="mt-10">
          <h2 id="features-title" className="mb-3 text-xl font-semibold text-slate-900">{P.featuresHeading}</h2>
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr className="border-b border-slate-300"><th scope="col" className="py-2 pr-3"><span className="sr-only">{P.featuresHeading}</span></th>{data.plans.map((p) => <th key={p.key} scope="col" className="py-2 pr-3">{p.name}</th>)}</tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.key} className="border-b border-slate-200">
                  <th scope="row" className="py-2 pr-3 font-medium text-slate-900">{k.name}</th>
                  {data.plans.map((p) => { const f = p.features.find((x) => x.key === k.key); return <td key={p.key} className="py-2 pr-3 text-slate-700">{f ? featureText(f) : '-'}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section aria-labelledby="addons-title" className="mt-10">
        <h2 id="addons-title" className="mb-2 text-xl font-semibold text-slate-900">{P.addonsHeading}</h2>
        <p className="mb-3 text-slate-600">{P.addonsIntro}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {addons.map((a) => (<li key={a.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm"><span className="text-slate-900">{a.name}</span><span className="text-slate-600">{a.priceMinor === null ? P.addonsPrice : formatRupees(a.priceMinor)}</span></li>))}
        </ul>
      </section>

      <section aria-labelledby="faq-title" className="mt-10">
        <h2 id="faq-title" className="mb-3 text-xl font-semibold text-slate-900">{P.faqHeading}</h2>
        <dl className="space-y-4">{P.faq.map((f) => (<div key={f.q}><dt className="font-medium text-slate-900">{f.q}</dt><dd className="mt-1 text-slate-700">{f.a}</dd></div>))}</dl>
      </section>
    </>
  );
}
