import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import IndustryMarketplace from '@/components/IndustryMarketplace';
import CTABanner from '@/components/CTABanner';

export const metadata: Metadata = {
  title: 'Industries — 20+ Business Solutions | Get4Domain',
  description: 'Get4Domain supports 20+ industries. Choose your industry to see a live demo, explore features and book your consultation.',
};

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Industry Solutions"
        title="Built for Your Business Type"
        description="Get4Domain supports 20+ industries. Each industry comes with purpose-built modules, templates and workflows — not a generic website builder."
        breadcrumbs={[{ label: 'Industries' }]}
      />
      <div className="pb-8">
        <IndustryMarketplace />
      </div>
      <CTABanner />
    </>
  );
}
