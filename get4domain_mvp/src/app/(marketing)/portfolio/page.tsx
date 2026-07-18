import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import Portfolio from '@/components/Portfolio';
import Testimonials from '@/components/Testimonials';
import CTABanner from '@/components/CTABanner';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Portfolio',
  description: "Real businesses across India that went live with Get4Domain. See the quality for yourself.",
  path: '/portfolio',
});

export default function PortfolioPage() {
  return (
    <>
      <PageHero
        eyebrow="Portfolio"
        title="Websites We've Launched"
        description="Real businesses across India that went live with Get4Domain. See the quality for yourself."
        breadcrumbs={[{ label: 'Portfolio' }]}
      />
      <Portfolio />
      <Testimonials />
      <CTABanner />
    </>
  );
}
