import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import Contact from '@/components/Contact';
import CTABanner from '@/components/CTABanner';

export const metadata: Metadata = {
  title: 'Contact Get4Domain — Chennai, Tamil Nadu | +91 75500 47567',
  description: 'Contact Get4Domain team. Phone: +91 75500 47567. Email: support@get4domain.com. Address: Tidel Park, Tharamani, Chennai.',
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        title="Get in Touch"
        description="Have questions? Our sales and support teams are ready to help you launch your business online."
        breadcrumbs={[{ label: 'Contact' }]}
      />
      <Contact />
      <CTABanner />
    </>
  );
}
