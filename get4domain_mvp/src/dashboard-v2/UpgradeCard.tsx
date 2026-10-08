'use client';

import Link from 'next/link';
import { Lock, Clock } from 'lucide-react';
import { planDisplayName, type Feature } from '@/lib/nav.generated';

/**
 * LOCKED: the feature is built, the vendor's plan does not include it. One sentence of benefit, what it unlocks, and a button that goes to
 * Plan and billing — never a dead link, never for something that does not exist.
 */
export function UpgradeCard({ feature, label, compact = false }: { feature: Feature; label: string; compact?: boolean }) {
  const plan = planDisplayName(feature.minPlan);
  return (
    <div className={`mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white text-center ${compact ? 'p-5' : 'mt-10 p-8'}`} role="region" aria-label={`${label} is on the ${plan} plan`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50"><Lock className="h-6 w-6 text-primary-600" /></div>
      <h2 className="text-lg font-bold text-slate-900">{feature.upgrade?.headline ?? label}</h2>
      <p className="mt-2 text-sm text-slate-600">{feature.upgrade?.body ?? `${label} is part of the ${plan} plan.`}</p>
      <p className="mt-3 text-xs font-medium text-slate-500">Included in the {plan} plan</p>
      <Link href="/dashboard/account/billing?tab=billing" className="mt-5 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">See plans and upgrade</Link>
    </div>
  );
}

/** Shown when someone opens the address of a feature that is not built (or not verified) yet: an honest "not yet", with no half-built screen behind it. */
export function ComingSoonCard({ feature, label }: { feature: Feature; label: string }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center" role="region" aria-label={`${label} is coming soon`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white"><Clock className="h-6 w-6 text-slate-400" /></div>
      <h2 className="text-lg font-bold text-slate-800">{label}</h2>
      <p className="mt-2 text-sm text-slate-600">This is not available yet. We will switch it on here when it is ready.</p>
      <p className="mt-3 text-xs font-medium text-slate-500">Planned for the {planDisplayName(feature.minPlan)} plan</p>
      <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-primary-700 hover:underline">Back to Today</Link>
    </div>
  );
}
