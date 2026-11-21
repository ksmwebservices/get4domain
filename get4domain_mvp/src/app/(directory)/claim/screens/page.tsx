import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApprovalScreen, InvalidLinkScreen, ListingStateScreen, LiveScreen, MailOffScreen, StartUnavailableScreen } from '@/components/directory/ClaimScreens';
import { useMocks } from '@/lib/v3-public/flag';
import { vendorAppUrl } from '@/lib/v3-public/config';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';
import type { ListingState } from '@/lib/v3-public/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = noindexMetadata(`${S.claim.preview.title} | ${S.brand}`, S.claim.preview.note);

const STATES: ListingState[] = ['UNCLAIMED_LISTING', 'DRAFT_SITE', 'CLAIMED', 'LIVE'];

/** Every static screen of the claim flow on one page, for review. Only while sample data is on. */
export default function ClaimScreensPage() {
  if (!useMocks()) notFound();
  const v = vendorAppUrl();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">{S.claim.preview.title}</h1>
      <p className="text-sm text-slate-600">{S.claim.preview.note}</p>
      {STATES.map((s) => <ListingStateScreen key={s} state={s} />)}
      <InvalidLinkScreen />
      <MailOffScreen />
      <StartUnavailableScreen />
      <ApprovalScreen vendorUrl={v} />
      <LiveScreen vendorUrl={v} />
    </div>
  );
}
