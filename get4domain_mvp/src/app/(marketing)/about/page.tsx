import type { Metadata } from 'next';
import { Target, MapPin, Mail, Calendar, UserRound } from 'lucide-react';
import PageHero from '@/components/PageHero';
import CTABanner from '@/components/CTABanner';
import Faq from '@/components/marketing/Faq';
import { createPageMetadata } from '@/lib/metadata';

// Page-specific FAQ (company/trust questions — distinct from home, pricing & features).
const ABOUT_FAQ = [
  { q: 'Who builds and operates Get4Domain?', a: 'Get4Domain is built and operated by KSM Quantum Technologies, based in Chennai, India. It is a managed SaaS platform — we host, deploy and maintain everything, so you do not manage servers, code or updates.' },
  { q: 'Where is Get4Domain based?', a: 'Chennai, Tamil Nadu, India (Tidel Park, Tharamani). Our support team assists in English and Tamil, Monday to Saturday, 9am–8pm.' },
  { q: 'Is Get4Domain only for Indian businesses?', a: 'It is purpose-built for Indian SMBs — GST-compliant invoicing, INR pricing and WhatsApp-first communication — so it fits Indian businesses best.' },
  { q: 'Is it a website builder or a done-for-you service?', a: 'Done-for-you. Our team deploys your site on a ready-made industry template and customizes the content and theme within 24 hours — you get a ready-to-use website and Workplace, not a drag-and-drop builder.' },
];

export const metadata: Metadata = createPageMetadata({
  title: 'About Us',
  description: 'Get4Domain is built by KSM Quantum Technologies — founded in Chennai in 2015 by K.S. Murugavel. Your complete digital business partner for Indian SMBs.',
  path: '/about',
});

const facts = [
  { icon: Target, label: 'Mission', value: 'Your Complete Digital Business Partner for Indian SMBs' },
  { icon: UserRound, label: 'Founder', value: 'K.S. Murugavel' },
  { icon: Calendar, label: 'Founded', value: '2015, in Chennai' },
  { icon: MapPin, label: 'Address', value: 'Tidel Park, 1st Floor D Block, Tharamani, Chennai - 600113' },
  { icon: Mail, label: 'Email', value: 'support@get4domain.com' },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Us"
        title="Building India's Digital Business Platform"
        description="Get4Domain is built by KSM Quantum Technologies to give Indian SMBs a complete digital presence — a professional website, business management tools, and managed marketing, all in one platform."
        breadcrumbs={[{ label: 'About Us' }]}
      />

      <section className="pb-16">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-3xl space-y-6 text-sm leading-relaxed text-slate-600">
            <p>
              <strong className="text-slate-900">KSM Quantum Technologies</strong> is the company behind Get4Domain — a SaaS platform purpose-built for small and medium businesses across India. We believe every business, regardless of size, deserves a professional online presence and the tools to run and grow it, without needing an in-house tech team.
            </p>
            <p>
              Our product — <strong className="text-slate-900">DomainApp</strong> (₹999/month, everything included) — gives an SMB a professional industry website, a business workspace (CRM, invoicing, contacts, records), built-in campaigns and an AI Studio, all in one platform to launch, operate and grow online.
            </p>
            <p>
              Get4Domain is built on more than a decade of experience. The company was founded in <strong className="text-slate-900">Chennai in 2015</strong> by <strong className="text-slate-900">K.S. Murugavel</strong>, a computer graduate, as <strong className="text-slate-900">KSM Web Services</strong> — helping local businesses get online. As the focus shifted toward AI and product innovation, it was renamed <strong className="text-slate-900">KSM Quantum Technologies</strong>. Since 2015 we&apos;ve worked with businesses across India, and that experience is distilled into Get4Domain today.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
            {facts.map((fact) => {
              const Icon = fact.icon;
              return (
                <div key={fact.label} className="card-base p-5 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50">
                    <Icon className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{fact.label}</p>
                    <p className="text-sm font-semibold text-slate-900">{fact.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Faq items={ABOUT_FAQ} subtitle="About the company behind Get4Domain." />

      <CTABanner />
    </>
  );
}
