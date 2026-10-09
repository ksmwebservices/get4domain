'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Landing pages became the LeadSpace page (Page tab). This address stays for at least 180 days and sends everyone to the new home. */
export default function LandingPageMovedPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/leadspace?tab=page'); }, [router]);
  return <div className="py-16 text-center text-sm text-slate-400">Landing pages are now your LeadSpace page. Taking you there...</div>;
}
