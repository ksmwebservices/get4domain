import { Globe, Megaphone, Check, Edit2 } from 'lucide-react';

const plans = [
  { product: 'DomainApp', name: 'Startup',    halfYear: 3999,  yearly: 6999,  features: 14, active: 0 },
  { product: 'DomainApp', name: 'Enterprise', halfYear: 13999, yearly: 24999, features: 20, active: 1 },
  { product: 'DomainCampaign', name: 'Starter',  halfYear: 3999,  yearly: 6999,  features: 8, active: 0 },
  { product: 'DomainCampaign', name: 'Business', halfYear: 16999, yearly: 29999, features: 11, active: 0 },
];

export default function AdminPlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Plans & Pricing</h2>
        <p className="mt-1 text-sm text-slate-400">All active plans. Edit pricing via code in Phase 2 (admin UI in Phase 3).</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <div key={`${plan.product}-${plan.name}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              {plan.product === 'DomainApp' ? <Globe className="h-4 w-4 text-primary-400" /> : <Megaphone className="h-4 w-4 text-secondary-400" />}
              <span className="text-xs font-semibold text-slate-400">{plan.product}</span>
            </div>
            <div className="text-lg font-bold text-white">{plan.name}</div>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">6 Months</span>
                <span className="text-white font-semibold">₹{plan.halfYear.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Yearly</span>
                <span className="text-white font-semibold">₹{plan.yearly.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Features</span>
                <span className="text-white font-semibold">{plan.features} included</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Active Subscribers</span>
                <span className={`font-bold ${plan.active > 0 ? 'text-success-400' : 'text-slate-600'}`}>{plan.active}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-400">
        Pricing is managed in <code className="text-primary-400">src/data/content.ts</code>. A full admin pricing editor will be added in Phase 3.
      </div>
    </div>
  );
}
