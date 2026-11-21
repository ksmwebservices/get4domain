import { Building2, SearchCheck } from 'lucide-react';
import Link from 'next/link';
import { btn, CARD } from '@/components/portal/ui';
import { PORTAL } from '@/lib/v3-public/portal-strings';

/**
 * The honest empty state of the directory: no invented businesses. It says the directory is new and offers the two things a visitor can do about it: list a business, or claim a listing.
 */
export default function DirectoryEmpty({ title, body, registerHref, claimHref }: { title: string; body: string; registerHref: string; claimHref: string }) {
  const D = PORTAL.directory;
  return (
    <section aria-labelledby="dir-empty-title" className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="dir-empty-title" className="text-xl font-bold text-ink-900">{title}</h2>
        <p className="mt-2 text-slate-700">{body}</p>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <Building2 aria-hidden="true" className="h-6 w-6 text-brand-700" />
          <h3 className="mt-3 font-bold text-ink-900">{D.emptyListTitle}</h3>
          <p className="mt-1 text-sm text-slate-700">{D.emptyListBody}</p>
          <Link href={registerHref} className={`${btn('primary', true)} mt-4`}>{PORTAL.nav.list}</Link>
        </div>
        <div className={`${CARD} p-5`}>
          <SearchCheck aria-hidden="true" className="h-6 w-6 text-brand-700" />
          <h3 className="mt-3 font-bold text-ink-900">{D.claimTitle}</h3>
          <p className="mt-1 text-sm text-slate-700">{D.claimBody}</p>
          <Link href={claimHref} className={`${btn('secondary', true)} mt-4`}>{PORTAL.nav.claim}</Link>
        </div>
      </div>
    </section>
  );
}
