import { BadgeCheck, ExternalLink, MapPin, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { btn, CARD_HOVER, FOCUS } from '@/components/portal/ui';
import { PORTAL } from '@/lib/v3-public/portal-strings';

export interface BusinessCardData {
  name: string; profilePath: string; category: string | null; place: string | null; description: string | null;
  claimed: boolean; verified: boolean; sponsoredLabel: string | null;
  /** The address of the business site (its own subdomain), or null for a listing without a site. */
  visitHref: string | null;
}

/**
 * One business, as a card: the name (to its directory page), category, place, a short description, and two actions: Visit site (the business's own site) and View listing.
 * Never a phone number, email or street address. A sponsored card carries its label. One component for the directory pages and the search results.
 */
export default function BusinessCard({ b, headingLevel = 2 }: { b: BusinessCardData; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const D = PORTAL.directory;
  return (
    <article className={`${CARD_HOVER} flex h-full flex-col p-5`}>
      {b.sponsoredLabel ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-800">{b.sponsoredLabel}</p> : null}
      <Heading className="text-lg font-bold text-ink-900">
        <Link href={b.profilePath} className={`rounded hover:text-brand-700 hover:underline ${FOCUS}`}>{b.name}</Link>
      </Heading>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
        {b.category ? <span>{b.category}</span> : null}
        {b.place ? <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="h-3.5 w-3.5" />{b.place}</span> : null}
      </p>
      {b.description ? <p className="mt-2 line-clamp-3 text-sm text-slate-700">{b.description}</p> : null}
      {b.claimed || b.verified ? (
        <p className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          {b.claimed ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-brand-800"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />{D.claimed}</span> : null}
          {b.verified ? <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-success-800"><BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />{D.verified}</span> : null}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {b.visitHref ? (
          <a href={b.visitHref} rel="nofollow noopener" aria-label={`${D.visitSite}: ${b.name}`} className={btn('primary', true)}>{D.visitSite}<ExternalLink aria-hidden="true" className="h-4 w-4" /></a>
        ) : (
          <span className="text-sm text-slate-600">{D.listingOnly}</span>
        )}
        <Link href={b.profilePath} aria-label={`${D.viewListing}: ${b.name}`} className={btn('secondary', true)}>{D.viewListing}</Link>
      </div>
    </article>
  );
}
