'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Campaigns became LeadSpace. This address stays for at least 180 days and sends staff to the new console. */
export default function AdminCampaignsMovedPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/leadspace?tab=promotion'); }, [router]);
  return <div className="py-16 text-center text-sm text-slate-400">Campaigns are now part of LeadSpace. Taking you there...</div>;
}
