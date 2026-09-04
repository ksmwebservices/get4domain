import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEngineIndustry } from '@/engine/registry';
import type { EngineSiteData } from '@/engine/types';

/**
 * Public engine preview: renders a bespoke industry website from premium seed
 * content, with no live vendor required. This is how a prospective vendor (or the
 * team) sees exactly what the engine generates for an industry before signing up.
 * Submissions are simulated (preview=true) so no real leads are written.
 */
export const dynamic = 'force-static';

const DEMO_SITE = (industry: string, label: string): EngineSiteData => ({
  vendor: { id: '__preview__', businessName: `${label} — Demo`, industry, subdomain: '__preview__' },
  cms: null, // null CMS → the industry model fills entirely from premium seed content
  products: [],
});

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }): Promise<Metadata> {
  const { industry } = await params;
  const entry = getEngineIndustry(industry);
  if (!entry) return { title: 'Preview not found' };
  return {
    title: `${entry.config.label} website — Get4Domain engine preview`,
    description: `A live preview of the bespoke ${entry.config.label} website the Get4Domain Industry Website Engine generates.`,
    robots: { index: false },
  };
}

export default async function EnginePreviewPage({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params;
  const entry = getEngineIndustry(industry);
  if (!entry) notFound();
  const EngineSite = entry.Site;
  return <EngineSite site={DEMO_SITE(industry, entry.config.label)} subdomain="__preview__" preview />;
}
