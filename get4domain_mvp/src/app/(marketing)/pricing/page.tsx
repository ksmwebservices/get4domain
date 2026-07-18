import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, CalendarCheck, Globe, Megaphone } from 'lucide-react';
import PageHero from '@/components/PageHero';
import CTABanner from '@/components/CTABanner';
import Button from '@/components/ui/Button';
import { domainAppStartupFeatures, domainAppEnterpriseFeatures, domainCampaignStarterFeatures, domainCampaignBusinessFeatures } from '@/data/content';

export const metadata: Metadata = {
  title: 'Pricing — DomainApp & DomainCampaign | Get4Domain',
  description: 'Transparent pricing for DomainApp and DomainCampaign. Book a demo to get a custom quote for your business.',
};

const plans = [
  {
    product: 'DomainApp',
    icon: Globe,
    accentClass: 'from-primary-600 to-primary-500',
    badgeColor: 'bg-primary-600',
    borderColor: 'border-primary-400',
    tiers: [
      {
        name: 'Startup',
        yearPrice: '₹6,999',
        halfYearPrice: '₹3,999',
        features: domainAppStartupFeatures,
        popular: false,
        cta: 'Book Demo — Startup',
      },
      {
        name: 'Enterprise',
        yearPrice: '₹24,999',
        halfYearPrice: '₹13,999',
        features: domainAppEnterpriseFeatures,
        popular: true,
        cta: 'Book Demo — Enterprise',
      },
    ],
  },
  {
    product: 'DomainCampaign',
    icon: Megaphone,
    accentClass: 'from-secondary-600 to-secondary-500',
    badgeColor: 'bg-secondary-600',
    borderColor: 'border-secondary-400',
    tiers: [
      {
        name: 'Starter',
        yearPrice: '₹6,999',
        halfYearPrice: '₹3,999',
        features: domainCampaignStarterFeatures,
        popular: false,
        cta: 'Book Demo — Starter',
      },
      {
        name: 'Business',
        yearPrice: '₹29,999',
        halfYearPrice: '₹16,999',
        features: domainCampaignBusinessFeatures,
        popular: true,
        cta: 'Book Demo — Business',
      },
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple, Transparent Pricing"
        description="All plans are subscription-based. Book a demo first — our consultant will recommend the right plan for your business and answer all pricing questions."
        breadcrumbs={[{ label: 'Pricing' }]}
      />

      {/* Info banner */}
      <section className="py-6 bg-primary-50 border-y border-primary-100">
        <div className="container-mx container-px text-center">
          <p className="text-sm text-primary-800">
            <strong>How it works:</strong> Book a free demo → Our team builds your platform → Pay securely via Razorpay from your dashboard → Go live.
          </p>
        </div>
      </section>

      {plans.map((product) => {
        const Icon = product.icon;
        return (
          <section key={product.product} className="section-py">
            <div className="container-mx container-px">
              <div className="mb-10 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${product.accentClass}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{product.product}</h2>
              </div>
              <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
                {product.tiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`relative card-base overflow-hidden p-8 ${tier.popular ? `border-2 ${product.borderColor} shadow-premium` : ''}`}
                  >
                    {tier.popular && (
                      <div className={`absolute top-0 left-0 right-0 bg-gradient-to-r ${product.accentClass} py-1.5 text-center`}>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Most Popular</span>
                      </div>
                    )}
                    <div className={tier.popular ? 'mt-5' : ''}>
                      <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                      <div className="mt-4 space-y-1">
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold text-slate-900">{tier.yearPrice}</span>
                          <span className="text-slate-400 mb-1">/ year</span>
                        </div>
                        <p className="text-xs text-slate-400">or {tier.halfYearPrice} for 6 months</p>
                      </div>
                      <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                        ✓ GST invoice provided after payment via Razorpay
                      </p>
                    </div>
                    <ul className="mt-6 space-y-2.5 mb-8">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <Check className="h-4 w-4 text-success-500 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/book-demo">
                      <Button
                        fullWidth
                        variant={tier.popular ? 'primary' : 'outline'}
                        leftIcon={<CalendarCheck className="h-4 w-4" />}
                      >
                        {tier.cta}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Comparison note */}
      <section className="pb-16">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Can I combine DomainApp + DomainCampaign?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Yes. Many clients run DomainApp for their business platform and DomainCampaign for their digital marketing. You manage everything from one Get4Domain dashboard. Book a demo and we will design the right combination for your business goals.
            </p>
            <div className="mt-6">
              <Link href="/book-demo">
                <Button leftIcon={<CalendarCheck className="h-4 w-4" />}>Book a Free Demo</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
