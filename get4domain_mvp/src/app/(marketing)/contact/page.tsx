import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import Contact from '@/components/Contact';
import CTABanner from '@/components/CTABanner';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Contact',
  description: 'Have questions? Our sales and support teams are ready to help you launch your business online.',
  path: '/contact',
});

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
