import Link from 'next/link';
import Breadcrumbs from '@/components/directory/Breadcrumbs';
import JsonLd from '@/components/directory/JsonLd';
import ListingCard from '@/components/directory/ListingCard';
import PageVisitBeacon from '@/components/directory/PageVisitBeacon';
import Pagination from '@/components/directory/Pagination';
import { EmptyState } from '@/components/directory/States';
import { S } from '@/lib/v3-public/strings';
import type { Facet, Link as ModelLink, PageModel } from '@/lib/v3-public/types';

function LinkList({ heading, items }: { heading: string; items: ModelLink[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{heading}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((l) => (
          <li key={l.path}>
            <Link href={l.path} className="inline-block rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
              {l.name}
              {typeof l.count === 'number' && l.count > 0 ? <span className="ml-1 text-slate-500">({l.count})</span> : null}
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
 */
export default function ModelPage({ model }: { model: PageModel }) {
  const hasCards = model.cards.length > 0;
  const hasLinks = model.facets.some((f) => f.items.length > 0);
  return (
    <>
      <JsonLd items={model.jsonLd} />
      <PageVisitBeacon />
      <Breadcrumbs crumbs={model.breadcrumbs} />
      <h1 className="text-3xl font-bold text-slate-900">{model.h1}</h1>
      {model.intro && <p className="mt-3 max-w-3xl text-slate-700">{model.intro}</p>}

      {hasCards ? (
        <section aria-label={S.list.heading} className="mt-6">
          {model.page && <p className="mb-3 text-sm text-slate-600">{model.page.total === 1 ? S.list.countOne : S.list.count(model.page.total)}</p>}
          <ul className="grid gap-4 sm:grid-cols-2">
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
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">{S.list.faqHeading}</h2>
          <dl className="mt-3 space-y-4">
            {model.faq.map((f) => (
              <div key={f.question}>
                <dt className="font-medium text-slate-900">{f.question}</dt>
                <dd className="mt-1 text-sm text-slate-700">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}
