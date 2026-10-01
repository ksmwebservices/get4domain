import { Globe, Check } from 'lucide-react';

// Two annual-only tiers (dispatch 01-Oct-2026): Workspace ₹999/mo, BOS ₹1,999/mo.
const plans = [
  { product: 'DomainApp', name: 'Workspace', monthly: 999, yearly: 11988, features: 20, themeChanges: 2 },
  { product: 'DomainApp', name: 'BOS', monthly: 1999, yearly: 23988, features: 26, themeChanges: 4 },
];

export default function AdminPlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Plans &amp; Pricing</h2>
        <p className="mt-1 text-sm text-slate-400">Two annual-only tiers — Workspace ₹999/mo and BOS ₹1,999/mo, both billed once a year + 18% GST. Usage is wallet-billed (top up from ₹499).</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <div key={`${plan.product}-${plan.name}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-primary-400" />
              <span className="text-xs font-semibold text-slate-400">{plan.product}</span>
            </div>
            <div className="text-lg font-bold text-white">{plan.name}</div>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Billed annually</span>
                <span className="text-white font-semibold">₹{plan.yearly.toLocaleString('en-IN')}<span className="text-slate-500 font-normal">/year (≈₹{plan.monthly}/mo)</span></span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Features</span>
                <span className="text-white font-semibold flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success-400" />{plan.features} included</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Theme changes</span>
                <span className="text-white font-semibold">{plan.themeChanges}/year</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4 text-sm text-slate-400">
        Plan prices are the <code className="text-primary-400">domainapp_workspace_yearly</code> / <code className="text-primary-400">domainapp_bos_yearly</code> rates in the Pricing Manager (Admin → Pricing). Wallet usage rates are managed there too.
      </div>
    </div>
  );
}
