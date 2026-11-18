import Link from 'next/link';
import { basePathOf, pagePath } from '@/lib/v3-public/metadata';
import { windowOf } from '@/lib/v3-public/pagination';
import { S } from '@/lib/v3-public/strings';
import type { Pagination as PaginationModel } from '@/lib/v3-public/types';

/** Previous and next come from the model (prevPath, nextPath); the numbered links are /page/{n}. Nothing renders for a single page. */
export default function Pagination({ page, path }: { page: PaginationModel | null; path: string }) {
  if (!page || page.totalPages <= 1) return null;
  const base = basePathOf(path);
  const numbers = windowOf(page.number, page.totalPages);
  return (
    <nav aria-label={S.pagination.label} className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="min-w-[8rem]">{page.prevPath && <Link href={page.prevPath} rel="prev" className="font-semibold text-brand-700 hover:underline">{S.pagination.previous}</Link>}</div>
      <ol className="flex flex-wrap items-center gap-1" aria-label={S.pagination.pageOf(page.number, page.totalPages)}>
        {numbers.map((n) => (
          <li key={n}>
            {n === page.number ? (
              <span aria-current="page" aria-label={S.pagination.current(n)} className="inline-block rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white">{n}</span>
            ) : (
              <Link href={pagePath(base, n)} aria-label={S.pagination.goTo(n)} className="inline-block rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">{n}</Link>
            )}
          </li>
        ))}
      </ol>
      <div className="min-w-[8rem] text-right">{page.nextPath && <Link href={page.nextPath} rel="next" className="font-semibold text-brand-700 hover:underline">{S.pagination.next}</Link>}</div>
    </nav>
  );
}
