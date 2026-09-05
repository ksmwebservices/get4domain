import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEngineIndustry, renderKitTemplate } from '@/engine/registry';
import { SAMPLE_TEMPLATES } from '@/engine/kit/templates';
import type { EngineSiteData } from '@/engine/types';

/**
 * Public engine preview: renders a bespoke industry website from premium seed
 * content, with no live vendor required. This is how a prospective vendor (or the
 * team) sees exactly what the engine generates for an industry before signing up.
 * Submissions are simulated (preview=true) so no real leads are written.
 *
 * `?template=<id>` renders a data-driven template (Phase-1 seed library) instead of the
 * built-in industry builder — proving a vendor can switch designs with no redeploy.
 */
export const dynamic = 'force-dynamic';

const DEMO_SITE = (industry: string): EngineSiteData => ({
  // Empty vendor/CMS → the industry builder fills EVERYTHING from its reference blueprint,
  // incl. the reference demo business name (CareWell Clinic, PrimeNest Realty, …).
  vendor: { id: '__preview__', businessName: '', industry, subdomain: '__preview__' },
  cms: null,
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

export default async function EnginePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ industry: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { industry } = await params;
  const { template } = await searchParams;

  // Data-driven template preview: render a seed-library template with preview content.
  if (template) {
    const tpl = SAMPLE_TEMPLATES[template];
    if (!tpl) notFound();
    return <>{renderKitTemplate(tpl, DEMO_SITE(tpl.industry ?? industry), { kind: 'preview' })}</>;
  }

  const entry = getEngineIndustry(industry);
  if (!entry) notFound();
  return <>{entry.render(DEMO_SITE(industry), { kind: 'preview' })}</>;
}
