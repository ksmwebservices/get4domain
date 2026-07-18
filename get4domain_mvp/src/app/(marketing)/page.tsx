import type { Metadata } from 'next';
import Hero from '@/components/Hero';
import TrustBar from '@/components/TrustBar';
import IndustryMarketplace from '@/components/IndustryMarketplace';
import HowItWorks from '@/components/HowItWorks';
import Portfolio from '@/components/Portfolio';
import Testimonials from '@/components/Testimonials';
import FAQ from '@/components/FAQ';
import CTABanner from '@/components/CTABanner';
import SectionLink from '@/components/SectionLink';
import ProductsOverview from '@/components/ProductsOverview';

export const metadata: Metadata = {
  title: 'Get4Domain — Professional Business Launch Made Easy',
  description:
    "India's SaaS platform for professional business websites, digital marketing and business management. DomainApp + DomainCampaign for Indian SMBs.",
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
        <Portfolio limit={4} />
        <SectionLink to="/portfolio" label="View Full Portfolio" />
      </div>

      <div className="section-py bg-gradient-to-b from-white to-slate-50">
        <Testimonials limit={3} />
      </div>

      <div className="section-py">
        <FAQ limit={5} />
        <SectionLink to="/support" label="View All FAQs" />
      </div>

      <CTABanner />
    </>
  );
}
