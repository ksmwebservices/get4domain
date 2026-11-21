import type { Metadata } from 'next';
import Link from 'next/link';
import { searchBusinesses } from '@/lib/v3-public/api';
import { canClaim } from '@/lib/v3-public/claim';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = noindexMetadata(`${S.claim.title} | ${S.brand}`, S.claim.intro);

type Props = { searchParams: Promise<{ name?: string; city?: string; business?: string }> };

/** Step one of the claim: find the business by name and city. A plain GET form, so it works without scripts; the search runs on the server. */
export default async function ClaimFindPage({ searchParams }: Props) {
  const q = await searchParams;
  const name = (q.name ?? q.business?.replace(/-/g, ' ') ?? '').slice(0, 120);
  const city = (q.city ?? '').slice(0, 80);
  const searched = Boolean(name.trim() || city.trim());
  const r = searched ? await searchBusinesses(name, city) : null;
  const items = r && r.kind === 'ok' ? r.data : [];
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900">{S.claim.title}</h1>
      <p className="mt-3 text-slate-700">{S.claim.intro}</p>

      <form method="get" action="/claim" className="mt-6 grid gap-4 sm:grid-cols-2" role="search" aria-label={S.claim.find.title}>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-900">{S.claim.find.nameLabel}</label>
          <input id="name" name="name" defaultValue={name} maxLength={120} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-slate-900">{S.claim.find.cityLabel}</label>
          <input id="city" name="city" defaultValue={city} maxLength={80} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{S.claim.find.submit}</button>
        </div>
      </form>

      {r && r.kind === 'error' && <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{S.errors.generic}</p>}
      {searched && r && r.kind === 'ok' && items.length === 0 && <p className="mt-6 text-sm text-slate-700">{S.claim.find.none}</p>}
      {items.length > 0 && (
        <section aria-label={S.claim.find.resultsLabel} className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">{S.claim.find.resultsLabel}</h2>
          <ul className="mt-3 space-y-3">
            {items.map((b) => (
              <li key={b.slug} className="rounded-xl border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{b.name}</p>
                <p className="text-sm text-slate-600">{[b.category, b.place].filter(Boolean).join(' · ')}</p>
                <p className="mt-2 text-sm">
                  {canClaim(b.state) ? (
                    <Link href={`/claim/start/${encodeURIComponent(b.slug)}`} className="font-medium text-primary-700 hover:underline">{S.claim.find.choose}</Link>
                  ) : (
                    <Link href={`/claim/start/${encodeURIComponent(b.slug)}`} className="text-slate-600 hover:underline">{S.claim.find.alreadyClaimed}</Link>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
