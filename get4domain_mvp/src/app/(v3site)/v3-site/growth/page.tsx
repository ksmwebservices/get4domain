import type { Metadata } from 'next';
import JsonLd from '@/components/directory/JsonLd';
import GrowthGrid, { StatusChip } from '@/components/portal/GrowthGrid';
import PageHead from '@/components/portal/PageHead';
import { CtaBox, FaqList, Steps } from '@/components/site/Blocks';
import { GROWTH_GROUPS, servicesOf, type GrowthStatus } from '@/lib/v3-public/growth-config';
import { GROWTH, growthAnchor } from '@/lib/v3-public/growth-strings';
import { assertV3Public } from '@/lib/v3-public/guard';
import { faqLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: GROWTH.metaTitle, description: GROWTH.metaDescription, path: '/growth' });
}

export default function GrowthPage() {
  assertV3Public();
  return (
    <>
      <JsonLd items={[faqLd(GROWTH.faq)]} />
      <PageHead crumbs={[{ name: GROWTH.nav, path: '/growth' }]} h1={GROWTH.h1} lead={GROWTH.lead} />
      <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{GROWTH.honest}</p>
      <CtaBox id="top-cta" heading={GROWTH.ctaHeading} links={[{ href: '/register?plan=free', label: GROWTH.ctaStart }, { href: '/pricing', label: GROWTH.ctaPlans }]} />

      <section aria-labelledby="model-title" className="mt-10">
        <h2 id="model-title" className="text-2xl font-bold tracking-tight text-ink-900">{GROWTH.modelHeading}</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {GROWTH.model.map((m) => (
            <li key={m.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><h3 className="text-lg font-bold text-ink-900">{m.title}</h3><p className="mt-2 text-sm text-slate-700">{m.body}</p></li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">{GROWTH.allowanceNote}</p>
      </section>

      <Steps id="how-title" heading={GROWTH.howHeading} steps={GROWTH.how} />

      {GROWTH_GROUPS.map((g) => (
        <section key={g.key} id={growthAnchor(g.key)} aria-labelledby={`${growthAnchor(g.key)}-title`} className="mt-10 scroll-mt-24">
          <h2 id={`${growthAnchor(g.key)}-title`} className="text-2xl font-bold tracking-tight text-ink-900">{g.name}</h2>
          <p className="mb-4 mt-1 text-slate-700">{g.blurb}</p>
          <GrowthGrid services={servicesOf(g.key)} />
        </section>
      ))}

      <section aria-labelledby="status-title" className="mt-10">
        <h2 id="status-title" className="text-2xl font-bold tracking-tight text-ink-900">{GROWTH.statusHeading}</h2>
        <ul className="mt-3 space-y-3">
          {GROWTH.statusNotes.map((n) => (
            <li key={n.status} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <StatusChip status={n.status as GrowthStatus} />
              <span className="text-sm text-slate-700">{n.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="free-title" className="mt-10">
        <h2 id="free-title" className="text-2xl font-bold tracking-tight text-ink-900">{GROWTH.freeHeading}</h2>
        <p className="mt-2 text-slate-700">{GROWTH.freeBody}</p>
      </section>

      <FaqList id="faq-title" heading={GROWTH.faqHeading} items={GROWTH.faq} />
      <CtaBox id="cta-title" heading={GROWTH.ctaHeading} body={GROWTH.ctaBody} links={[{ href: '/register?plan=free', label: GROWTH.ctaStart }, { href: '/pricing', label: GROWTH.ctaPlans }]} />
    </>
  );
}
