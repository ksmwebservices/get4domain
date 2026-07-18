import Link from 'next/link';
import { Megaphone, Check, ArrowRight, CalendarCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import { domainCampaignBusinessFeatures, domainCampaignStarterFeatures } from '@/data/content';

export default function DomainCampaignDashboardPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My DomainCampaign</h2>
        <p className="mt-1 text-sm text-slate-500">Managed digital marketing for your business.</p>
      </div>

      {/* Not subscribed state */}
      <div className="rounded-2xl border-2 border-dashed border-secondary-300 bg-secondary-50/30 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-100">
          <Megaphone className="h-8 w-8 text-secondary-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">DomainCampaign Not Active</h3>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Add DomainCampaign to have our team run your social media, SEO and digital marketing — fully managed, no effort from your side.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 text-left">
          {/* Starter */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h4 className="text-base font-bold text-slate-900 mb-1">Starter</h4>
            <div className="text-2xl font-bold text-slate-900 mb-3">₹6,999 <span className="text-sm font-normal text-slate-400">/yr</span></div>
            <ul className="space-y-1.5 mb-4">
              {domainCampaignStarterFeatures.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                  <Check className="h-3.5 w-3.5 text-success-500 mt-0.5 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/billing">
              <Button size="sm" variant="outline" fullWidth>Add Starter</Button>
            </Link>
          </div>

          {/* Business */}
          <div className="rounded-xl border-2 border-secondary-400 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-base font-bold text-slate-900">Business</h4>
              <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-bold text-secondary-700">Popular</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-3">₹29,999 <span className="text-sm font-normal text-slate-400">/yr</span></div>
            <ul className="space-y-1.5 mb-4">
              {domainCampaignBusinessFeatures.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                  <Check className="h-3.5 w-3.5 text-success-500 mt-0.5 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/billing">
              <Button size="sm" fullWidth className="bg-secondary-600 hover:bg-secondary-700">Add Business</Button>
            </Link>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Not sure which plan?{' '}
          <Link href="/dashboard/support" className="text-primary-600 font-semibold hover:underline">Talk to our team →</Link>
        </p>
      </div>

      {/* What you get */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">What DomainCampaign Includes</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: 'Social Media', desc: 'Up to 120 posts/month across Facebook, Instagram, LinkedIn' },
            { title: 'SEO Management', desc: 'Up to 10 keywords, on-page & off-page optimization' },
            { title: 'Google Business Profile', desc: 'Setup, verification and monthly updates' },
            { title: 'Poster Designs', desc: 'Up to 150 custom creatives per month' },
            { title: 'Blog Articles', desc: 'Up to 10 SEO-optimized articles per month' },
            { title: 'Monthly Reports', desc: 'Campaign performance delivered to your dashboard' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
              <Check className="h-4 w-4 text-secondary-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
