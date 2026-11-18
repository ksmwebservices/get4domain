import type { Metadata } from 'next';
import Link from 'next/link';
import { assertV3Public } from '@/lib/v3-public/guard';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

// The flag is read when the request arrives, never when the app is built.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.referral.metaTitle, description: SITE.referral.metaDescription, path: '/referral-link', noindex: true });
}

/** The neutral page for a referral link that is unknown, disabled or could not be checked. No source details, and the code is not shown. */
export default function ReferralLinkPage() {
  assertV3Public();
  const R = SITE.referral;
  return (
    <section aria-labelledby="ref-title">
      <h1 id="ref-title" className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{R.invalidH1}</h1>
      <p className="mt-3 text-slate-700">{R.invalidBody}</p>
      <Link href="/register" className="mt-6 inline-block inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2">{R.cta}</Link>
    </section>
  );
}
