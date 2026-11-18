import BusinessCard from '@/components/portal/BusinessCard';
import { goHref } from '@/lib/v3-public/click';
import type { Card } from '@/lib/v3-public/types';

/**
 * One listing of a directory page model, drawn with the portal card. "Visit site" goes through the click-out (so a visit is counted); a listing without a site is shown as listing only.
 * A card never shows a phone number, an email, a messaging link or a street address; the page model has none of those to show.
 */
export default function ListingCard({ card, headingLevel = 2, profilePrefix = '' }: { card: Card; headingLevel?: 2 | 3; profilePrefix?: string }) {
  return (
    <BusinessCard
      headingLevel={headingLevel}
      b={{
        name: card.name, profilePath: `${profilePrefix}${card.profilePath}`, category: card.category, place: card.locality, description: card.description,
        claimed: card.claimed, verified: card.verified, sponsoredLabel: null, visitHref: card.listingOnly ? null : goHref(card.visitUrl),
      }}
    />
  );
}
