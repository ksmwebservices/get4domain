import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '@/components/directory/States';
import BusinessCard from '@/components/portal/BusinessCard';
import DirectoryBrowse from '@/components/portal/DirectoryBrowse';
import DirectoryEmpty from '@/components/portal/DirectoryEmpty';
import DirectoryHero from '@/components/portal/DirectoryHero';
import { btn, CARD, INPUT, LABEL } from '@/components/portal/ui';
import { assertV3Public } from '@/lib/v3-public/guard';
import { baseDomain, readHostConfig } from '@/lib/v3-public/hostnames';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { windowOf } from '@/lib/v3-public/pagination';
import { portalLinks } from '@/lib/v3-public/portal-links';
import { fetchTrees, resolveSearch, searchDirectory, searchQueryString, type Resolved, type SearchResult, type Trees } from '@/lib/v3-public/portal-search';
import { pageOf, PORTAL, resultCount } from '@/lib/v3-public/portal-strings';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '').slice(0, 120);

/** The results page is for people, not for search engines: never indexed (the robots file also disallows /search). */
export function generateMetadata(): Metadata {
  assertV3Public();
  return noindexMetadata(`${PORTAL.directory.searchMetaTitle} | ${S.brand}`, PORTAL.directory.metaDescription);
}

function Refine({ trees, resolved, action }: { trees: Trees; resolved: Resolved; action: string }) {
  const D = PORTAL.directory;
  const cities = trees.places.filter((p) => p.kind === 'CITY' || (p.kind === null && p.depth === 2));
  const areas = trees.places.filter((p) => p.kind !== 'STATE' && p.kind !== 'DISTRICT' && !cities.includes(p));
  return (
    <form action={action} method="get" className={`${CARD} grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end`}>
      <div>
        <label htmlFor="f-cat" className={LABEL}>{D.filterCategory}</label>
        <select id="f-cat" name="c" defaultValue={resolved.category?.slug ?? ''} className={INPUT}>
          <option value="">{D.anyCategory}</option>
          {trees.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-place" className={LABEL}>{D.filterPlace}</label>
        <select id="f-place" name="l" defaultValue={resolved.place?.path ?? ''} className={INPUT}>
          <option value="">{D.anyPlace}</option>
          {cities.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
          {areas.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
        </select>
      </div>
      {/* the typed words stay when no category or place was chosen from the lists */}
      {!resolved.category && resolved.what ? <input type="hidden" name="what" value={resolved.what} /> : null}
      {!resolved.place && resolved.where ? <input type="hidden" name="where" value={resolved.where} /> : null}
      <button type="submit" className={btn('primary')}>{D.apply}</button>
      <Link href={action} className={btn('secondary')}>{D.clear}</Link>
    </form>
  );
}

function Pager({ result, input, action }: { result: SearchResult; input: { what: string; where: string; c: string; l: string }; action: string }) {
  if (result.totalPages <= 1) return null;
  const D = PORTAL.directory;
  const href = (n: number): string => `${action}${searchQueryString({ ...input, page: n })}`;
  return (
    <nav aria-label={S.pagination.label} className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="min-w-[8rem]">{result.page > 1 ? <Link href={href(result.page - 1)} rel="prev" className="font-semibold text-brand-700 hover:underline">{D.prev}</Link> : null}</div>
      <ol className="flex items-center gap-1" aria-label={pageOf(result.page, result.totalPages)}>
        {windowOf(result.page, result.totalPages).map((n) => (
          <li key={n}>
            {n === result.page
              ? <span aria-current="page" className="inline-block rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white">{n}</span>
              : <Link href={href(n)} aria-label={S.pagination.goTo(n)} className="inline-block rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">{n}</Link>}
          </li>
        ))}
      </ol>
      <div className="min-w-[8rem] text-right">{result.page < result.totalPages ? <Link href={href(result.page + 1)} rel="next" className="font-semibold text-brand-700 hover:underline">{D.next}</Link> : null}</div>
    </nav>
  );
}

/**
 * The directory search results. The same resolver and the same route as the home page box: typed words become a category or a place when they are one, anything else is the text query.
 * Honest by construction: an empty directory shows the empty state with "List your business" and "Claim a listing", and a place we do not have is said so, never turned into "everywhere".
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  assertV3Public();
  const q = await searchParams;
  const input = { what: one(q.what), where: one(q.where), c: one(q.c), l: one(q.l) };
  const pageNo = Number(one(q.page)) || 1;
  const l = portalLinks('directory');
  const base = baseDomain(readHostConfig());
  const t = await fetchTrees();
  const trees = t.kind === 'ok' ? t.data : null;
  const resolved = resolveSearch(trees, input);
  const asked = !!(input.what || input.where || input.c || input.l);
  const res = asked ? await searchDirectory(resolved, pageNo) : null;
  const D = PORTAL.directory;
  const here = `${l.search}${searchQueryString({ ...input, page: pageNo })}`;

  return (
    <>
      <DirectoryHero
        h1={asked ? D.results : D.h1}
        lead={D.lead}
        search={{ action: l.search, registerHref: l.main('/register'), suffix: base ? `.${base}` : '', initial: input, idPrefix: 'res' }}
      />
      <div className="pt-8">
        {!asked ? (
          <DirectoryBrowse trees={trees} searchHref={l.search} />
        ) : res && res.kind !== 'ok' ? (
          <ErrorState path={here} />
        ) : res ? (
          <div>
            {trees ? <div className="mb-6"><Refine trees={trees} resolved={resolved} action={l.search} /></div> : null}
            <h2 className="text-xl font-bold text-ink-900" aria-live="polite">{resultCount(res.data.total)}</h2>
            <p className="mt-1 flex flex-wrap gap-2 text-sm text-slate-700">
              {resolved.category ? <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">{D.filterCategory}: {resolved.category.name}</span> : null}
              {resolved.q ? <span className="rounded-full bg-slate-100 px-3 py-1">&ldquo;{resolved.q}&rdquo;</span> : null}
              {resolved.place ? <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">{D.filterPlace}: {resolved.place.label}</span> : resolved.where ? <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-800">{resolved.pincode ? D.filterPincode : D.filterPlace}: {resolved.where}</span> : null}
            </p>
            {res.data.locationUnknown ? <p role="status" className="mt-3 rounded-xl bg-gold-50 px-4 py-3 text-sm font-medium text-gold-900">{D.unknownPlace}</p> : null}
            {res.data.items.length > 0 ? (
              <>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {res.data.items.map((b) => (
                    <li key={b.slug} data-business-id={b.id ?? undefined}>
                      <BusinessCard b={{ name: b.name, profilePath: b.profilePath, category: b.category, place: b.place, description: b.description, claimed: b.claimed, verified: b.verified, sponsoredLabel: b.sponsored ? b.sponsoredLabel ?? D.sponsored : null, visitHref: b.siteUrl }} />
                    </li>
                  ))}
                </ul>
                <Pager result={res.data} input={input} action={l.search} />
              </>
            ) : (
              <div className="mt-6">
                <DirectoryEmpty title={D.noResultsTitle} body={D.noResultsBody} registerHref={l.main('/register')} claimHref={l.claim} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
