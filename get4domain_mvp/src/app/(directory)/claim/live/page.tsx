import type { Metadata } from 'next';
import { LiveScreen } from '@/components/directory/ClaimScreens';
import { vendorAppUrl } from '@/lib/v3-public/config';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { safeRedirect } from '@/lib/v3-public/redirect';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = noindexMetadata(`${S.claim.live.title} | ${S.brand}`, S.claim.live.body);

type Props = { searchParams: Promise<{ redirectTo?: string | string[] }> };

/** The go-live notice. Approval happens in the business app; it sends the owner back here, optionally with ?redirectTo= (followed only when safe). */
export default async function ClaimLivePage({ searchParams }: Props) {
  const { redirectTo } = await searchParams;
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900">{S.claim.live.title}</h1>
      <div className="mt-6"><LiveScreen vendorUrl={vendorAppUrl()} redirectTo={safeRedirect(redirectTo)} /></div>
    </div>
  );
}
