import type { Metadata } from 'next';
import { Target, MapPin, Phone, Mail, Calendar } from 'lucide-react';
import PageHero from '@/components/PageHero';
import CTABanner from '@/components/CTABanner';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'About Us',
  description: 'Get4Domain is built by KSM Quantum Technologies — your complete digital business partner for Indian SMBs.',
  path: '/about',
});

const facts = [
  { icon: Target, label: 'Mission', value: 'Your Complete Digital Business Partner for Indian SMBs' },
  { icon: Calendar, label: 'Founded', value: '2026' },
  { icon: MapPin, label: 'Address', value: 'Tidel Park, 1st Floor D Block, Tharamani, Chennai - 600113' },
  { icon: Phone, label: 'Phone', value: '+91 75500 47567' },
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
              Our two products — <strong className="text-slate-900">DomainApp</strong> (a complete business operating system: website, CRM, HR, accounting and invoicing) and <strong className="text-slate-900">DomainCampaign</strong> (managed digital marketing, run by our team on your behalf) — cover everything an SMB needs to launch, operate, and grow online.
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

      <CTABanner />
    </>
  );
}
