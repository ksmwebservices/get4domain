import { notFound } from 'next/navigation';
import { isV3PublicEnabled } from './flag';

/** First line of every new public page, layout and route handler: flag off means a real 404 and nothing else happens. */
export function assertV3Public(): void {
  if (!isV3PublicEnabled()) notFound();
}
