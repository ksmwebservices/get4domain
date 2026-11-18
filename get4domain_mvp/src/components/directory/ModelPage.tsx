import Link from 'next/link';
import Breadcrumbs from '@/components/directory/Breadcrumbs';
import JsonLd from '@/components/directory/JsonLd';
import ListingCard from '@/components/directory/ListingCard';
import PageVisitBeacon from '@/components/directory/PageVisitBeacon';
import Pagination from '@/components/directory/Pagination';
import { EmptyState } from '@/components/directory/States';
import { FaqAccordion } from '@/components/portal/Section';
import { CHIP } from '@/components/portal/ui';
import { S } from '@/lib/v3-public/strings';
import type { Facet, Link as ModelLink, PageModel } from '@/lib/v3-public/types';

function LinkList({ heading, items }: { heading: string; items: ModelLink[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-ink-900">{heading}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((l) => (
          <li key={l.path}>
            <Link href={l.path} className={CHIP}>
              {l.name}
              {typeof l.count === 'number' && l.count > 0 ? <span className="text-slate-600">({l.count})</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FACET_HEADING: Record<Facet['kind'], string> = {
  locality: S.list.localities,
  category: S.list.categories,
  city: S.home.browseCities,
  pincode: S.list.browseHeading,
};

/**
 * A listing page (home, state, city, category, city-category, locality-category, pincode-category), rendered from the page model as given:
 * one H1, the intro, the cards, pagination, the facets and related links, the questions and answers, and the JSON-LD.
 * `headless` leaves out the breadcrumbs, H1 and intro, for a page (the directory home) whose hero already carries them.
 */
export default function ModelPage({ model, headless = false }: { model: PageModel; headless?: boolean }) {
  const hasCards = model.cards.length > 0;
  const hasLinks = model.facets.some((f) => f.items.length > 0);
  return (
    <>
      <JsonLd items={model.jsonLd} />
      <PageVisitBeacon />
      {headless ? <div className="mb-6"><Breadcrumbs crumbs={model.breadcrumbs} /></div> : (
        <>
          <Breadcrumbs crumbs={model.breadcrumbs} />
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">{model.h1}</h1>
          {model.intro && <p className="mt-3 max-w-3xl text-slate-700">{model.intro}</p>}
        </>
      )}

      {hasCards ? (
        <section aria-label={S.list.heading} className="mt-6">
          {model.page && <p className="mb-3 text-sm text-slate-600">{model.page.total === 1 ? S.list.countOne : S.list.count(model.page.total)}</p>}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {model.cards.map((c) => (
              <li key={c.slug}><ListingCard card={c} /></li>
            ))}
          </ul>
          <Pagination page={model.page} path={model.path} />
        </section>
      ) : (
        !hasLinks && <div className="mt-6"><EmptyState /></div>
      )}

      {model.facets.map((f) => (
        <LinkList key={f.kind} heading={FACET_HEADING[f.kind]} items={f.items} />
      ))}
      <LinkList heading={S.list.localities} items={model.related.nearbyLocalities} />
      <LinkList heading={S.list.categories} items={model.related.relatedCategories} />
      <LinkList heading={S.list.parents} items={model.related.parents} />

      {model.faq.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-ink-900">{S.list.faqHeading}</h2>
          <FaqAccordion items={model.faq.map((f) => ({ q: f.question, a: f.answer }))} />
        </section>
      )}
    </>
  );
}
