import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import FullBleed from '@/components/portal/FullBleed';
import { CONTAINER, FOCUS } from '@/components/portal/ui';
import { SITE } from '@/lib/v3-public/site-strings';

export interface Crumb { name: string; path: string }

/**
 * The light band at the top of the content pages (industries, categories, product, pricing and the rest): breadcrumbs, the one H1, a lead, buttons, and an optional picture on the right.
 * The breadcrumb trail is a real nav with the current page marked; the shell's skip link and the page's own landmarks are untouched.
 */
export default function PageHero({ crumbs, h1, lead, actions, aside, eyebrow }: { crumbs?: Crumb[]; h1: string; lead?: string; actions?: ReactNode; aside?: ReactNode; eyebrow?: string }) {
  return (
    <FullBleed className="-mt-8 overflow-hidden bg-gradient-to-br from-brand-50 via-white to-gold-50 pb-10 pt-8 sm:pb-14 sm:pt-10">
      <div className={`${CONTAINER} grid grid-cols-1 items-center gap-8 ${aside ? 'lg:grid-cols-[1.1fr_1fr]' : ''}`}>
        <div className="min-w-0">
          {crumbs && crumbs.length > 0 ? (
            <nav aria-label={SITE.crumbs.label} className="mb-4 text-sm text-slate-600">
              <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
                <li><Link href="/" className={`rounded hover:text-brand-700 hover:underline ${FOCUS}`}>{SITE.crumbs.home}</Link></li>
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <li key={c.path} className="flex items-center gap-1">
                      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
                      {last ? <span aria-current="page" className="font-medium text-ink-900">{c.name}</span> : <Link href={c.path} className={`rounded hover:text-brand-700 hover:underline ${FOCUS}`}>{c.name}</Link>}
                    </li>
                  );
                })}
              </ol>
            </nav>
          ) : null}
          {eyebrow ? <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{eyebrow}</p> : null}
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{h1}</h1>
          {lead ? <p className="mt-3 max-w-2xl text-base text-slate-700 sm:text-lg">{lead}</p> : null}
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </FullBleed>
  );
}
