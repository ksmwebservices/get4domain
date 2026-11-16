import Link from 'next/link';
import { S } from '@/lib/v3-public/strings';
import type { Crumb } from '@/lib/v3-public/types';

/** The breadcrumbs of the page model as given; the last one is the current page and is not a link. */
export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label={S.crumbs.label} className="mb-4 text-sm text-slate-600">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.path}-${i}`} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="font-medium text-slate-900">{c.name}</span>
              ) : (
                <Link href={c.path} className="underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600">{c.name}</Link>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
