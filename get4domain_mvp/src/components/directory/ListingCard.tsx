import Link from 'next/link';
import { goHref } from '@/lib/v3-public/click';
import { S } from '@/lib/v3-public/strings';
import type { Card } from '@/lib/v3-public/types';

/**
 * One listing: name (to the profile page), category, locality, a short description and exactly one action, "Visit site", which goes through the click-out.
 * A card never shows a phone number, an email, a messaging link or a street address; the page model has none of those to show.
 */
export default function ListingCard({ card, headingLevel = 2 }: { card: Card; headingLevel?: 2 | 3 }) {
  const href = card.listingOnly ? null : goHref(card.visitUrl);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <Heading className="text-lg font-semibold text-slate-900">
        <Link href={card.profilePath} className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600">{card.name}</Link>
      </Heading>
      <p className="mt-1 text-sm text-slate-600">{[card.category, card.locality ? S.card.inLocality(card.locality) : null].filter(Boolean).join(' ')}</p>
      {card.description && <p className="mt-2 text-sm text-slate-700">{card.description}</p>}
      {(card.claimed || card.verified) && (
        <p className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
          {card.claimed && <span className="rounded-full bg-slate-100 px-2 py-0.5">{S.card.claimed}</span>}
          {card.verified && <span className="rounded-full bg-slate-100 px-2 py-0.5">{S.card.verified}</span>}
        </p>
      )}
      <div className="mt-3">
        {href ? (
          <a
            href={href}
            rel="nofollow noopener"
            aria-label={S.card.visitFor(card.name)}
            className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            {S.card.visit}
          </a>
        ) : (
          <span className="text-sm text-slate-500">{S.card.listingOnly}</span>
        )}
      </div>
    </article>
  );
}
