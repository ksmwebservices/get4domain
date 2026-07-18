import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight, Image, Search, Globe, FileText, Megaphone, BarChart3, CalendarCheck } from 'lucide-react';
import PageHero from '@/components/PageHero';
import CTABanner from '@/components/CTABanner';
import Button from '@/components/ui/Button';
import { domainCampaignStarterFeatures, domainCampaignBusinessFeatures } from '@/data/content';

export const metadata: Metadata = {
  title: 'DomainCampaign — Managed Digital Marketing | Get4Domain',
  description: 'DomainCampaign is a fully managed digital marketing service. Our team runs your social media, SEO and campaigns — you track results from your dashboard.',
};

const services = [
  { icon: Image, title: 'Social Media Content', desc: 'Up to 120 custom posts per month — designed, captioned and posted by our team across Facebook, Instagram and LinkedIn.' },
  { icon: Search, title: 'SEO — Search Rankings', desc: 'Keyword research, on-page SEO, off-page link building and monthly ranking reports. Up to 10 keywords per month.' },
  { icon: Globe, title: 'Google Business Profile', desc: 'Full GBP setup, verification, monthly updates, review management and local SEO optimization.' },
  { icon: Megaphone, title: 'Poster Designs', desc: 'Up to 150 custom poster designs per month — festival posters, offer posters, product launches and promotional creatives.' },
  { icon: FileText, title: 'Blog Articles', desc: 'Up to 10 SEO-optimized blog articles per month written by our content team for your industry and keywords.' },
  { icon: BarChart3, title: 'Monthly Reports', desc: 'Detailed campaign performance reports with reach, engagement, lead count, SEO positions and action recommendations.' },
];

export default function DomainCampaignPage() {
  return (
    <>
      <PageHero
        eyebrow="DomainCampaign"
        title="Managed Digital Marketing — We Run It For You"
        description="Your social media, SEO, content and campaigns handled by our expert team. You focus on your business — we grow your online presence."
        breadcrumbs={[{ label: 'DomainCampaign' }]}
      />

      {/* What we do */}
      <section className="section-py">
        <div className="container-mx container-px">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary-600 mb-2">What We Do</p>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Our Team Runs Your Digital Marketing</h2>
            <p className="mt-3 text-slate-600 max-w-xl mx-auto">DomainCampaign is not a DIY tool. It is a fully managed service — our team creates, posts, optimizes and reports. You approve the direction and track results.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <div key={svc.title} className="card-base p-6 group card-hover">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-50 group-hover:bg-secondary-100 transition-colors">
                    <Icon className="h-5 w-5 text-secondary-600" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-slate-900">{svc.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{svc.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="section-py bg-slate-50">
        <div className="container-mx container-px">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary-600 mb-2">Plans</p>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">DomainCampaign Plans</h2>
            <p className="mt-3 text-slate-600">Both plans are fully managed — no tools to learn, no platform to manage.</p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
            {/* Starter */}
            <div className="card-base p-8">
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary-50 px-3 py-1 mb-3">
                  <Megaphone className="h-3.5 w-3.5 text-secondary-600" />
                  <span className="text-xs font-semibold text-secondary-700">Starter</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">Campaign Starter</h3>
                <p className="text-sm text-slate-500 mt-1">For businesses beginning their digital marketing journey.</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">₹6,999</span>
                  <span className="text-slate-400 mb-1">/ year</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">or ₹3,999 for 6 months</p>
              </div>
              <ul className="space-y-2.5 mb-8">
                {domainCampaignStarterFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-success-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/book-demo">
                <Button variant="outline" fullWidth leftIcon={<CalendarCheck className="h-4 w-4" />}>Book Demo</Button>
              </Link>
            </div>

            {/* Business */}
            <div className="relative card-base border-2 border-secondary-400 p-8 shadow-premium overflow-hidden">
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-secondary-600 to-secondary-500 py-1.5 text-center">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Best for Growth</span>
              </div>
              <div className="mt-5 mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary-50 px-3 py-1 mb-3">
                  <Megaphone className="h-3.5 w-3.5 text-secondary-600" />
                  <span className="text-xs font-semibold text-secondary-700">Business</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">Campaign Business</h3>
                <p className="text-sm text-slate-500 mt-1">Full-scale managed marketing for serious business growth.</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">₹29,999</span>
                  <span className="text-slate-400 mb-1">/ year</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">or ₹16,999 for 6 months</p>
              </div>
              <ul className="space-y-2.5 mb-8">
                {domainCampaignBusinessFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-success-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/book-demo">
                <Button fullWidth className="bg-secondary-600 hover:bg-secondary-700" leftIcon={<CalendarCheck className="h-4 w-4" />}>
                  Book Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How managed service works */}
      <section className="section-py">
        <div className="container-mx container-px">
          <div className="mx-auto max-w-3xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold text-slate-900">How Managed Service Works</h2>
              <p className="mt-3 text-slate-600">No platform to learn. No tools to manage. Just results.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { step: '1', title: 'You Share Brand Assets', desc: 'Logo, brand colours, product photos and key messaging. One-time onboarding.' },
                { step: '2', title: 'We Create the Content', desc: 'Our team designs, writes and schedules everything — posts, blogs, posters.' },
                { step: '3', title: 'You Approve (Optional)', desc: 'Review content before it goes live. Or auto-approve for faster publishing.' },
                { step: '4', title: 'We Post & Report', desc: 'Content goes live on schedule. You get monthly reports with all metrics.' },
              ].map((item) => (
                <div key={item.step} className="card-base p-5 flex gap-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-secondary-600 text-sm font-bold text-white">{item.step}</div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 mb-1">{item.title}</div>
                    <div className="text-xs text-slate-500 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
