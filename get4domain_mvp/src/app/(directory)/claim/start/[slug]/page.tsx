import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ClaimStartButton from '@/components/directory/ClaimStartButton';
import { ListingStateScreen } from '@/components/directory/ClaimScreens';
import { fetchListing } from '@/lib/v3-public/api';
import { canClaim } from '@/lib/v3-public/claim';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = noindexMetadata(`${S.claim.start.title} | ${S.brand}`, S.claim.intro);

type Props = { params: Promise<{ slug: string }> };

/** The listing the visitor chose, with the screen for its state: only an unclaimed listing can start a claim. */
export default async function ClaimStartPage({ params }: Props) {
  const { slug } = await params;
  const r = await fetchListing(slug);
  if (r.kind === 'notFound' || r.kind === 'gone') notFound();
  if (r.kind === 'error') {
    return <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{S.errors.generic}</p>;
  }
  const b = r.data;
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900">{S.claim.start.title}</h1>
      <section aria-labelledby="listing-title" className="mt-4 rounded-xl border border-slate-200 p-4">
        <h2 id="listing-title" className="text-sm font-medium text-slate-600">{S.claim.start.listing}</h2>
        <p className="mt-1 text-lg font-semibold text-slate-900">{b.name}</p>
        <p className="text-sm text-slate-600">{[b.category, b.place].filter(Boolean).join(' · ')}</p>
      </section>
      <div className="mt-6"><ListingStateScreen state={b.state} /></div>
      <div className="mt-6">
        {canClaim(b.state) ? <ClaimStartButton slug={b.slug} /> : null}
        <p className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href={`/business/${encodeURIComponent(b.slug)}`} className="text-primary-700 hover:underline">{S.claim.start.viewListing}</Link>
          <Link href="/claim" className="text-primary-700 hover:underline">{S.claim.start.back}</Link>
        </p>
      </div>
    </div>
  );
}
