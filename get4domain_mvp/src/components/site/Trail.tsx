import Link from 'next/link';
import JsonLd from '@/components/directory/JsonLd';
import { breadcrumbLd } from '@/lib/v3-public/site-jsonld';
import { SITE } from '@/lib/v3-public/site-strings';

export interface TrailItem { name: string; path: string }

/**
 * Visible breadcrumbs for a page more than one level deep, plus their BreadcrumbList JSON-LD (left out when the main host is not set: no address is guessed).
 * `items` are the levels after Home; the last one is the current page.
 */
export default function Trail({ items }: { items: readonly TrailItem[] }) {
  const ld = breadcrumbLd([{ name: SITE.crumbs.home, path: '/' }, ...items]);
  return (
    <>
      {ld ? <JsonLd items={[ld]} /> : null}
      <nav aria-label={SITE.crumbs.label} className="mb-4 text-sm text-slate-600">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/" className="hover:underline">{SITE.crumbs.home}</Link></li>
          {items.map((it, i) => (
            <li key={it.path} className="flex gap-2">
              <span aria-hidden="true">/</span>
              {i === items.length - 1 ? <span aria-current="page">{it.name}</span> : <Link href={it.path} className="hover:underline">{it.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
