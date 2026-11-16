import type { Metadata } from 'next';
import ClaimWizard from '@/components/directory/ClaimWizard';
import { InvalidLinkScreen } from '@/components/directory/ClaimScreens';
import { fetchClaimStatus } from '@/lib/v3-public/api';
import { vendorAppUrl } from '@/lib/v3-public/config';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

// The token is in the address, so it must never travel in a Referer header and the page must never be indexed.
export const metadata: Metadata = { ...noindexMetadata(`${S.claim.title} | ${S.brand}`, S.claim.intro), referrer: 'no-referrer' };

type Props = { params: Promise<{ token: string }> };

/** A claim link: while it is valid, the steps to claim; for every other case, the same "not valid" screen (the API gives no hint which). */
export default async function ClaimLinkPage({ params }: Props) {
  const { token } = await params;
  const r = await fetchClaimStatus(token);
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900">{r.kind === 'ok' ? S.claim.link.statusFor(r.data.businessName) : S.claim.title}</h1>
      <div className="mt-6">
        {r.kind === 'ok' ? (
          <ClaimWizard token={token} businessName={r.data.businessName} vendorUrl={vendorAppUrl()} />
        ) : r.kind === 'error' ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{S.errors.generic}</p>
        ) : (
          <InvalidLinkScreen />
        )}
      </div>
    </div>
  );
}
