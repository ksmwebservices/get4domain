import PageHero from '@/components/PageHero';
import Contact from '@/components/Contact';
import CTABanner from '@/components/CTABanner';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Contact Get4Domain — Chennai, Tamil Nadu',
  description: 'Contact Get4Domain: chat with our assistant or request a callback. Email support@get4domain.com. Tidel Park, Tharamani, Chennai.',
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
