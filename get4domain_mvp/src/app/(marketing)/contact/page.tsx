import PageHero from '@/components/PageHero';
import Contact from '@/components/Contact';
import CTABanner from '@/components/CTABanner';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Contact Get4Domain — Chennai, Tamil Nadu',
  description: 'Get in touch with Get4Domain. Chat with our assistant or request a callback and our team will call you. Email: support@get4domain.com. Address: Tidel Park, Tharamani, Chennai.',
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
