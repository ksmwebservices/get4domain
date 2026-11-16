import Link from 'next/link';
import Breadcrumbs from '@/components/directory/Breadcrumbs';
import JsonLd from '@/components/directory/JsonLd';
import PageVisitBeacon from '@/components/directory/PageVisitBeacon';
import { fetchBacklinkBlock } from '@/lib/v3-public/api';
import { goHref, parseVisitUrl } from '@/lib/v3-public/click';
import { S } from '@/lib/v3-public/strings';
import type { BacklinkBlock, PageModel } from '@/lib/v3-public/types';

const isHttp = (href: string): boolean => /^https?:\/\//i.test(href);

function BacklinkLinks({ block }: { block: BacklinkBlock }) {
  const all = [block.brand, ...block.links].filter((l) => l && l.text && isHttp(l.href));
  if (all.length === 0) return null;
  return (
    <section aria-labelledby="backlinks-title" className="mt-8">
      <h2 id="backlinks-title" className="text-lg font-semibold text-slate-900">{S.business.backlinksHeading}</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {all.map((l) => (
          <li key={l.href}><a href={l.href} className="text-primary-700 hover:underline">{l.text}</a></li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A business profile, from the page model as given: name, category, locality and city, the description of the listing, hours when present,
 * the listing status (informational), one Visit site link through the click-out, the backlink block when the API has one, and, for an unclaimed listing, a claim call to action.
 * There is no phone, email, messaging link or street address on this page.
 */
export default async function BusinessPage({ model }: { model: PageModel }) {
  const b = model.business;
  if (!b) return null;
  const click = parseVisitUrl(b.visitUrl);
  const href = b.listingOnly ? null : goHref(b.visitUrl);
  const block = click ? await fetchBacklinkBlock(click.id) : null;
  const slug = model.path.split('/').filter(Boolean).pop() ?? '';
  const area = [b.locality, b.city && b.city !== b.locality ? b.city : null].filter(Boolean).join(', ');
  return (
    <>
      <JsonLd items={model.jsonLd} />
      <PageVisitBeacon />
      <Breadcrumbs crumbs={model.breadcrumbs} />
      <article>
        <h1 className="text-3xl font-bold text-slate-900">{b.name}</h1>
        <p className="mt-2 text-slate-600">{[b.category, area].filter(Boolean).join(' · ')}</p>

        {b.description && (
          <section aria-labelledby="about-title" className="mt-6">
            <h2 id="about-title" className="text-lg font-semibold text-slate-900">{S.business.about}</h2>
            <p className="mt-2 max-w-3xl text-slate-700">{b.description}</p>
          </section>
        )}

        <dl className="mt-6 grid max-w-xl gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {b.category && (
            <div><dt className="font-medium text-slate-900">{S.business.category}</dt><dd className="text-slate-700">{b.category}</dd></div>
          )}
          {area && (
            <div><dt className="font-medium text-slate-900">{S.business.area}</dt><dd className="text-slate-700">{area}</dd></div>
          )}
          {b.hoursText && (
            <div className="sm:col-span-2"><dt className="font-medium text-slate-900">{S.business.hours}</dt><dd className="text-slate-700">{b.hoursText}</dd></div>
          )}
        </dl>

        <section aria-labelledby="state-title" className="mt-6">
          <h2 id="state-title" className="text-lg font-semibold text-slate-900">{S.business.listingState}</h2>
          <p className="mt-2 text-sm text-slate-700">{b.claimed ? S.business.stateClaimed : S.business.stateUnclaimed}</p>
          {b.claimed && b.verified && <p className="mt-1 text-sm text-slate-700">{S.business.stateVerified}</p>}
          <p className="mt-1 text-sm text-slate-500">{S.business.stateInformational}</p>
        </section>

        <section aria-labelledby="visit-title" className="mt-6">
          <h2 id="visit-title" className="text-lg font-semibold text-slate-900">{S.business.visitHeading}</h2>
          {href ? (
            <>
              <a href={href} rel="nofollow noopener" aria-label={S.card.visitFor(b.name)} className="mt-3 inline-block rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600">
                {S.card.visit}
              </a>
              <p className="mt-2 text-xs text-slate-500">{S.business.visitNote}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">{S.card.listingOnly}</p>
          )}
        </section>

        {!b.claimed && (
          <section aria-labelledby="claim-title" className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 id="claim-title" className="text-lg font-semibold text-slate-900">{S.business.claimHeading}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">{S.business.claimBody}</p>
            <Link href={`/claim?business=${encodeURIComponent(slug)}`} className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">{S.business.claimCta}</Link>
          </section>
        )}

        {block && <BacklinkLinks block={block} />}
      </article>
    </>
  );
}
