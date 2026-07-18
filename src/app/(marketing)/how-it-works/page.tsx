import type { Metadata } from 'next';
import Link from 'next/link';
import { Rocket, ArrowRight } from 'lucide-react';
import PageHero from '@/components/PageHero';
import HowItWorks from '@/components/HowItWorks';
import CTABanner from '@/components/CTABanner';
import Button from '@/components/ui/Button';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'How It Works',
  description: 'From idea to live website in 24 hours. Our streamlined process gets your business online quickly and professionally.',
  path: '/how-it-works',
});

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How It Works"
        title="From Idea to Live Website in 24 Hours"
        description="Our streamlined process gets your business online quickly and professionally. No technical knowledge required."
        breadcrumbs={[{ label: 'How It Works' }]}
      >
        <Link href="/industries">
          <Button size="lg" leftIcon={<Rocket className="h-5 w-5" />} rightIcon={<ArrowRight className="h-4 w-4" />}>
            Get Started Now
          </Button>
        </Link>
      </PageHero>

      <HowItWorks />

      <section className="section-py">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Why Choose Get4Domain?</h2>
            <p className="mt-3 text-slate-600">We make going online simple, fast, and affordable</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {[
              { title: 'No Technical Knowledge', desc: 'You don\'t need to know coding or design. We handle everything for you.' },
              { title: 'Launch in 24 Hours', desc: 'From payment to live website, we deploy your business online within 24 hours.' },
              { title: 'Professional Design', desc: 'Industry-specific templates designed by professionals, customized with your brand.' },
              { title: 'All-Inclusive Package', desc: 'Domain, hosting, SSL, SEO, analytics — everything included in one price.' },
              { title: '30 Days Support', desc: 'Dedicated support for 30 days after launch to ensure everything runs smoothly.' },
              { title: 'Affordable Pricing', desc: 'Just ₹4,999 one-time. No recurring fees, no hidden costs, no surprises.' },
            ].map((item) => (
              <div key={item.title} className="card-base card-hover p-6">
                <h3 className="mb-2 text-base font-bold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
