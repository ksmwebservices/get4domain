import { permanentRedirect } from 'next/navigation';
import LegacyCampaignPage from './LegacyCampaignPage';

const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

/**
 * Campaign landing pages became LeadSpace pages. The old address /go/<slug> keeps working: once the vendor has published their LeadSpace page at the same
 * address it redirects there permanently (kept for at least 180 days); until then the page the vendor's ads point at is served exactly as before.
 */
export default async function GoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let live = false;
  try {
    const res = await fetch(`${API}/leadspace/public/page/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    live = res.ok;
  } catch {
    live = false;
  }
  if (live) permanentRedirect(`/ls/${encodeURIComponent(slug)}`);
  return <LegacyCampaignPage />;
}
