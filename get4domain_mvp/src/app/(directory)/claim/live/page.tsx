import type { Metadata } from 'next';
import { LiveScreen } from '@/components/directory/ClaimScreens';
import { vendorAppUrl } from '@/lib/v3-public/config';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = noindexMetadata(`${S.claim.live.title} | ${S.brand}`, S.claim.live.body);

/** The go-live notice. Approval happens in the business app; it can send the owner back here. */
export default function ClaimLivePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900">{S.claim.live.title}</h1>
      <div className="mt-6"><LiveScreen vendorUrl={vendorAppUrl()} /></div>
    </div>
  );
}
