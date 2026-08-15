import Link from 'next/link';
import { Megaphone, Check } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function DomainCampaignDashboardPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Campaigns</h2>
        <p className="mt-1 text-sm text-slate-500">Included in your DomainApp plan — no separate subscription.</p>
      </div>

      {/* Included in DomainApp */}
      <div className="rounded-2xl border-2 border-secondary-300 bg-secondary-50/30 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-100">
          <Megaphone className="h-8 w-8 text-secondary-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Campaigns are part of DomainApp</h3>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
          Landing pages, social media, WhatsApp/SMS/email messaging and AI content are all included in your
          ₹999/month plan. Campaign &amp; messaging usage is billed from your wallet (top up from ₹499).
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard/campaigns"><Button size="sm">Go to Campaigns</Button></Link>
          <Link href="/dashboard/wallet"><Button size="sm" variant="outline">Top up wallet</Button></Link>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Need our team to run it for you?{' '}
          <Link href="/dashboard/support" className="text-primary-600 font-semibold hover:underline">Talk to our team →</Link>
        </p>
      </div>

      {/* What's included */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">What&apos;s Included</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: 'Social Media', desc: 'Create & schedule posts for Facebook, Instagram, LinkedIn' },
            { title: 'SEO Management', desc: 'On-page & off-page optimization' },
            { title: 'Google Business Profile', desc: 'Setup, verification and updates' },
            { title: 'Poster Designs', desc: 'AI-generated custom creatives' },
            { title: 'Blog Articles', desc: 'SEO-optimized AI articles' },
            { title: 'Reports', desc: 'Campaign performance in your dashboard' },
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
