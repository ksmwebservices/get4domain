import type { Metadata } from 'next';
import Hero from '@/components/Hero';
import TrustBar from '@/components/TrustBar';
import IndustryMarketplace from '@/components/IndustryMarketplace';
import HowItWorks from '@/components/HowItWorks';
import FAQ from '@/components/FAQ';
import CTABanner from '@/components/CTABanner';
import SectionLink from '@/components/SectionLink';
import ProductsOverview from '@/components/ProductsOverview';

export const metadata: Metadata = {
  title: 'Get4Domain — Digital Business Platform for Indian SMBs | Website + BOS + Campaigns',
  description:
    "Get4Domain gives Indian SMBs a complete digital platform — professional websites, business management software and managed digital marketing. Starting ₹999.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />

      <ProductsOverview />

      <div className="section-py">
        <IndustryMarketplace limit={8} />
        <SectionLink to="/industries" label="View All 20+ Industries" />
      </div>

      <HowItWorks />

      <div className="section-py">
        <FAQ limit={5} />
        <SectionLink to="/support" label="View All FAQs" />
      </div>

      <CTABanner />
    </>
  );
}
