'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Campaigns became LeadSpace (Promote tab). This address stays for at least 180 days and sends everyone to the new home; nothing the vendor made was deleted. */
export default function CampaignsMovedPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/leadspace?tab=promote'); }, [router]);
  return <div className="py-16 text-center text-sm text-slate-400">Campaigns are now part of LeadSpace. Taking you there...</div>;
}
