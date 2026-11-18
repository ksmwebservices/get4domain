import Link from 'next/link';
import { CHIP } from '@/components/portal/ui';
import { searchQueryString, type Trees } from '@/lib/v3-public/portal-search';
import { PORTAL } from '@/lib/v3-public/portal-strings';

/**
 * Cities and categories as chips, from the two directory trees. Each chip is a real search (a city, or a category), so it works while the directory has no listings:
 * it opens the results page, which then says honestly that nothing is listed there yet. Nothing here is a count or a claim.
 */
export default function DirectoryBrowse({ trees, searchHref }: { trees: Trees | null; searchHref: string }) {
  const D = PORTAL.directory;
  const cities = (trees?.places ?? []).filter((p) => p.kind === 'CITY' || (p.kind === null && p.depth === 2)).slice(0, 80);
  const categories = (trees?.categories ?? []).slice(0, 60);
  return (
    <div className="space-y-10">
      <section aria-labelledby="browse-cities">
        <h2 id="browse-cities" className="text-xl font-bold text-ink-900">{D.browseCities}</h2>
        {cities.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {cities.map((p) => <li key={p.path}><Link href={`${searchHref}${searchQueryString({ where: p.name, l: p.path })}`} className={CHIP}>{p.name}</Link></li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-600">{D.citiesEmpty}</p>}
      </section>
      <section aria-labelledby="browse-cats">
        <h2 id="browse-cats" className="text-xl font-bold text-ink-900">{D.browseCategories}</h2>
        {categories.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => <li key={c.slug}><Link href={`${searchHref}${searchQueryString({ what: c.name, c: c.slug })}`} className={CHIP}>{c.name}</Link></li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-600">{D.categoriesEmpty}</p>}
      </section>
    </div>
  );
}
